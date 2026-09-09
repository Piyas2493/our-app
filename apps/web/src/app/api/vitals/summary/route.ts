import { NextResponse } from "next/server";

import {
  getCurrentUser,
} from "@/app/lib/auth";

import { prisma } from "@/app/lib/prisma";

import {
  buildVitalHealthSummary,
} from "@/app/lib/vitalAnalytics";

export async function GET() {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      user.role !==
      "PATIENT"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only patients can access their health summary.",
        },
        {
          status: 403,
        }
      );
    }

    const vitals =
      await prisma.vitalMeasurement.findMany(
        {
          where: {
            patientId:
              user.id,
          },

          orderBy: {
            recordedAt:
              "desc",
          },

          take: 500,
        }
      );

    const summary =
      buildVitalHealthSummary(
        vitals
      );

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error(
      "GET /api/vitals/summary failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to calculate health summary.",
      },
      {
        status: 500,
      }
    );
  }
}