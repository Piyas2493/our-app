import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";

import { getCurrentUser } from "@/app/lib/auth";

/* =========================================================
   TYPES
   ========================================================= */

const VALID_VITAL_TYPES = [
  "HEART_RATE",
  "BLOOD_PRESSURE",
  "OXYGEN_SATURATION",
  "TEMPERATURE",
  "WEIGHT",
  "BLOOD_GLUCOSE",
  "STEPS",
  "SLEEP_DURATION",
] as const;

const VALID_SOURCES = [
  "MANUAL",
  "GOOGLE_HEALTH_CONNECT",
  "SAMSUNG_HEALTH",
  "WEARABLE",
  "FITNESS_APP",
] as const;

type VitalType =
  (typeof VALID_VITAL_TYPES)[number];

type VitalSource =
  (typeof VALID_SOURCES)[number];

type IncomingVital = {
  vitalType: VitalType;

  value?: number | null;

  secondaryValue?: number | null;

  unit: string;

  recordedAt?: string;

  source?: VitalSource;

  deviceName?: string | null;

  sourceRecordId?: string | null;

  notes?: string | null;
};

/* =========================================================
   HELPERS
   ========================================================= */

function isValidVitalType(
  value: unknown
): value is VitalType {
  return (
    typeof value === "string" &&
    VALID_VITAL_TYPES.includes(
      value as VitalType
    )
  );
}

function isValidSource(
  value: unknown
): value is VitalSource {
  return (
    typeof value === "string" &&
    VALID_SOURCES.includes(
      value as VitalSource
    )
  );
}

function isFiniteNumber(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function validateVital(
  vital: IncomingVital
): string | null {
  if (
    !isValidVitalType(
      vital.vitalType
    )
  ) {
    return "Invalid vital type.";
  }

  if (
    vital.value !== undefined &&
    vital.value !== null &&
    !isFiniteNumber(
      vital.value
    )
  ) {
    return "Primary vital value must be a valid number.";
  }

  if (
    vital.secondaryValue !==
      undefined &&
    vital.secondaryValue !==
      null &&
    !isFiniteNumber(
      vital.secondaryValue
    )
  ) {
    return "Secondary vital value must be a valid number.";
  }

  if (
    vital.vitalType ===
      "BLOOD_PRESSURE"
  ) {
    if (
      !isFiniteNumber(
        vital.value
      ) ||
      !isFiniteNumber(
        vital.secondaryValue
      )
    ) {
      return "Blood pressure requires systolic and diastolic values.";
    }
  } else {
    if (
      !isFiniteNumber(
        vital.value
      )
    ) {
      return "This vital requires a numeric value.";
    }
  }

  if (
    typeof vital.unit !==
      "string" ||
    !vital.unit.trim()
  ) {
    return "Vital unit is required.";
  }

  if (
    vital.source !==
      undefined &&
    !isValidSource(
      vital.source
    )
  ) {
    return "Invalid vital source.";
  }

  if (
    vital.recordedAt !==
    undefined
  ) {
    const date =
      new Date(
        vital.recordedAt
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "Invalid recordedAt date.";
    }
  }

  return null;
}

/* =========================================================
   GET /api/vitals
   ========================================================= */

export async function GET(
  request: Request
) {
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

    /*
     * Vitals are currently patient-facing.
     */

    if (
      user.role !==
      "PATIENT"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only patients can access their vitals.",
        },
        {
          status: 403,
        }
      );
    }

    const url =
      new URL(request.url);

    const vitalTypeParam =
      url.searchParams.get(
        "vitalType"
      );

    const sourceParam =
      url.searchParams.get(
        "source"
      );

    const startParam =
      url.searchParams.get(
        "start"
      );

    const endParam =
      url.searchParams.get(
        "end"
      );

    const limitParam =
      Number(
        url.searchParams.get(
          "limit"
        ) || "200"
      );

    const limit =
      Number.isFinite(
        limitParam
      )
        ? Math.min(
            Math.max(
              Math.floor(
                limitParam
              ),
              1
            ),
            500
          )
        : 200;

    /*
     * Validate filters.
     */

    if (
      vitalTypeParam &&
      !isValidVitalType(
        vitalTypeParam
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid vitalType filter.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      sourceParam &&
      !isValidSource(
        sourceParam
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid source filter.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Build Prisma filter.
     */

    const where: {
      patientId: string;

      vitalType?: VitalType;

      source?: VitalSource;

      recordedAt?: {
        gte?: Date;
        lte?: Date;
      };
    } = {
      patientId:
        user.id,
    };

    if (
      vitalTypeParam
    ) {
      where.vitalType =
        vitalTypeParam as VitalType;
    }

    if (
      sourceParam
    ) {
      where.source =
        sourceParam as VitalSource;
    }

    /*
     * Optional date range.
     */

    if (
      startParam ||
      endParam
    ) {
      where.recordedAt =
        {};

      if (
        startParam
      ) {
        const start =
          new Date(
            startParam
          );

        if (
          Number.isNaN(
            start.getTime()
          )
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Invalid start date.",
            },
            {
              status: 400,
            }
          );
        }

        where.recordedAt.gte =
          start;
      }

      if (
        endParam
      ) {
        const end =
          new Date(
            endParam
          );

        if (
          Number.isNaN(
            end.getTime()
          )
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Invalid end date.",
            },
            {
              status: 400,
            }
          );
        }

        where.recordedAt.lte =
          end;
      }
    }

    const vitals =
      await prisma.vitalMeasurement.findMany(
        {
          where,

          orderBy: {
            recordedAt:
              "desc",
          },

          take: limit,
        }
      );

    return NextResponse.json({
      success: true,

      vitals,
    });
  } catch (error) {
    console.error(
      "GET /api/vitals failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to load vitals.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   POST /api/vitals
   ========================================================= */

export async function POST(
  request: Request
) {
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

    /*
     * Patients own their manually-entered vitals.
     * The same endpoint also supports future
     * authenticated ingestion from health platforms.
     */

    if (
      user.role !==
      "PATIENT"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only patients can add vitals.",
        },
        {
          status: 403,
        }
      );
    }

    let body: any;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid JSON request.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Supports:
     *
     * 1. A single measurement
     *
     * {
     *   vitalType: "...",
     *   value: 76
     * }
     *
     * 2. Batch measurements
     *
     * {
     *   measurements: [
     *     {...},
     *     {...}
     *   ]
     * }
     *
     * Batch mode will become useful for importing
     * data from external health providers.
     */

    const measurements =
      Array.isArray(
        body?.measurements
      )
        ? body.measurements
        : [body];

    if (
      measurements.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "At least one vital measurement is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      measurements.length >
      500
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Maximum 500 measurements per request.",
        },
        {
          status: 400,
        }
      );
    }

    const validated:
      IncomingVital[] =
      [];

    /*
     * Validate every incoming measurement
     * before creating anything.
     */

    for (
      const measurement of
        measurements
    ) {
      const vital =
        measurement as IncomingVital;

      const validationError =
        validateVital(
          vital
        );

      if (
        validationError
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              validationError,
          },
          {
            status: 400,
          }
        );
      }

      validated.push(
        vital
      );
    }

    /*
     * Create all measurements atomically.
     */

    const created =
      await prisma.$transaction(
        async (tx) => {
          const results = [];

          for (
            const vital of
              validated
          ) {
            const recordedAt =
              vital.recordedAt
                ? new Date(
                    vital.recordedAt
                  )
                : new Date();

            const result =
              await tx.vitalMeasurement.create(
                {
                  data: {
                    patientId:
                      user.id,

                    vitalType:
                      vital.vitalType,

                    value:
                      vital.value ??
                      null,

                    secondaryValue:
                      vital.secondaryValue ??
                      null,

                    unit:
                      vital.unit.trim(),

                    recordedAt,

                    source:
                      vital.source ??
                      "MANUAL",

                    deviceName:
                      vital.deviceName ??
                      null,

                    sourceRecordId:
                      vital.sourceRecordId ??
                      null,

                    notes:
                      vital.notes ??
                      null,
                  },
                }
              );

            results.push(
              result
            );
          }

          return results;
        }
      );

    return NextResponse.json(
      {
        success: true,

        message:
          created.length ===
          1
            ? "Vital measurement saved."
            : `${created.length} vital measurements saved.`,

        vitals: created,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST /api/vitals failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to save vital measurements.",
      },
      {
        status: 500,
      }
    );
  }
}