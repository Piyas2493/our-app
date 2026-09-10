import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/auth";

export const runtime = "nodejs";

/* =========================================================
   HELPERS
   ========================================================= */

function isValidTime(hour: unknown, minute: unknown) {
  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    Number(hour) >= 0 &&
    Number(hour) <= 23 &&
    Number(minute) >= 0 &&
    Number(minute) <= 59
  );
}

function normalizeDate(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/* =========================================================
   GET
   Patient → verified medications + reminders + logs
   ========================================================= */

export async function GET() {
  try {
    const user = await requireRole("PATIENT");

    const medications =
      await prisma.medication.findMany({
        where: {
          medicalRecord: {
            patientId: user.id,
            status: "VERIFIED",
          },
        },

        orderBy: {
          createdAt: "desc",
        },

        include: {
          medicalRecord: {
            select: {
              id: true,
              documentName: true,
              documentType: true,
              verifiedAt: true,
              status: true,
            },
          },

          reminders: {
            orderBy: [
              {
                hour: "asc",
              },
              {
                minute: "asc",
              },
            ],

            include: {
              logs: {
                orderBy: {
                  scheduledAt: "desc",
                },

                take: 30,
              },
            },
          },
        },
      });

    return NextResponse.json({
      success: true,
      medications,
    });
  } catch (error) {
    console.error(
      "Unable to fetch medications:",
      error
    );

    if (
      error instanceof Error &&
      error.message === "AUTHENTICATION_REQUIRED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "FORBIDDEN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only patients can access medication reminders.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to fetch medications.",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST
   Create a reminder for a verified medication
   ========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    const user = await requireRole("PATIENT");

    const body = await request.json();

    const {
      medicationId,
      hour,
      minute,
    } = body;

    if (!medicationId) {
      return NextResponse.json(
        {
          success: false,
          error: "Medication ID is required.",
        },
        { status: 400 }
      );
    }

    const numericHour =
      Number(hour);

    const numericMinute =
      Number(minute);

    if (
      !isValidTime(
        numericHour,
        numericMinute
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid reminder time is required.",
        },
        { status: 400 }
      );
    }

    /*
     * Only medications belonging to the
     * authenticated patient AND attached to
     * a clinician-verified medical record
     * can receive reminders.
     */
    const medication =
      await prisma.medication.findFirst({
        where: {
          id: medicationId,

          medicalRecord: {
            patientId: user.id,
            status: "VERIFIED",
          },
        },

        include: {
          medicalRecord: {
            select: {
              id: true,
              documentName: true,
              documentType: true,
              status: true,
            },
          },
        },
      });

    if (!medication) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Medication not found or is not linked to a clinician-verified record.",
        },
        { status: 404 }
      );
    }

    /*
     * Avoid duplicate reminders at the exact
     * same time for the same medication.
     */
    const existingReminder =
      await prisma.medicationReminder.findFirst({
        where: {
          medicationId,
          hour: numericHour,
          minute: numericMinute,
        },
      });

    if (existingReminder) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A reminder already exists for this time.",
          reminder: existingReminder,
        },
        { status: 409 }
      );
    }

    const reminder =
      await prisma.medicationReminder.create({
        data: {
          medicationId,
          hour: numericHour,
          minute: numericMinute,
          status: "ACTIVE",
        },

        include: {
          medication: {
            include: {
              medicalRecord: {
                select: {
                  id: true,
                  documentName: true,
                  documentType: true,
                  status: true,
                },
              },
            },
          },
        },
      });

    return NextResponse.json(
      {
        success: true,
        reminder,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Unable to create medication reminder:",
      error
    );

    if (
      error instanceof Error &&
      error.message === "AUTHENTICATION_REQUIRED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "FORBIDDEN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only patients can create medication reminders.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to create medication reminder.",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   PATCH
   Actions:

   TAKEN
   SKIPPED
   SNOOZE
   DISABLE
   ENABLE
   ========================================================= */

export async function PATCH(
  request: NextRequest
) {
  try {
    const user = await requireRole("PATIENT");

    const body = await request.json();

    const {
      reminderId,
      action,
      scheduledAt,
      snoozeMinutes,
    } = body;

    if (!reminderId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Reminder ID is required.",
        },
        { status: 400 }
      );
    }

    const allowedActions = [
      "TAKEN",
      "SKIPPED",
      "SNOOZE",
      "DISABLE",
      "ENABLE",
    ];

    if (
      !allowedActions.includes(action)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid medication reminder action.",
        },
        { status: 400 }
      );
    }

    /*
     * Verify that the reminder belongs to
     * this patient through a clinician-verified
     * medical record.
     */
    const reminder =
      await prisma.medicationReminder.findFirst({
        where: {
          id: reminderId,

          medication: {
            medicalRecord: {
              patientId: user.id,
              status: "VERIFIED",
            },
          },
        },

        include: {
          medication: {
            include: {
              medicalRecord: {
                select: {
                  id: true,
                  documentName: true,
                  documentType: true,
                  status: true,
                },
              },
            },
          },
        },
      });

    if (!reminder) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Reminder not found or is not accessible.",
        },
        { status: 404 }
      );
    }

    /* =====================================================
       DISABLE
       ===================================================== */

    if (action === "DISABLE") {
      const updatedReminder =
        await prisma.medicationReminder.update({
          where: {
            id: reminderId,
          },

          data: {
            status: "DISABLED",
          },
        });

      return NextResponse.json({
        success: true,
        action: "DISABLE",
        reminder: updatedReminder,
      });
    }

    /* =====================================================
       ENABLE
       ===================================================== */

    if (action === "ENABLE") {
      const updatedReminder =
        await prisma.medicationReminder.update({
          where: {
            id: reminderId,
          },

          data: {
            status: "ACTIVE",
          },
        });

      return NextResponse.json({
        success: true,
        action: "ENABLE",
        reminder: updatedReminder,
      });
    }

    /*
     * Taken / Skip / Snooze require a scheduled
     * occurrence.
     */
    const occurrenceDate =
      normalizeDate(scheduledAt);

    if (!occurrenceDate) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid scheduledAt value is required.",
        },
        { status: 400 }
      );
    }

    /* =====================================================
       SNOOZE
       ===================================================== */

    if (action === "SNOOZE") {
      const minutes =
        Number(snoozeMinutes);

      if (
        !Number.isInteger(minutes) ||
        minutes <= 0 ||
        minutes > 24 * 60
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Snooze duration must be between 1 and 1440 minutes.",
          },
          { status: 400 }
        );
      }

      const snoozedUntil =
        new Date(
          occurrenceDate.getTime() +
            minutes * 60 * 1000
        );

      /*
       * Look for the existing log for this
       * exact scheduled occurrence.
       */
      const existingLog =
        await prisma.medicationLog.findFirst({
          where: {
            reminderId,
            userId: user.id,
            scheduledAt:
              occurrenceDate,
          },
        });

      let log;

      if (existingLog) {
        log =
          await prisma.medicationLog.update({
            where: {
              id: existingLog.id,
            },

            data: {
              status: "SNOOZED",
              snoozedUntil,
              actionAt: new Date(),
            },
          });
      } else {
        log =
          await prisma.medicationLog.create({
            data: {
              reminderId,
              userId: user.id,
              scheduledAt:
                occurrenceDate,
              status: "SNOOZED",
              snoozedUntil,
              actionAt: new Date(),
            },
          });
      }

      return NextResponse.json({
        success: true,
        action: "SNOOZE",
        log,
      });
    }

    /* =====================================================
       TAKEN / SKIPPED
       ===================================================== */

    const finalStatus =
      action === "TAKEN"
        ? "TAKEN"
        : "SKIPPED";

    const existingLog =
      await prisma.medicationLog.findFirst({
        where: {
          reminderId,
          userId: user.id,
          scheduledAt:
            occurrenceDate,
        },
      });

    let log;

    if (existingLog) {
      log =
        await prisma.medicationLog.update({
          where: {
            id: existingLog.id,
          },

          data: {
            status:
              finalStatus,

            actionAt:
              new Date(),

            snoozedUntil:
              null,
          },
        });
    } else {
      log =
        await prisma.medicationLog.create({
          data: {
            reminderId,
            userId: user.id,
            scheduledAt:
              occurrenceDate,

            status:
              finalStatus,

            actionAt:
              new Date(),

            snoozedUntil:
              null,
          },
        });
    }

    return NextResponse.json({
      success: true,
      action,
      log,
    });
  } catch (error) {
    console.error(
      "Unable to update medication reminder:",
      error
    );

    if (
      error instanceof Error &&
      error.message === "AUTHENTICATION_REQUIRED"
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
      error instanceof Error &&
      error.message === "FORBIDDEN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only patients can update medication reminders.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to update medication reminder.",
      },
      { status: 500 }
    );
  }
}