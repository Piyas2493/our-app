/* =========================================================
   CLINICAL INTAKE DRAFT
   Structured patient-reported history captured through the
   AI-assisted case-taking flow (clinical-intake). Distinct
   from a plain uploaded document: this is a structured object
   serialized into MedicalRecord.interpretation as JSON, not a
   natural-language sentence like every other document type.

   Shared between the clinician's editable review (clinician/page.tsx)
   and the patient-facing read-only summary (ClinicalIntakeSummary),
   which used to each need their own copy -- extracted here after the
   patient-facing pages were found dumping this JSON as raw text
   instead of rendering it (2026-09-18).
   ========================================================= */

export type ClinicalIntakeDraft = {
  preferredLanguage?: string;
  consent?: Record<string, boolean>;
  chiefComplaint: string;
  hpi: {
    onset: string;
    duration: string;
    character: string;
    location: string;
    radiation: string;
    severity: string;
    aggravating: string;
    relieving: string;
    associatedSymptoms: string;
  };
  pastMedicalHistory: string[];
  pastSurgicalHistory: string[];
  medications: string[];
  allergies: string[];
  familyHistory: string[];
  personalHistory: {
    diet: string;
    sleep: string;
    smoking: string;
    alcohol: string;
    occupation: string;
  };
  reviewOfSystems: Record<string, string>;
  priorInvestigations: string[];
  redFlags: string[];
  sourceDocuments?: Array<{ name: string; type: string; url: string }>;
  englishTranslation?: ClinicalIntakeTranslation | null;
};

// English translation of the patient's own-language answers, generated
// once at submission time (see api/clinical-intake/route.ts). Only
// present when the patient answered in a language other than English.
// This mirrors the translatable subset of ClinicalIntakeDraft -- it's
// reference-only, never the field the clinician actually edits.
export type ClinicalIntakeTranslation = {
  chiefComplaint: string;
  hpi: Record<string, string>;
  personalHistory: Record<string, string>;
  reviewOfSystems: Record<string, string>;
  pastMedicalHistory: string[];
  pastSurgicalHistory: string[];
  medications: string[];
  allergies: string[];
  familyHistory: string[];
  priorInvestigations: string[];
};

export const INTAKE_LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  or: "Odia",
  as: "Assamese",
};

export const HPI_FIELD_LABELS: Array<[keyof ClinicalIntakeDraft["hpi"], string]> = [
  ["onset", "Onset"],
  ["duration", "Duration"],
  ["character", "Character"],
  ["location", "Location"],
  ["radiation", "Radiation"],
  ["severity", "Severity"],
  ["aggravating", "Aggravating factors"],
  ["relieving", "Relieving factors"],
  ["associatedSymptoms", "Associated symptoms"],
];

export function parseClinicalIntake(
  interpretation: string
): ClinicalIntakeDraft | null {
  try {
    const parsed = JSON.parse(interpretation);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.chiefComplaint !== "string" ||
      !parsed.hpi ||
      typeof parsed.hpi !== "object"
    ) {
      return null;
    }

    return {
      preferredLanguage: parsed.preferredLanguage,
      consent: parsed.consent || {},
      chiefComplaint: String(parsed.chiefComplaint || ""),
      hpi: {
        onset: String(parsed.hpi.onset || ""),
        duration: String(parsed.hpi.duration || ""),
        character: String(parsed.hpi.character || ""),
        location: String(parsed.hpi.location || ""),
        radiation: String(parsed.hpi.radiation || ""),
        severity: String(parsed.hpi.severity || ""),
        aggravating: String(parsed.hpi.aggravating || ""),
        relieving: String(parsed.hpi.relieving || ""),
        associatedSymptoms: String(parsed.hpi.associatedSymptoms || ""),
      },
      pastMedicalHistory: Array.isArray(parsed.pastMedicalHistory)
        ? parsed.pastMedicalHistory.map(String)
        : [],
      pastSurgicalHistory: Array.isArray(parsed.pastSurgicalHistory)
        ? parsed.pastSurgicalHistory.map(String)
        : [],
      medications: Array.isArray(parsed.medications)
        ? parsed.medications.map(String)
        : [],
      allergies: Array.isArray(parsed.allergies)
        ? parsed.allergies.map(String)
        : [],
      familyHistory: Array.isArray(parsed.familyHistory)
        ? parsed.familyHistory.map(String)
        : [],
      personalHistory: {
        diet: String(parsed.personalHistory?.diet || ""),
        sleep: String(parsed.personalHistory?.sleep || ""),
        smoking: String(parsed.personalHistory?.smoking || ""),
        alcohol: String(parsed.personalHistory?.alcohol || ""),
        occupation: String(parsed.personalHistory?.occupation || ""),
      },
      reviewOfSystems:
        parsed.reviewOfSystems && typeof parsed.reviewOfSystems === "object"
          ? parsed.reviewOfSystems
          : {},
      priorInvestigations: Array.isArray(parsed.priorInvestigations)
        ? parsed.priorInvestigations.map(String)
        : [],
      redFlags: Array.isArray(parsed.redFlags)
        ? parsed.redFlags.map(String)
        : [],
      sourceDocuments: Array.isArray(parsed.sourceDocuments)
        ? parsed.sourceDocuments
        : [],
      englishTranslation:
        parsed.englishTranslation && typeof parsed.englishTranslation === "object"
          ? {
              chiefComplaint: String(parsed.englishTranslation.chiefComplaint || ""),
              hpi:
                parsed.englishTranslation.hpi &&
                typeof parsed.englishTranslation.hpi === "object"
                  ? parsed.englishTranslation.hpi
                  : {},
              personalHistory:
                parsed.englishTranslation.personalHistory &&
                typeof parsed.englishTranslation.personalHistory === "object"
                  ? parsed.englishTranslation.personalHistory
                  : {},
              reviewOfSystems:
                parsed.englishTranslation.reviewOfSystems &&
                typeof parsed.englishTranslation.reviewOfSystems === "object"
                  ? parsed.englishTranslation.reviewOfSystems
                  : {},
              pastMedicalHistory: Array.isArray(
                parsed.englishTranslation.pastMedicalHistory
              )
                ? parsed.englishTranslation.pastMedicalHistory.map(String)
                : [],
              pastSurgicalHistory: Array.isArray(
                parsed.englishTranslation.pastSurgicalHistory
              )
                ? parsed.englishTranslation.pastSurgicalHistory.map(String)
                : [],
              medications: Array.isArray(parsed.englishTranslation.medications)
                ? parsed.englishTranslation.medications.map(String)
                : [],
              allergies: Array.isArray(parsed.englishTranslation.allergies)
                ? parsed.englishTranslation.allergies.map(String)
                : [],
              familyHistory: Array.isArray(parsed.englishTranslation.familyHistory)
                ? parsed.englishTranslation.familyHistory.map(String)
                : [],
              priorInvestigations: Array.isArray(
                parsed.englishTranslation.priorInvestigations
              )
                ? parsed.englishTranslation.priorInvestigations.map(String)
                : [],
            }
          : null,
    };
  } catch {
    return null;
  }
}
