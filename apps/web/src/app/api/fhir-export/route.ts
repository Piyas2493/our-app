import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/auth";

export const runtime = "nodejs";

/*
 * GET /api/fhir-export
 *
 * A minimal FHIR-*shaped* Patient + DocumentReference bundle for the
 * signed-in patient. This is a starting point, not a certified ABDM/FHIR
 * integration -- real interoperability needs ABDM sandbox credentials
 * and a proper conformance pass, which is out of scope for the deadline.
 * It exists so the "interoperable records" requirement isn't a dead nav
 * item pointing at nothing.
 */
function docStatus(status: string): string {
  if (status === "VERIFIED") return "final";
  if (status === "REJECTED") return "entered-in-error";
  return "preliminary";
}

export async function GET() {
  try {
    const patient = await requireRole("PATIENT");

    const records = await prisma.medicalRecord.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: "desc" },
    });

    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: patient.id,
            name: [{ text: patient.name }],
            telecom: [{ system: "email", value: patient.email }],
          },
        },
        ...records.map((record) => ({
          resource: {
            resourceType: "DocumentReference",
            id: record.id,
            status: "current",
            docStatus: docStatus(record.status),
            type: { text: record.documentType },
            subject: { reference: `Patient/${patient.id}` },
            date: record.createdAt.toISOString(),
            description: record.documentName,
            content: record.originalFileUrl
              ? [
                  {
                    attachment: {
                      url: record.originalFileUrl,
                      contentType: record.originalFileType || undefined,
                    },
                  },
                ]
              : [],
          },
        })),
      ],
    };

    return NextResponse.json(bundle);
  } catch (error) {
    console.error("Unable to build FHIR export:", error);
    return NextResponse.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            diagnostics: error instanceof Error ? error.message : "Unable to build FHIR export.",
          },
        ],
      },
      { status: 500 }
    );
  }
}
