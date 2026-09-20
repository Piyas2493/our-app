// A clinician-authored consultation note saved via AI Medical Scribe
// (api/scribe/notes/route.ts). Like clinical-intake, this is a
// structured object serialized into MedicalRecord.interpretation as
// JSON rather than a natural-language sentence.
export type ScribeNoteDraft = {
  rawNotes: string;
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  authoredBy?: { id: string; name: string };
};

export function parseScribeNote(interpretation: string): ScribeNoteDraft | null {
  try {
    const parsed = JSON.parse(interpretation);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.type !== "CLINICIAN_SCRIBE_NOTE"
    ) {
      return null;
    }

    return {
      rawNotes: typeof parsed.rawNotes === "string" ? parsed.rawNotes : "",
      soap: {
        subjective: String(parsed.soap?.subjective || ""),
        objective: String(parsed.soap?.objective || ""),
        assessment: String(parsed.soap?.assessment || ""),
        plan: String(parsed.soap?.plan || ""),
      },
      authoredBy:
        parsed.authoredBy && typeof parsed.authoredBy === "object"
          ? {
              id: String(parsed.authoredBy.id || ""),
              name: String(parsed.authoredBy.name || ""),
            }
          : undefined,
    };
  } catch {
    return null;
  }
}
