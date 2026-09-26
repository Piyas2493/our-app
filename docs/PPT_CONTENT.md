# JeevanLink — PPT Source Pack

Everything from the codebase and the new problem statement that a pitch deck needs, in one place.
Rewritten 25 Sep 2026 after the pivot off SIH26047 (AYUSH patient case-taking) to a rural/
underserved public-health care-access problem statement — see the note below and Section 14.

> **Still worth pasting in before presenting:** the full official problem-statement PDF/portal
> text (Problem Description / Expected Outcome in full). The identity block below is now
> confirmed, but the "Problem slide" statistics still cite only the qualitative points relayed to
> the build team, not official figures — paste the full text in and those can be tightened the
> same way the original AYUSH version cited BMJ Open 2017 and the PS's own OPD-load figures.

---

## 1. Identity block (title slide)

| Field | Value |
|---|---|
| Team | **JeevanSync** |
| Team ID | **SIH43** |
| Problem Statement ID | **SIH26133** (supersedes SIH26047 — that AYUSH slot filled before registration) |
| Title | Accessibility and quality of public healthcare services, particularly in rural and underserved areas |
| Organisation | **Government of Maharashtra** |
| Category / Theme | Software / MedTech · HealthTech |
| Our product name | **JeevanLink** |
| In-app tagline | *"Your Health. Your Continuity."* |
| In-app section label | "Continuity Centre" |

---

## 2. Problem slide — what the new problem statement names

*(Qualitative points below are from the problem statement as relayed to the build team; the
official text should be pasted in and cited directly once available — no statistics are invented
here that weren't actually sourced.)*

- Rural and underserved communities face **long travel distances** to reach a specialist, and
  **shortages of specialists** once they arrive.
- Diagnostics are **irregular** — a patient may travel for a test a facility can't currently run,
  or for medicine a facility doesn't currently stock.
- Medical records are **fragmented** across the sub-centre → PHC → rural hospital → district
  hospital chain a rural patient actually moves through, with no shared longitudinal view.
- **Referrals are delayed** or lost entirely between that chain of facilities — nothing tracks a
  referral from the moment it's made to the moment the patient is actually seen at the next tier.
- Patients have **limited awareness of available services** — which facility has capacity, which
  has the needed specialist, which has the medicine in stock.

### Why generic solutions fall short

| Existing approach | Why it fails a rural patient |
|---|---|
| Hospital registration systems | Capture demographics + appointment only. No longitudinal history, no cross-facility referral tracking. |
| Generic telemedicine apps | Assume smartphone literacy, stable connectivity, and a single facility relationship — not a patient moving between tiers. |
| Paper referral slips | No status tracking; a referral can be made and then simply never followed up on either side. |
| Facility-by-facility record systems | A patient's history resets at every new facility instead of following them. |

---

## 3. Solution slide — the care-access journey JeevanLink implements

1. **Identify** — patient registers, selects one of 12 languages, grants granular consent
   (audio-guided for low-literacy patients).
2. **Assisted intake & triage** — adaptive voice + touch clinical history interview; red-flag
   detection on emergency symptoms escalates a case to the top of the clinician queue instead of
   routine ordering. Jeeva, the always-available voice assistant, gives multilingual support
   before a patient can reach a clinician in person or by call.
3. **Digitise & connect records** — prior prescriptions, lab reports and discharge summaries are
   uploaded, OCR'd, structured, and merged into one chronological Health Timeline instead of
   resetting at every new facility.
4. **Coordinate across facilities** — **Referral tracking** follows a patient between facility
   tiers with a visible status (pending → accepted → completed); **Appointment & queue** gives a
   simple request → queued → seen flow per facility; **Medicine availability** shows real-time
   facility-level stock so a patient doesn't travel for a medicine that isn't there.
5. **Verify & consult** — the clinician reviews the structured summary and any escalation flags,
   verifies or sends the record back with a correction note, and spends the actual visit on
   examination and reasoning rather than re-taking history already captured.
6. **Oversee** — a facility dashboard aggregates admissions, referral volume, and open
   escalations across facilities for operational visibility, not just per-patient care.

**One-line pitch:** *JeevanLink follows a patient's care across visits and facility tiers —
assisted intake, longitudinal records, referral and appointment tracking, and medicine
visibility — in the patient's own language, from a first sub-centre visit through to a district
hospital.*

---

## 4. Architecture & tech stack slide

**Frontend / framework**
- Next.js **16.3.3** (App Router, server components + client components)
- React **19.2.8**, TypeScript **5**, Tailwind CSS **4**
- `lucide-react` for iconography

**Backend / data**
- Next.js Route Handlers (`runtime = "nodejs"`, extended `maxDuration` on AI routes)
- Prisma ORM **6.19.3** against **MongoDB Atlas** (production cluster, not a local dev database)
- Auth: `bcryptjs` password hashing + HTTP-only cookie session backed by a real `Session` table
  (a random 32-byte token, never the raw user id), `requireRole()` guard on every protected route
- File storage: **Vercel Blob**, served only through validated `https://*.public.blob.vercel-storage.com` URLs

**AI layer — Google Gemini via `@google/genai` 2.19**
| Purpose | Model | Notes |
|---|---|---|
| Medical document extraction (OCR + structuring) | `gemini-3.6-flash` | multimodal, strict `responseSchema` JSON |
| Speech-to-text for intake answers | `gemini-3.6-flash` | audio in, transcript out, language-pinned |
| Text-to-speech for audio prompts | `gemini-3.1-flash-tts-preview` | "Kore" voice, PCM→WAV assembled server-side |
| Clinician SOAP scribe | `gemini-3.6-flash` | structures dictated notes |
| Personalized-health explanation layer | `gemini-3.5-flash-lite` | explains deterministic analytics, never diagnoses |
| Patient voice assistant (grounded Q&A/navigate/action-draft) | `gemini-3.6-flash` | answers validated server-side before acting |

**Voice module — Jeeva** (separate FastAPI service, `./jeeva`)
- Bhashini (MeitY) ASR + TTS across all 12 supported languages, called from a canvas-drawn "orb"
  mounted globally in the app
- Deployed to Render; live-verified end-to-end (mic capture → Bhashini transcription → Gemini
  reasoning grounded in the patient's own records → Bhashini speech reply)

**Quality tooling**
- **Vitest 3.2.7** + `vite-tsconfig-paths`; `npm test` / `npm run test:watch`
- ESLint 9 + `eslint-config-next`

---

## 5. Feature inventory, mapped to the new problem statement's named capabilities

### Assisted teleconsultation & digital triage ✅ built
- `src/app/clinical-intake/page.tsx` — adaptive voice + touch clinical history interview,
  every question answerable by speaking or tapping
- `api/clinical-intake/transcribe` / `speak` — Gemini-backed voice capture and playback across
  12 Indian speech locales
- **Red-flag detection** — 5 emergency categories (chest pain, severe breathing difficulty,
  loss of consciousness, possible stroke signs, severe bleeding) across all 12 languages;
  a positive flag surfaces as an "Urgent" badge that sorts the case to the top of the clinician's
  queue — verified live, not just stored on the record
- **Jeeva** — always-available multilingual voice assistant reframed explicitly as the
  "assisted" support layer: not a replacement for a real clinician contact, but voice-first help
  in the patient's own language before one is reached

### Longitudinal patient records & document digitisation ✅ built
- `api/upload-document` + `api/analyze-document` — Gemini multimodal extraction (medications,
  lab results with reference ranges, radiology findings) from printed and handwritten documents
- `health-timeline` page — chronological, cross-record view instead of per-document silos
- Structured clinical summary stored per intake (chief complaint → HPI → past medical/surgical →
  medications → allergies → family → personal → review of systems → prior investigations → red
  flags → safety note), with a best-effort English translation pass for the clinician regardless
  of the language the patient answered in

### Referral tracking ✅ built (new this pivot)
- `Referral` model — patient, optional origin facility, required destination facility, reason,
  status (pending → accepted → completed, or declined)
- `/referrals` page + `api/referrals` — create and track a referral between facility tiers,
  reusing the existing `Hospital` model for facility selection
- Directly answers the problem statement's "delayed referrals" pain point with a visible status
  instead of a paper slip that can silently go nowhere

### Appointment & queue management ✅ built (lightweight, new this pivot)
- `Appointment` model + `/appointments` page — a demo-credible request → queued → seen flow per
  facility; deliberately not a full calendar/slot-optimisation system

### Medicine availability ✅ built (new this pivot)
- `MedicineStock` model, unique per (facility, medicine) — admin-editable at `/admin/medicine-stock`,
  read-only for patients at `/medicine-availability`, grouped by facility
- Answers "limited awareness of available services" directly: a patient can check stock before
  travelling for a medicine that isn't there

### Facility dashboards ✅ built (new this pivot)
- Extended the existing admin overview with facility counts, active admissions, referral status
  breakdown, and open-escalation counts, plus a per-facility admissions/referrals table
- Reuses data already captured elsewhere in the system rather than a new reporting pipeline

### High-risk patient follow-up ✅ satisfied by existing escalation flow
- The same red-flag detection above already routes a high-risk case to the top of the clinician's
  review queue with a distinct "Urgent" badge — no separate follow-up system was needed

### Interoperable records ✅ starting point built, ⏳ certified integration on roadmap
- `/fhir-export` — a Patient + DocumentReference bundle built from a patient's own records,
  shaped the way FHIR expects, downloadable as JSON
- Explicitly labelled on the page itself as a starting point, not a certified ABDM/FHIR
  integration — that needs sandbox credentials and a conformance review beyond this build

### Multilingual support ✅ built
- 12 languages, full UI translation (not a token switcher), red-flag detection multilingual too,
  audio-guided consent, high-contrast/large-text accessibility toggles

### Low-connectivity support ⏳ explicitly deferred
- A full offline-first architecture for the whole app was out of scope for the timeline; flagged
  honestly rather than silently dropped. Jeeva's own offline "golden consult" demo mode covers
  the narrative for the voice piece specifically.

### Beyond the problem statement — the continuity platform underneath it
| Area | What's there |
|---|---|
| Vitals | 8 vital types, 5 sources incl. wearables; deterministic analytics + AI narrative report |
| Medications | Records, reminder schedules, taken/skipped/snoozed adherence logs |
| Prescriptions | Dedicated prescriptions view |
| Hospitals & Labs | Admissions, encounters, tests, procedures, bills, insurance claims, lab orders/reports |
| Personalized Health | Deterministic analytics first, AI explanation layer second, explicit data-gap surfacing |
| Helpdesk | Ticketing with priorities, categories, assignment, threaded messages, callback requests |
| Admin | Users by role, record status breakdown, ticket pipeline, consent event counts, facility metrics |

---

## 6. "Why we're safe" slide — the strongest differentiator for judges

Every one of these is real, in-code, and quotable:

- **No AI output is ever final.** Every intake and every extracted document lands as `status: PENDING` and requires an explicit clinician **VERIFY** or **REJECT**. `VerificationAudit` logs every action with actor and note.
- **Rejection is a closed loop.** A `REJECTED` record *requires* a correction note; the patient sees it, corrects, and resubmits.
- **Structured-output contracts.** Every Gemini call uses `responseMimeType: application/json` with a typed `responseSchema`; free-form model prose never reaches the database.
- **Anti-hallucination prompt contracts.** "Do NOT diagnose." "Do NOT invent missing information." "Preserve uncertainty when text is unclear." "If a field is unavailable, return an empty string."
- **A stored safety note on every record**: *"This is a patient-reported clinical intake draft. It is not a diagnosis or treatment recommendation and requires clinician verification."*
- **The model can't act on its own.** The voice assistant's navigation targets are validated against a server-side whitelist; action drafts against a fixed vital-type list.
- **Emergency detection deliberately doesn't depend on AI.** Red-flag matching is deterministic keyword matching, so the emergency path can't fail because of an API outage or quota exhaustion. (Documented trade-off: it will miss paraphrases.)
- **Graceful degradation everywhere.** Retry with exponential backoff, typed error codes (`AI_QUOTA_EXCEEDED`, `AI_SERVICE_UNAVAILABLE`, `EMPTY_AI_RESPONSE`, `INVALID_AI_RESPONSE`), each with a patient-facing fallback.
- **Role-gated everything.** `requireRole("PATIENT" | "CLINICIAN" | "HELPDESK" | "ADMIN")` on every protected route; medicine-stock writes further gated to ADMIN only.
- **A real session model, not a forgeable cookie.** The session cookie holds a random token looked up server-side, not the user's own ID.

---

## 7. Inclusion slide — language and accessibility

**12 languages**, each with native script and an Indian speech locale:

English · हिन्दी · বাংলা · தமிழ் · తెలుగు · मराठी · ગુજરાતી · ಕನ್ನಡ · മലയാളം · ਪੰਜਾਬੀ · ଓଡ଼ିଆ · অসমীয়া

- `i18n.ts` is **11,000+ lines** — the full UI translated, not a token language switcher, including
  the four newest pages built for this pivot (Referrals, Appointments, Medicine Availability,
  FHIR export)
- **Red flags are multilingual too** — a Hindi or Tamil speaker's emergency report is caught by terms in their own script
- **Accessibility toggles** (`AccessibilityProvider`): high contrast, large text, audio-guided mode, persisted per patient
- **Audio-guided consent** for low-literacy patients, and every question answerable by voice *or* touch

---

## 8. Data model slide

**25 models, 20 enums.** Headline models:

`User` · `Session` · `MedicalRecord` (PENDING/VERIFIED/REJECTED) · `Medication` · `MedicationReminder` · `MedicationLog` · `VerificationAudit` · `VitalMeasurement` · `Hospital` · `HospitalAdmission` · `HospitalEncounter` · `HospitalTest` · `HospitalProcedure` · `HospitalBill` · `HospitalBillItem` · `InsuranceClaim` · `Lab` · `LabOrder` · `LabReport` · `ConsentEvent` · **`Referral`** · **`Appointment`** · **`MedicineStock`** · `Ticket` · `TicketMessage`

Worth calling out: the **append-only `ConsentEvent`** design and the **`VerificationAudit`** trail
(defensible under DPDP scrutiny), plus the three models added for this pivot — `Referral`,
`Appointment`, `MedicineStock` — which map directly onto the problem statement's continuity and
availability asks rather than being generic CRUD.

---

## 9. "What we built" metrics slide

| Metric | Value |
|---|---|
| Application pages | **24** |
| API / route handlers | **30** |
| Shared React components | **12** |
| Library modules | **13** |
| Database models / enums | **25** / **20** |
| Languages supported | **12** |
| Test suites | **3** (Vitest, 44 tests: intake, document analysis, consent) |
| Total source | **≈2.7 MB** |
| Largest surfaces | clinician console ~106 KB · hospitals & labs ~86 KB · vitals ~72 KB · clinical intake ~59 KB |
| Build window | **9 Sep – 25 Sep 2026** (~2.5 weeks), including the mid-build pivot off the original problem statement |

---

## 10. Compliance mapping slide

| Requirement | Status |
|---|---|
| DPDP Act 2023 — granular, revocable consent | ✅ 5 categories, revocable, every change logged |
| DPDP — auditability | ✅ append-only consent log + verification audit trail |
| DPDP — purpose limitation | ✅ consent is per-purpose, enforced server-side at submission |
| Consent explained to low-literacy patients | ✅ audio-guided consent |
| Interoperable records (FHIR-shaped) | 🟡 partial — Patient + DocumentReference export live, not yet a certified ABDM/FHIR integration |
| ABDM — ABHA identity | ⏳ roadmap (currently email + password) |
| Secure processing of health data | ✅ role-gated APIs, private authenticated document storage, hashed credentials, real session tokens |

---

## 11. Honest status slide (recommended — judges reward this)

**Demo-ready today:** multilingual voice + touch clinical intake · multilingual red-flag triage
routing to an urgent clinician queue · document upload → OCR → structured extraction ·
longitudinal health timeline · referral tracking between facility tiers · lightweight
appointment/queue flow · facility-level medicine availability · facility dashboard (admissions,
referrals, escalations) · FHIR-shaped record export · clinician verification queue with
correction loop · consent centre with audit log · Jeeva voice assistant (deployed, Bhashini +
Gemini) · patient dashboard, vitals, medications, prescriptions · helpdesk · admin overview.

**Next up:** real ABDM sandbox integration and ABHA-based identity; a genuine offline-first mode
for low-connectivity facilities.

**Explicitly deferred (and why):** real video teleconsultation infrastructure — Jeeva's voice
assistant covers the "assisted" support layer named in the problem statement; building a live
calling system was judged out of scope for the timeline. The handwriting-OCR microservice
(`ocr-service/`) is built and works locally but OOM'd on free-tier hosting; decided against paying
for a bigger plan since it was only ever a redundant second-opinion signal on top of Gemini's own
multimodal OCR, which already handles printed and handwritten documents as the primary extraction
path — not live in the deployed demo, and the app degrades cleanly without it. A full offline-first PWA for every page
— too large a change this late; flagged rather than attempted partially.

---

## 12. Suggested slide order (13 slides)

1. Title — team, PS ID, product name, tagline
2. The care-access gap (problem statement points)
3. Why generic solutions fall short (the 4-row table)
4. Solution overview — the six-step journey
5. Assisted intake & digital triage (voice/touch, red-flag escalation, Jeeva)
6. Longitudinal records (document digitisation + health timeline)
7. Referral tracking + appointment & queue management
8. Medicine availability + facility dashboards
9. Consent, privacy, and the FHIR-shaped interoperability starting point
10. Architecture & stack
11. Why it's safe — AI guardrails (the differentiator slide)
12. Data model + compliance mapping
13. Impact, honest status, and roadmap

---

## 13. Judge Q&A prep

**"Why did the problem statement change mid-build?"** The original SIH26047 (AYUSH) slot filled
before registration completed. The team pivoted to **SIH26133** (Government of Maharashtra —
accessibility and quality of public healthcare services in rural and underserved areas) and reused
the underlying platform — records, verification, multilingual voice, consent — rather than
rebuilding, because most of it transfers directly (see Section 5).

**"Is the AI diagnosing patients?"** No. Every output is a draft in `PENDING` until a clinician
verifies it, every prompt forbids diagnosis, and a safety note is stored on the record itself.

**"What if the AI hallucinates a medication?"** A typed response schema so only declared fields
come back, prompts that require empty values over guesses, and a clinician verification gate
before anything is trusted.

**"What happens when the API is down or out of quota?"** Typed error codes and fallbacks —
voice fails over to typing, document analysis returns a clear retry message. Red-flag emergency
detection never calls the AI at all, so triage can't be taken down by an outage.

**"Does this work for a patient who can't read?"** Audio-guided consent and prompts, every
question answerable by speaking, high-contrast and large-text modes, 12 languages in native
script.

**"How does this actually help someone stuck between a sub-centre and a district hospital?"**
Referral tracking gives the referral a visible status instead of a paper slip; medicine
availability tells them before they travel whether the destination facility has what they need;
the longitudinal record means their history follows them instead of resetting at each facility.

**"Is ABDM integration real?"** Not yet — stated plainly on the roadmap. The FHIR-shaped export
and the consent architecture underneath it (granular, revocable, append-only, purpose-scoped) are
already built to what ABDM's consent framework and DPDP require, which is the harder half.

---

## 14. Pivot note

This deck was rewritten after JeevanLink's original SIH26047 (AYUSH patient case-taking)
submission slot filled before registration completed. The team pivoted to **SIH26133**
(Government of Maharashtra — accessibility and quality of public healthcare services,
particularly in rural and underserved areas) and reused the existing platform rather than starting
over: AYUSH-specific intake fields were removed from the app, and five capabilities named by the
new problem statement — referral tracking, appointment & queue management, medicine availability,
a facility dashboard, and a FHIR-shaped interoperability export — were added on top of what
already existed (longitudinal records, multilingual voice, red-flag triage, clinician
verification, consent).

## Provenance note

`prisma/schema.prisma`, `package.json`, `Sidebar.tsx`, and the API routes for referrals,
appointments, medicine-stock, and fhir-export were read in full for this rewrite. Model/enum/page/
route counts, source size, and the largest-page sizes were measured directly from the repository
on 25 Sep 2026, not carried over from the pre-pivot version of this document. The AYUSH-era
problem-statement statistics (70–80% diagnostic yield from history, BMJ Open 2017, OPD load
figures) have been removed rather than reused, since they were specific to that problem statement
and do not apply here — the new problem slide intentionally cites only what was actually given
for the new problem statement, with a placeholder for the official source text.
