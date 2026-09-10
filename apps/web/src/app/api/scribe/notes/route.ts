import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/auth";

export const runtime = "nodejs";

/* =========================================================
   POST /api/scribe/notes
   Saves a clinician-authored, clinician-reviewed SOAP note to
   the patient's record. Unlike patient-submitted intake, this
   is authored and signed off by the treating clinician
   themselves, so it is stored as VERIFIED immediately rather
   than entering the PENDING verification queue -- there is no
   second clinician to verify a clinician's own consultation
   note against.
   ========================================================= */

export async function POST(request: NextRequest) {
  try {
    const clinician = await requireRole("CLINICIAN");

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request." },
        { status: 400 },
      );
    }

    const { patientId, rawNotes, soap } = (body ?? {}) as {
      patientId?: unknown;
      rawNotes?: unknown;
      soap?: {
        subjective?: unknown;
        objective?: unknown;
        assessment?: unknown;
        plan?: unknown;
      };
    };

    const cleanPatientId = typeof patientId === "string" ? patientId.trim() : "";

    if (!cleanPatientId) {
      return NextResponse.json(
        { success: false, error: "A patient must be selected." },
        { status: 400 },
      );
    }

    const patient = await prisma.user.findUnique({
      where: { id: cleanPatientId },
      select: { id: true, name: true, role: true },
    });

    if (!patient || patient.role !== "PATIENT") {
      return NextResponse.json(
        { success: false, error: "Patient not found." },
        { status: 404 },
      );
    }

    const subjective = typeof soap?.subjective === "string" ? soap.subjective.trim() : "";
    const objective = typeof soap?.objective === "string" ? soap.objective.trim() : "";
    const assessment = typeof soap?.assessment === "string" ? soap.assessment.trim() : "";
    const plan = typeof soap?.plan === "string" ? soap.plan.trim() : "";

    if (!subjective && !objective && !assessment && !plan) {
      return NextResponse.json(
        { success: false, error: "The note is empty." },
        { status: 400 },
      );
    }

    const summaryParts = [
      subjective && `S: ${subjective}`,
      objective && `O: ${objective}`,
      assessment && `A: ${assessment}`,
      plan && `P: ${plan}`,
    ].filter(Boolean);

    const interpretation = JSON.stringify(
      {
        type: "CLINICIAN_SCRIBE_NOTE",
        version: 1,
        authoredBy: { id: clinician.id, name: clinician.name },
        rawNotes: typeof rawNotes === "string" ? rawNotes.trim() : "",
        soap: { subjective, objective, assessment, plan },
        safetyNote:
          "Clinician-authored consultation note, structured with AI assistance and reviewed by the treating clinician before saving.",
      },
      null,
      2,
    );

    const medicalRecord = await prisma.medicalRecord.create({
      data: {
        patientId: patient.id,
        patientName: patient.name,
        documentName: `Consultation note — ${new Date().toISOString().slice(0, 10)}`,
        documentType: "CLINICIAN_SCRIBE_NOTE",
        interpretation,
        status: "VERIFIED",
        verifiedAt: new Date(),
      },
    });

    await prisma.verificationAudit.create({
      data: {
        medicalRecordId: medicalRecord.id,
        clinicianId: clinician.id,
        action: "VERIFIED",
        note: `Consultation note authored and saved by Dr. ${clinician.name} via AI Medical Scribe. Summary: ${summaryParts.join(" · ") || "(no summary)"}`,
      },
    });

    return NextResponse.json(
      { success: true, message: "Note saved to patient record.", recordId: medicalRecord.id },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("POST /api/scribe/notes failed:", error);

    if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: "Only clinicians can save scribe notes." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Unable to save this note." },
      { status: 500 },
    );
  }
}
