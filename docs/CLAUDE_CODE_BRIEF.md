# JeevanLink — MVP & Deployment Brief for Claude Code

_Rewritten 25 Sep 2026 after the pivot off SIH26047 (AYUSH patient case-taking) to a rural/
underserved public-health care-access problem statement. Read this whole file before touching
code — it tells you what the current problem statement asks for, what's built against it, and
what's actually left, in priority order. The original 2026-09-10 AYUSH-era version of this brief
is superseded; nothing in it should be treated as current._

## 1. What the current problem statement asks for

The exact official PS ID/organisation and full source text weren't available when this was
written — **paste the official text in before relying on this section for anything you'd quote to
a judge.** As relayed to the build team, the load-bearing asks are:

- **Assisted teleconsultation.** Some form of remote/assisted support for a patient who can't
  easily reach a specialist in person.
- **Appointment and queue management.** A way to request and track a visit at a facility.
- **Digital triage.** Detecting and prioritising high-risk cases instead of routine queueing.
- **Longitudinal patient records.** A history that follows the patient across facility tiers
  instead of resetting at each one.
- **Referral tracking.** Visibility into a referral's status between facility tiers (sub-centre →
  PHC → rural hospital → district hospital), so it doesn't silently go nowhere.
- **Diagnostic coordination.** Getting lab/investigation results connected to the patient's record
  and to the clinician who needs them.
- **Medicine availability.** Visibility into what a facility actually has in stock.
- **High-risk patient follow-up.** Making sure a flagged case is actually followed up, not just
  flagged.
- **Facility dashboards.** Operational visibility across facilities, not just per-patient care.
- **Multilingual and low-connectivity support.** Usable by patients who don't read/speak English
  and facilities without reliable internet.
- **Interoperable records (approved standards).** Records shaped for exchange with other health
  systems (FHIR/ABDM being the applicable Indian standard).

## 2. What's built against it (verified by reading the code, not assuming)

Stack: Next.js 16 + React 19, Prisma 6 against **MongoDB Atlas** (production, not local SQLite —
that migration completed before this pivot), Tailwind 4, Google Gemini (`@google/genai`) as the
AI backbone, and a separate FastAPI voice service (`jeeva/`, Bhashini ASR/TTS) deployed to Render.

- **Assisted teleconsultation** — no live video calling exists or was attempted; this was a
  deliberate scope call (see `docs/PPT_CONTENT.md` Section 5). Instead, Jeeva (the existing
  always-on voice assistant, `src/components/JeevaOrb.tsx` + `jeeva/`) was reframed in its own
  page copy (`src/app/voice-assistant/page.tsx`) as the "assisted" support layer — voice-first,
  multilingual, available before a real clinician contact.
- **Digital triage** — already existed pre-pivot and needed zero new code: `buildRedFlags()` in
  `api/clinical-intake/route.ts` detects 5 emergency categories across all 12 languages;
  `clinician/page.tsx`'s `getCaseRedFlags()` + `pendingCases` sort flagged cases to the top of the
  queue with a distinct "Urgent" badge. This also satisfies "high-risk patient follow-up" — a
  flagged case is unavoidably the first thing a clinician sees, not a separate system.
- **Longitudinal patient records** — pre-existing Health Records + Health Timeline
  (`src/app/records/`, `src/app/health-timeline/`), unchanged by the pivot.
- **Referral tracking** — new this pivot. `Referral` model (`prisma/schema.prisma`): patientId,
  optional `fromFacilityId`, required `toFacilityId` (both `Hospital` relations), reason, status
  (`PENDING | ACCEPTED | COMPLETED | DECLINED`). `api/referrals/route.ts` (GET list + facility
  options, POST create, PATCH status transition) and `src/app/referrals/page.tsx`.
- **Appointment and queue management** — new this pivot, deliberately lightweight (not a
  calendar/slot system). `Appointment` model: patientId, facilityId, reason, optional
  `preferredAt`, status (`REQUESTED | QUEUED | SEEN | CANCELLED`). `api/appointments/route.ts` +
  `src/app/appointments/page.tsx`.
- **Diagnostic coordination** — pre-existing `LabOrder`/`LabReport` models and the
  `hospitals-labs` page already covered this; unchanged by the pivot beyond nav placement.
- **Medicine availability** — new this pivot. `MedicineStock` model, unique on
  `(facilityId, medicineName)` so setting a status is one upsert. `api/medicine-stock/route.ts`
  (GET open to any signed-in user, POST admin-only). Admin-editable at
  `src/app/admin/medicine-stock/page.tsx` (linked from the main admin overview, which stays
  read-only per its own design note); patient-facing read-only view at
  `src/app/medicine-availability/page.tsx`.
- **Facility dashboards** — new this pivot. `api/admin/overview/route.ts` extended with facility
  counts, active admissions, referral status breakdown, and open-escalation counts (reusing the
  same red-flag parsing the clinician queue uses), plus a per-facility table. Rendered in
  `src/app/admin/page.tsx`, which explicitly stays read-only/monitoring-only — do not bolt
  mutation UI onto it; give a new feature its own admin sub-page instead, as medicine-stock did.
- **Interoperable records** — new this pivot. `api/fhir-export/route.ts` builds a Patient +
  DocumentReference Bundle from a patient's own `MedicalRecord`s, shaped the way FHIR expects.
  `src/app/fhir-export/page.tsx` previews and downloads it, explicitly labelled a starting point,
  not a certified ABDM/FHIR integration — no ABDM sandbox credentials exist, and none of this has
  been validated against real conformance profiles.
- **Multilingual support** — pre-existing 12-language `i18n.ts` (10,380 lines), unchanged in
  scope by the pivot. **New this pivot's own pages (Referrals, Appointments, Medicine
  Availability, FHIR export) ship English-only content** — only their nav labels were added to
  every language's dictionary; the page bodies rely on `translate()`'s fallback-to-English chain.
  This mirrors the pre-existing precedent set by `hospitals-labs/page.tsx`, which also only
  partially translates its content — not a regression introduced by this pivot, but also not yet
  fixed for the new pages either.
- **Low-connectivity support** — explicitly out of scope for the timeline; not attempted for the
  app as a whole. Jeeva has its own separate offline "golden consult" demo-mode script
  (`apps/web/scripts/generate-jeeva-demo.ts`) that covers the narrative for the voice piece only.
- **Consent, privacy** — pre-existing append-only `ConsentEvent` log, unchanged by the pivot,
  already exceeds DPDP's baseline ask.
- **AYUSH-specific content — removed.** `clinical-intake/page.tsx`'s `IntakeMode` toggle,
  Dashavidha Pariksha fields, `AYUSH_FIELD_LABELS`, and every related translation key were deleted
  (commit `1a69eae`). Confirmed via repo-wide grep: zero remaining `ayush`/`dashavidha`/
  `prakriti`/`vikriti` references in `src/`.
- **Repo hygiene**: the shared `Sidebar.tsx` component is now used by every patient-facing page
  (`consent`, `hospitals-labs`, `support`, `vitals`, `voice-assistant` were migrated off their own
  hand-copied nav arrays in commit `6026d3c`) — if you add a new patient page, use `<Sidebar />`
  from the start, don't hand-copy the nav again.

## 3. Priority 1 — what's actually left

1. **Translate the 4 new pages** (Referrals, Appointments, Medicine Availability, FHIR export)
   into the other 11 languages. Currently functional but English-only; low risk, mechanical work,
   follow the exact key-naming pattern already used for every other page in `i18n.ts`.
2. **Decide on real ABDM/FHIR integration** — needs ABDM sandbox credentials (project owner's own
   action) before any code work is meaningful. The current `/fhir-export` is a defensible starting
   point, not something to keep polishing without real credentials to test against.
3. **`ocr-service/` (handwriting OCR microservice)** is built and works locally
   (`microsoft/trocr-small-handwritten`) but OOM'd on Render's free tier even after switching to
   the smaller model. Options, not yet decided: pay for a Standard Render plan, skip it for the
   demo (Gemini's own multimodal extraction in `analyze-document/route.ts` already handles most
   documents without it), or re-architect around ONNX Runtime for a smaller memory footprint.
4. **Low-connectivity/offline-first mode**, if there's time after the above — full scope was
   judged too large for the deadline; even a partial version (e.g. read-only cached record view)
   would need a deliberate design pass, not a quick patch.

## 4. Priority 2 — stretch / explicitly deferred

- Real ABHA-based login (currently email + password only).
- Real video teleconsultation infrastructure — Jeeva's voice assistant is the considered
  substitute for the "assisted" part of teleconsultation; a live calling system was judged out of
  scope, not simply unbuilt.
- Per-facility granularity beyond what's already in the facility dashboard (e.g. facility-level
  role accounts, rather than one shared ADMIN role seeing every facility).

## 5. Suggested order of operations

Do item 1 (translations) first — it's mechanical, low-risk, and closes an honest gap without any
design decisions. Then get a decision from the project owner on ABDM sandbox credentials and the
`ocr-service` hosting question before spending more engineering time on either — both are blocked
on external accounts/decisions, not code. Low-connectivity support only after both of those are
resolved or explicitly deprioritised.
