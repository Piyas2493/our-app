import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/auth";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest
) {
  try {
    await requireRole("CLINICIAN");

    const patientId =
      request.nextUrl.searchParams.get(
        "patientId"
      );

    if (!patientId) {
      return NextResponse.json(
        {
          success: false,
          error: "Patient ID is required.",
        },
        { status: 400 }
      );
    }

    const patient =
      await prisma.user.findUnique({
        where: {
          id: patientId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

    if (
      !patient ||
      patient.role !== "PATIENT"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Patient not found.",
        },
        { status: 404 }
      );
    }

    const [
      records,
      vitals,
    ] = await Promise.all([
      prisma.medicalRecord.findMany({
        where: {
          patientId,
        },

        include: {
          medications: true,

          verificationAudits: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.vitalMeasurement.findMany({
        where: {
          patientId,
        },

        orderBy: {
          recordedAt: "desc",
        },

        take: 100,
      }),
    ]);

    return NextResponse.json({
      success: true,

      patient,

      records,

      vitals,
    });
  } catch (error) {
    console.error(
      "Unable to load clinician patient snapshot:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to load patient snapshot.";

    if (
      message ===
      "AUTHENTICATION_REQUIRED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    if (
      message === "FORBIDDEN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only clinicians can access patient snapshots.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to load patient snapshot.",
      },
      { status: 500 }
    );
  }
}