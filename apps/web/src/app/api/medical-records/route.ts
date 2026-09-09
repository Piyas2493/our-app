import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";

export const runtime = "nodejs";

function buildRedFlags(interpretation: string): string[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(interpretation);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  const record = parsed as {
    chiefComplaint?: unknown;
    hpi?: unknown;
    reviewOfSystems?: unknown;
  };

  const text = [
    record.chiefComplaint,
    ...(record.hpi && typeof record.hpi === "object"
      ? Object.values(record.hpi as Record<string, unknown>)
      : []),
    ...(record.reviewOfSystems && typeof record.reviewOfSystems === "object"
      ? Object.values(record.reviewOfSystems as Record<string, unknown>)
      : []),
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

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

  const flags: string[] = [];

  for (const pattern of patterns) {
    if (pattern.terms.some((term) => text.includes(term))) {
      flags.push(pattern.label);
    }
  }

  return Array.from(new Set(flags));
}

/* =========================================================
   GET
   PATIENT  -> only their own records
   CLINICIAN -> the full verification queue
   ========================================================= */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    const records = await prisma.medicalRecord.findMany({
      where:
        user.role === "PATIENT"
          ? { patientId: user.id }
          : undefined,
      include: {
        medications: true,
        labReport: {
          include: {
            lab: true,
            labOrder: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const audits = await prisma.verificationAudit.findMany({
      where: {
        medicalRecordId: {
          in: records.map((record) => record.id),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const recordsWithAudits = records.map((record) => ({
      ...record,
      verificationAudits: audits.filter(
        (audit) => audit.medicalRecordId === record.id
      ),
    }));

    return NextResponse.json({
      success: true,
      records: recordsWithAudits,
    });
  } catch (error) {
    console.error("Unable to fetch medical records:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to fetch medical records.",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST
   Create a new medical record.
   Only an authenticated patient may submit a new document,
   and it is always attached to their own account.
   ========================================================= */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    if (user.role !== "PATIENT") {
      return NextResponse.json(
        {
          success: false,
          error: "Only patients can submit new medical documents.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      patientName,
      documentName,
      documentType,
      interpretation,
      medications = [],
      originalFileUrl,
      originalFileType,
    } = body;

    if (!documentName || !documentType) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Document name and document type are required.",
        },
        { status: 400 }
      );
    }

    const medicalRecord =
      await prisma.medicalRecord.create({
        data: {
          patientId: user.id,

          patientName:
            typeof patientName === "string" && patientName.trim()
              ? patientName.trim()
              : user.name || "Patient",

          documentName,

          documentType,

          interpretation:
            interpretation ||
            "AI extracted information from the uploaded medical document.",

          status: "PENDING",

          originalFileUrl:
            typeof originalFileUrl === "string" &&
            originalFileUrl.trim()
              ? originalFileUrl.trim()
              : null,

          originalFileType:
            typeof originalFileType === "string" &&
            originalFileType.trim()
              ? originalFileType.trim()
              : null,

          medications: {
            create:
              Array.isArray(medications)
                ? medications
                    .filter(
                      (medication) =>
                        medication &&
                        typeof medication.name === "string" &&
                        medication.name.trim().length > 0
                    )
                    .map((medication) => ({
                      name: medication.name.trim(),

                      dosage:
                        typeof medication.dosage === "string" &&
                        medication.dosage.trim()
                          ? medication.dosage.trim()
                          : null,

                      frequency:
                        typeof medication.frequency === "string" &&
                        medication.frequency.trim()
                          ? medication.frequency.trim()
                          : null,

                      duration:
                        typeof medication.duration === "string" &&
                        medication.duration.trim()
                          ? medication.duration.trim()
                          : null,
                    }))
                : [],
          },
        },

        include: {
          medications: true,
        },
      });

    /* -------------------------------------------------------
       Create initial audit event
       ------------------------------------------------------- */

    const audit =
      await prisma.verificationAudit.create({
        data: {
          medicalRecordId: medicalRecord.id,
          action: "SUBMITTED",
          note:
            "Medical document submitted for clinician verification.",
        },
      });

    return NextResponse.json(
      {
        success: true,

        record: {
          ...medicalRecord,
          verificationAudits: [audit],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unable to create medical record:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to create medical record.",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   PATCH
   Two distinct, role-scoped transitions:

   CLINICIAN  -> PENDING to VERIFIED or REJECTED
                 (any record; that is the review queue)

   PATIENT    -> their OWN REJECTED record back to PENDING
                 (a corrected resubmission; nothing else)
   ========================================================= */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      id,
      interpretation,
      medications = [],
      status,
      correctionNote,
      originalFileUrl,
      originalFileType,
      documentName,
      documentType,
    } = body;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Medical record ID is required.",
        },
        { status: 400 }
      );
    }

    if (
      status !== "VERIFIED" &&
      status !== "REJECTED" &&
      status !== "PENDING"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid medical record status.",
        },
        { status: 400 }
      );
    }

    if (
      (status === "VERIFIED" || status === "REJECTED") &&
      user.role !== "CLINICIAN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Only clinicians can verify or reject a medical record.",
        },
        { status: 403 }
      );
    }

    if (
      status === "REJECTED" &&
      (!correctionNote || correctionNote.trim().length === 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A correction note is required when sending the record back.",
        },
        { status: 400 }
      );
    }

    const existingRecordForAuth =
      await prisma.medicalRecord.findUnique({
        where: { id },
        select: { status: true, patientId: true },
      });

    if (!existingRecordForAuth) {
      return NextResponse.json(
        { success: false, error: "Medical record not found." },
        { status: 404 }
      );
    }

    if (status === "PENDING") {
      if (user.role !== "PATIENT") {
        return NextResponse.json(
          {
            success: false,
            error: "Only the owning patient can resubmit a record.",
          },
          { status: 403 }
        );
      }

      if (existingRecordForAuth.patientId !== user.id) {
        return NextResponse.json(
          { success: false, error: "This record does not belong to you." },
          { status: 403 }
        );
      }

      if (existingRecordForAuth.status !== "REJECTED") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Only a record sent back for correction can be resubmitted.",
          },
          { status: 409 }
        );
      }
    }

    const redFlags =
      status === "PENDING" && typeof interpretation === "string"
        ? buildRedFlags(interpretation)
        : undefined;

    const updatedRecord =
      await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const existingRecord =
            await tx.medicalRecord.findUnique({
              where: { id },
              select: { status: true },
            });

          if (!existingRecord) {
            throw new Error("Medical record not found.");
          }

          let auditAction = "STATUS_UPDATED";
          let auditNote = "Medical record status updated.";

          if (status === "VERIFIED") {
            auditAction = "VERIFIED";
            auditNote =
              "Clinician reviewed the original document and AI draft and verified the record.";
          } else if (status === "REJECTED") {
            auditAction = "SENT_BACK_FOR_CORRECTION";
            auditNote = correctionNote.trim();
          } else if (
            status === "PENDING" &&
            existingRecord.status === "REJECTED"
          ) {
            auditAction = "RESUBMITTED";
            auditNote =
              "Corrected medical document resubmitted for clinician verification.";
          }

          await tx.medication.deleteMany({
            where: { medicalRecordId: id },
          });

          const record = await tx.medicalRecord.update({
            where: { id },

            data: {
              interpretation:
                interpretation ||
                "AI extracted information from the uploaded medical document.",

              status,

              verifiedAt:
                status === "VERIFIED" ? new Date() : null,

              rejectionReason:
                status === "REJECTED" ? correctionNote.trim() : null,

              documentName:
                typeof documentName === "string" && documentName.trim()
                  ? documentName.trim()
                  : undefined,

              documentType:
                typeof documentType === "string" && documentType.trim()
                  ? documentType.trim()
                  : undefined,

              originalFileUrl:
                typeof originalFileUrl === "string" && originalFileUrl.trim()
                  ? originalFileUrl.trim()
                  : undefined,

              originalFileType:
                typeof originalFileType === "string" &&
                originalFileType.trim()
                  ? originalFileType.trim()
                  : undefined,

              medications: {
                create: Array.isArray(medications)
                  ? medications
                      .filter(
                        (medication) =>
                          medication &&
                          typeof medication.name === "string" &&
                          medication.name.trim().length > 0
                      )
                      .map((medication) => ({
                        name: medication.name.trim(),

                        dosage:
                          typeof medication.dosage === "string" &&
                          medication.dosage.trim()
                            ? medication.dosage.trim()
                            : null,

                        frequency:
                          typeof medication.frequency === "string" &&
                          medication.frequency.trim()
                            ? medication.frequency.trim()
                            : null,

                        duration:
                          typeof medication.duration === "string" &&
                          medication.duration.trim()
                            ? medication.duration.trim()
                            : null,
                      }))
                  : [],
              },
            },

            include: {
              medications: true,
            },
          });

          await tx.verificationAudit.create({
            data: {
              medicalRecordId: id,
              action: auditAction,
              note: auditNote,
            },
          });

          const verificationAudits =
            await tx.verificationAudit.findMany({
              where: { medicalRecordId: id },
              orderBy: { createdAt: "desc" },
            });

          return {
            ...record,
            verificationAudits,
          };
        }
      );

    return NextResponse.json({
      success: true,
      record: updatedRecord,
      redFlags,
    });
  } catch (error) {
    console.error("Unable to update medical record:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to update medical record.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
