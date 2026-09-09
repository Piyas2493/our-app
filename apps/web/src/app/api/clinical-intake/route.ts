import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/auth";

export const runtime = "nodejs";

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

function buildRedFlags(payload: {
  chiefComplaint: string;
  hpi: Record<string, unknown>;
  reviewOfSystems: Record<string, unknown>;
}): string[] {
  const text = [
    payload.chiefComplaint,
    ...Object.values(payload.hpi),
    ...Object.values(payload.reviewOfSystems),
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  const flags: string[] = [];

  const patterns = [
    {
      label: "Chest pain or chest pressure reported.",
      terms: ["chest pain", "chest pressure", "pain in chest"],
    },
    {
      label: "Severe breathing difficulty reported.",
      terms: [
        "severe breathlessness",
        "severe shortness of breath",
        "can't breathe",
        "cannot breathe",
        "difficulty breathing",
      ],
    },
    {
      label: "Loss of consciousness or fainting reported.",
      terms: ["unconscious", "loss of consciousness", "fainted", "fainting"],
    },
    {
      label: "Possible acute neurological symptom reported.",
      terms: [
        "face drooping",
        "facial droop",
        "slurred speech",
        "sudden weakness",
        "sudden numbness",
        "unable to speak",
        "seizure",
      ],
    },
    {
      label: "Severe bleeding reported.",
      terms: [
        "severe bleeding",
        "heavy bleeding",
        "vomiting blood",
        "blood vomiting",
        "coughing blood",
      ],
    },
  ];

  for (const pattern of patterns) {
    if (pattern.terms.some((term) => text.includes(term))) {
      flags.push(pattern.label);
    }
  }

  return Array.from(new Set(flags));
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

    const redFlags = buildRedFlags({
      chiefComplaint,
      hpi,
      reviewOfSystems,
    });

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