import {
  AYUSH_FIELD_LABELS,
  HPI_FIELD_LABELS,
  parseClinicalIntake,
} from "@/app/lib/clinicalIntake";
import { parseScribeNote } from "@/app/lib/scribeNote";

function hasText(value: string | undefined | null): value is string {
  return !!value && value.trim().length > 0;
}

const LIST_SECTIONS: Array<{
  label: string;
  key:
    | "pastMedicalHistory"
    | "pastSurgicalHistory"
    | "medications"
    | "allergies"
    | "familyHistory"
    | "priorInvestigations";
}> = [
  { label: "Past medical history", key: "pastMedicalHistory" },
  { label: "Past surgical history", key: "pastSurgicalHistory" },
  { label: "Current medications", key: "medications" },
  { label: "Allergies", key: "allergies" },
  { label: "Family history", key: "familyHistory" },
  { label: "Prior investigations", key: "priorInvestigations" },
];

const SOAP_SECTIONS: Array<{ label: string; key: keyof ScribeSoap }> = [
  { label: "Subjective", key: "subjective" },
  { label: "Objective", key: "objective" },
  { label: "Assessment", key: "assessment" },
  { label: "Plan", key: "plan" },
];

type ScribeSoap = { subjective: string; objective: string; assessment: string; plan: string };

function ScribeNoteView({ interpretation }: { interpretation: string }) {
  const note = parseScribeNote(interpretation);
  if (!note) return null;

  const soapEntries = SOAP_SECTIONS.filter(({ key }) => hasText(note.soap[key]));

  return (
    <div className="space-y-5">
      {soapEntries.length > 0 ? (
        soapEntries.map(({ label, key }) => (
          <div key={key}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </h4>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">
              {note.soap[key]}
            </p>
          </div>
        ))
      ) : (
        <p className="whitespace-pre-line leading-7 text-slate-700">
          {note.rawNotes || "No consultation notes recorded."}
        </p>
      )}
    </div>
  );
}

/** Read-only, patient-facing rendering of a CLINICAL_INTAKE or
 * CLINICIAN_SCRIBE_NOTE record's structured `interpretation` JSON --
 * omits every empty field instead of showing them, so a short/partial
 * record still reads as a clean summary rather than a form half-filled
 * with empty quotes (or, previously, raw JSON braces and quote marks).
 * Renders `fallback` for every other document type, whose
 * `interpretation` is already a plain natural-language sentence. */
export default function ClinicalIntakeSummary({
  interpretation,
  fallback,
}: {
  interpretation: string;
  fallback: React.ReactNode;
}) {
  if (parseScribeNote(interpretation)) {
    return <ScribeNoteView interpretation={interpretation} />;
  }

  const draft = parseClinicalIntake(interpretation);
  if (!draft) return <>{fallback}</>;

  const hpiEntries = HPI_FIELD_LABELS.filter(([field]) => hasText(draft.hpi[field]));
  const ayushEntries = AYUSH_FIELD_LABELS.filter(([key]) => hasText(draft.ayush[key]));
  const personalHistoryEntries = Object.entries(draft.personalHistory).filter(
    ([, value]) => hasText(value)
  );

  return (
    <div className="space-y-5">
      {draft.redFlags.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>Flagged for urgent review:</strong> {draft.redFlags.join(", ")}
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Chief complaint
        </h4>
        <p className="mt-1 text-slate-800">
          {hasText(draft.chiefComplaint) ? draft.chiefComplaint : "Not recorded."}
        </p>
      </div>

      {hpiEntries.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            History of present illness
          </h4>
          <dl className="mt-1 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {hpiEntries.map(([field, label]) => (
              <div key={field}>
                <dt className="text-xs text-slate-400">{label}</dt>
                <dd className="text-sm text-slate-700">{draft.hpi[field]}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {LIST_SECTIONS.filter((section) => draft[section.key].length > 0).map(
        (section) => (
          <div key={section.key}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {section.label}
            </h4>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
              {draft[section.key].map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )
      )}

      {personalHistoryEntries.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Personal history
          </h4>
          <dl className="mt-1 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {personalHistoryEntries.map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs capitalize text-slate-400">{key}</dt>
                <dd className="text-sm text-slate-700">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {ayushEntries.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ayurvedic assessment (Dashavidha Pariksha)
          </h4>
          <dl className="mt-1 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {ayushEntries.map(([key, label]) => (
              <div key={key}>
                <dt className="text-xs text-slate-400">{label}</dt>
                <dd className="text-sm text-slate-700">{draft.ayush[key]}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

/** The one-line preview shown in a list/card (e.g. the timeline or the
 * records list) -- the chief complaint (clinical intake) or the first
 * SOAP section / raw note (scribe note), not the whole structured
 * object. Falls back to the raw interpretation/summary text for every
 * other document type, matching the existing behavior for those. */
export function clinicalIntakePreviewText(
  interpretation: string | null | undefined,
  fallback: string
): string {
  const scribeNote = interpretation ? parseScribeNote(interpretation) : null;
  if (scribeNote) {
    const firstSoap = SOAP_SECTIONS.map(({ key }) => scribeNote.soap[key]).find(hasText);
    return firstSoap || (hasText(scribeNote.rawNotes) ? scribeNote.rawNotes : fallback);
  }

  const draft = interpretation ? parseClinicalIntake(interpretation) : null;
  if (draft) {
    return hasText(draft.chiefComplaint) ? draft.chiefComplaint : fallback;
  }
  return interpretation && hasText(interpretation) ? interpretation : fallback;
}
