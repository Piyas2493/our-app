import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/auth";
import { collectIntakeText, detectRedFlags } from "@/app/lib/redFlags";

export const runtime = "nodejs";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  : null;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

/*
 * The PS requires the physician-facing summary to be in English/Hindi
 * regardless of what language the patient answered in -- every clinician
 * console in this app is English-only, so English is the target here.
 * Best-effort only: this must never block a clinical intake submission.
 * If it fails for any reason (quota, network, malformed response), the
 * intake still saves with the patient's original-language answers; the
 * clinician just won't see an English translation for that one record.
 */
async function translateIntakeToEnglish(
  payload: {
    chiefComplaint: string;
    hpi: Record<string, unknown>;
    personalHistory: Record<string, unknown>;
    reviewOfSystems: Record<string, unknown>;
    pastMedicalHistory: string[];
    pastSurgicalHistory: string[];
    medications: string[];
    allergies: string[];
    familyHistory: string[];
    priorInvestigations: string[];
  },
  sourceLanguage: string,
): Promise<Record<string, unknown> | null> {
  if (!ai) return null;

  const entries: { path: string; text: string }[] = [];

  if (payload.chiefComplaint) {
    entries.push({ path: "chiefComplaint", text: payload.chiefComplaint });
  }

  for (const [key, value] of Object.entries(payload.hpi || {})) {
    if (typeof value === "string" && value.trim()) {
      entries.push({ path: `hpi.${key}`, text: value.trim() });
    }
  }

  for (const [key, value] of Object.entries(payload.personalHistory || {})) {
    if (typeof value === "string" && value.trim()) {
      entries.push({ path: `personalHistory.${key}`, text: value.trim() });
    }
  }

  const reviewGeneral = payload.reviewOfSystems?.general;

  if (typeof reviewGeneral === "string" && reviewGeneral.trim()) {
    entries.push({ path: "reviewOfSystems.general", text: reviewGeneral.trim() });
  }

  for (const listKey of [
    "pastMedicalHistory",
    "pastSurgicalHistory",
    "medications",
    "allergies",
    "familyHistory",
    "priorInvestigations",
  ] as const) {
    payload[listKey].forEach((item, index) => {
      if (item && item.trim()) {
        entries.push({ path: `${listKey}.${index}`, text: item.trim() });
      }
    });
  }

  if (entries.length === 0) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Translate each "text" value below from ${sourceLanguage} into clear, plain English for a clinician who does not read ${sourceLanguage}. Preserve medical meaning exactly -- do not summarize, add, or omit information. Return every "path" unchanged with its English "translation".\n\n${JSON.stringify(
                entries,
              )}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              path: { type: Type.STRING },
              translation: { type: Type.STRING },
            },
            required: ["path", "translation"],
          },
        },
      },
    });

    const text = response.text;
    if (!text || !text.trim()) return null;

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return null;

    const translationByPath = new Map<string, string>();

    for (const item of parsed) {
      if (
        item &&
        typeof item.path === "string" &&
        typeof item.translation === "string"
      ) {
        translationByPath.set(item.path, item.translation);
      }
    }

    if (translationByPath.size === 0) return null;

    const result: Record<string, unknown> = {
      chiefComplaint: translationByPath.get("chiefComplaint") || payload.chiefComplaint,
      hpi: Object.fromEntries(
        Object.keys(payload.hpi || {}).map((key) => [
          key,
          translationByPath.get(`hpi.${key}`) ?? (payload.hpi as Record<string, unknown>)[key],
        ]),
      ),
      personalHistory: Object.fromEntries(
        Object.keys(payload.personalHistory || {}).map((key) => [
          key,
          translationByPath.get(`personalHistory.${key}`) ??
            (payload.personalHistory as Record<string, unknown>)[key],
        ]),
      ),
      reviewOfSystems: {
        general:
          translationByPath.get("reviewOfSystems.general") ?? reviewGeneral ?? "",
      },
    };

    for (const listKey of [
      "pastMedicalHistory",
      "pastSurgicalHistory",
      "medications",
      "allergies",
      "familyHistory",
      "priorInvestigations",
    ] as const) {
      result[listKey] = payload[listKey].map(
        (item, index) => translationByPath.get(`${listKey}.${index}`) ?? item,
      );
    }

    return result;
  } catch (error) {
    console.error(
      "Clinical intake English translation failed (submission continues without it):",
      error,
    );
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("PATIENT");

    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid clinical intake payload.",
        },
        { status: 400 }
      );
    }

    const preferredLanguage =
      cleanString(body.preferredLanguage) || "en";

    const mode =
      cleanString(body.mode) || "GENERAL";

    const chiefComplaint =
      cleanString(body.chiefComplaint);

    const consent =
      body.consent &&
      typeof body.consent === "object"
        ? body.consent
        : {};

    if (!consent.clinicalHistory) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Clinical history consent is required.",
        },
        { status: 400 }
      );
    }

    if (!consent.clinicianSharing) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Clinician-sharing consent is required.",
        },
        { status: 400 }
      );
    }

    if (!chiefComplaint) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please provide the patient's main concern.",
        },
        { status: 400 }
      );
    }

    const hpi =
      body.hpi &&
      typeof body.hpi === "object"
        ? body.hpi
        : {};

    const pastMedicalHistory =
      cleanArray(body.pastMedicalHistory);

    const pastSurgicalHistory =
      cleanArray(body.pastSurgicalHistory);

    const medications =
      cleanArray(body.medications);

    const allergies =
      cleanArray(body.allergies);

    const familyHistory =
      cleanArray(body.familyHistory);

    const personalHistory =
      body.personalHistory &&
      typeof body.personalHistory === "object"
        ? body.personalHistory
        : {};

    const reviewOfSystems =
      body.reviewOfSystems &&
      typeof body.reviewOfSystems === "object"
        ? body.reviewOfSystems
        : {};

    const priorInvestigations =
      cleanArray(body.priorInvestigations);

    const ayush =
      body.ayush &&
      typeof body.ayush === "object"
        ? body.ayush
        : {};

    /*
     * Preserve the REAL uploaded document reference.
     *
     * The clinical-intake page uploads the original file first
     * and sends back its storage URL. We keep that URL here so
     * the clinician verification page can display the actual
     * uploaded document.
     */
    const sourceDocuments =
      Array.isArray(body.sourceDocuments)
        ? body.sourceDocuments
            .filter(
              (document: unknown) =>
                document &&
                typeof document === "object"
            )
            .map(
              (document: {
                name?: unknown;
                type?: unknown;
                url?: unknown;
              }) => ({
                name: cleanString(document.name),
                type: cleanString(document.type),
                url: cleanString(document.url),
              })
            )
            .filter(
              (document: {
                name: string;
                type: string;
                url: string;
              }) => document.name
            )
        : [];

    /*
     * The MedicalRecord schema currently has one primary
     * original-file reference.
     *
     * Therefore, use the first REAL uploaded document as the
     * primary original document for this clinical-intake record.
     *
     * All uploaded documents are still preserved inside
     * sourceDocuments in the interpretation JSON.
     */
    const primarySourceDocument =
      sourceDocuments.find(
        (document: {
          name: string;
          type: string;
          url: string;
        }) => document.url
      ) || null;

    const originalFileUrl =
      primarySourceDocument?.url || null;

    const originalFileType =
      primarySourceDocument?.type || null;

    const redFlags = detectRedFlags(
      collectIntakeText({ chiefComplaint, hpi, reviewOfSystems })
    );

    /*
     * Physician-facing English translation of the patient's own-language
     * answers (PS requirement: clinician-facing text in English/Hindi
     * regardless of what language the patient used). Every clinician
     * console in this app is English-only today, so English is the
     * target. Skipped entirely when the patient already answered in
     * English -- nothing to translate. Best-effort: a failure here
     * (quota, network, etc.) must never block the submission itself.
     */
    const languageNames: Record<string, string> = {
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

    const englishTranslation =
      preferredLanguage !== "en"
        ? await translateIntakeToEnglish(
            {
              chiefComplaint,
              hpi,
              personalHistory,
              reviewOfSystems,
              pastMedicalHistory,
              pastSurgicalHistory,
              medications,
              allergies,
              familyHistory,
              priorInvestigations,
            },
            languageNames[preferredLanguage] || preferredLanguage,
          )
        : null;

    /*
     * Store the complete patient-reported intake as the
     * interpretation/draft.
     *
     * It remains PENDING until a clinician verifies it.
     *
     * The original uploaded document references are retained
     * here as well as on MedicalRecord for clinician access.
     */
    const interpretation = JSON.stringify(
      {
        type: "CLINICAL_INTAKE",
        version: 1,

        preferredLanguage,
        mode,

        chiefComplaint,

        hpi,

        pastMedicalHistory,
        pastSurgicalHistory,
        medications,
        allergies,
        familyHistory,

        personalHistory,

        reviewOfSystems,

        priorInvestigations,

        ayush,

        sourceDocuments,

        redFlags,

        englishTranslation,

        safetyNote:
          "This is a patient-reported clinical intake draft. It is not a diagnosis or treatment recommendation and requires clinician verification.",
      },
      null,
      2
    );

    const medicalRecord =
      await prisma.medicalRecord.create({
        data: {
          patientId: user.id,

          patientName:
            cleanString(user.name) || "Patient",

          documentName:
            "Pre-consultation Clinical Intake",

          documentType:
            "CLINICAL_INTAKE",

          interpretation,

          status: "PENDING",

          /*
           * IMPORTANT:
           * Store the real uploaded document directly on the
           * MedicalRecord so the clinician verification workflow
           * can display it.
           */
          originalFileUrl,

          originalFileType,
        },
      });

    await prisma.verificationAudit.create({
      data: {
        medicalRecordId: medicalRecord.id,
        action: "SUBMITTED",
        note:
          "Patient submitted a pre-consultation clinical intake for clinician verification.",
      },
    });

    /*
     * Mirror the consent checkboxes collected at intake into the
     * auditable consent log, so the consent center reflects real
     * activity rather than only what was embedded in this record's
     * interpretation JSON.
     */
    await prisma.consentEvent.createMany({
      data: [
        {
          patientId: user.id,
          category: "CLINICAL_HISTORY",
          granted: Boolean(consent.clinicalHistory),
          source: "CLINICAL_INTAKE",
          medicalRecordId: medicalRecord.id,
        },
        {
          patientId: user.id,
          category: "DOCUMENT_PROCESSING",
          granted: Boolean(consent.documentProcessing),
          source: "CLINICAL_INTAKE",
          medicalRecordId: medicalRecord.id,
        },
        {
          patientId: user.id,
          category: "CLINICIAN_SHARING",
          granted: Boolean(consent.clinicianSharing),
          source: "CLINICAL_INTAKE",
          medicalRecordId: medicalRecord.id,
        },
      ],
    });

    return NextResponse.json({
      success: true,

      recordId: medicalRecord.id,

      status: "PENDING",

      redFlags,

      message:
        "Clinical intake submitted for clinician verification.",
    });
  } catch (error) {
    console.error(
      "Clinical intake submission failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to submit clinical intake.",
      },
      { status: 500 }
    );
  }
}