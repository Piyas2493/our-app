import type {
  VitalSource,
  VitalType,
} from "@prisma/client";

/* =========================================================
   TYPES
   ========================================================= */

export type VitalAnalyticsInput = {
  id: string;

  vitalType: VitalType;

  value: number | null;

  secondaryValue: number | null;

  unit: string;

  recordedAt: Date;

  source: VitalSource;

  deviceName: string | null;

  notes: string | null;
};

export type VitalValidationResult = {
  valid: boolean;

  error: string | null;
};

export type VitalTrend = {
  vitalType: VitalType;

  label: string;

  unit: string;

  latestValue: number | null;

  latestSecondaryValue: number | null;

  previousValue: number | null;

  previousSecondaryValue: number | null;

  averageValue: number | null;

  count: number;

  changePercent: number | null;

  direction:
    | "UP"
    | "DOWN"
    | "STABLE"
    | "INSUFFICIENT_DATA";

  interpretation:
    | "GOOD"
    | "ATTENTION"
    | "NEUTRAL";
};

export type HealthScoreComponent = {
  vitalType: VitalType;

  label: string;

  score: number;

  weight: number;

  reason: string;
};

export type VitalHealthSummary = {
  healthScore: number;

  dataCoverageScore: number;

  measurementsCount: number;

  vitalTypesTracked: number;

  components: HealthScoreComponent[];

  trends: VitalTrend[];

  overallSummary: string;

  limitations: string[];
};

/* =========================================================
   LABELS
   ========================================================= */

export function getVitalLabel(
  type: VitalType
) {
  switch (type) {
    case "HEART_RATE":
      return "Heart Rate";

    case "BLOOD_PRESSURE":
      return "Blood Pressure";

    case "OXYGEN_SATURATION":
      return "Oxygen Saturation";

    case "TEMPERATURE":
      return "Temperature";

    case "WEIGHT":
      return "Weight";

    case "BLOOD_GLUCOSE":
      return "Blood Glucose";

    case "STEPS":
      return "Steps";

    case "SLEEP_DURATION":
      return "Sleep Duration";

    default:
      return type;
  }
}

/* =========================================================
   VALIDATION
   ========================================================= */

export function validateVitalMeasurement(
  vitalType: VitalType,
  value: number | null,
  secondaryValue: number | null
): VitalValidationResult {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return {
      valid: false,
      error:
        "A valid numeric measurement is required.",
    };
  }

  switch (vitalType) {
    case "BLOOD_PRESSURE": {
      if (
        secondaryValue === null ||
        !Number.isFinite(
          secondaryValue
        )
      ) {
        return {
          valid: false,
          error:
            "Blood pressure requires systolic and diastolic values.",
        };
      }

      if (
        value <=
        secondaryValue
      ) {
        return {
          valid: false,
          error:
            "Systolic pressure must be greater than diastolic pressure.",
        };
      }

      if (
        value < 50 ||
        value > 300
      ) {
        return {
          valid: false,
          error:
            "Systolic blood pressure must be between 50 and 300 mmHg.",
        };
      }

      if (
        secondaryValue <
          20 ||
        secondaryValue >
          200
      ) {
        return {
          valid: false,
          error:
            "Diastolic blood pressure must be between 20 and 200 mmHg.",
        };
      }

      return {
        valid: true,
        error: null,
      };
    }

    case "HEART_RATE":
      if (
        value < 20 ||
        value > 250
      ) {
        return {
          valid: false,
          error:
            "Heart rate must be between 20 and 250 bpm.",
        };
      }

      return {
        valid: true,
        error: null,
      };

    case "OXYGEN_SATURATION":
      if (
        value < 50 ||
        value > 100
      ) {
        return {
          valid: false,
          error:
            "Oxygen saturation must be between 50% and 100%.",
        };
      }

      return {
        valid: true,
        error: null,
      };

    case "TEMPERATURE":
      if (
        value < 85 ||
        value > 110
      ) {
        return {
          valid: false,
          error:
            "Temperature must be between 85°F and 110°F.",
        };
      }

      return {
        valid: true,
        error: null,
      };

    case "WEIGHT":
      if (
        value <= 0 ||
        value > 500
      ) {
        return {
          valid: false,
          error:
            "Weight must be greater than 0 and no more than 500 kg.",
        };
      }

      return {
        valid: true,
        error: null,
      };

    case "BLOOD_GLUCOSE":
      if (
        value < 20 ||
        value > 1000
      ) {
        return {
          valid: false,
          error:
            "Blood glucose must be between 20 and 1000 mg/dL.",
        };
      }

      return {
        valid: true,
        error: null,
      };

    case "STEPS":
      if (
        value < 0 ||
        value > 200000
      ) {
        return {
          valid: false,
          error:
            "Steps must be between 0 and 200,000.",
        };
      }

      return {
        valid: true,
        error: null,
      };

    case "SLEEP_DURATION":
      if (
        value < 0 ||
        value > 24
      ) {
        return {
          valid: false,
          error:
            "Sleep duration must be between 0 and 24 hours.",
        };
      }

      return {
        valid: true,
        error: null,
      };

    default:
      return {
        valid: true,
        error: null,
      };
  }
}

/* =========================================================
   INTERNAL VALIDITY CHECK
   ========================================================= */

function isValidStoredVital(
  vital: VitalAnalyticsInput
) {
  return validateVitalMeasurement(
    vital.vitalType,
    vital.value,
    vital.secondaryValue
  ).valid;
}

/* =========================================================
   SCORE ONE VITAL
   ========================================================= */

export function scoreVital(
  vital: VitalAnalyticsInput
) {
  const value =
    vital.value;

  const secondary =
    vital.secondaryValue;

  if (
    value === null ||
    value === undefined
  ) {
    return {
      score: 50,

      interpretation:
        "NEUTRAL" as const,

      reason:
        "No numeric value is available.",
    };
  }

  switch (
    vital.vitalType
  ) {
    case "BLOOD_PRESSURE": {
      if (
        secondary ===
          null ||
        secondary ===
          undefined
      ) {
        return {
          score: 50,

          interpretation:
            "NEUTRAL" as const,

          reason:
            "Both systolic and diastolic values are needed.",
        };
      }

      if (
        value < 90 ||
        secondary < 60
      ) {
        return {
          score: 55,

          interpretation:
            "ATTENTION" as const,

          reason:
            "The recorded blood pressure is below a commonly used reference range.",
        };
      }

      if (
        value < 120 &&
        secondary < 80
      ) {
        return {
          score: 92,

          interpretation:
            "GOOD" as const,

          reason:
            "The reading falls within a commonly used healthy reference range.",
        };
      }

      if (
        value < 130 &&
        secondary < 80
      ) {
        return {
          score: 82,

          interpretation:
            "NEUTRAL" as const,

          reason:
            "The systolic value is slightly above the optimal reference level.",
        };
      }

      if (
        value < 140 &&
        secondary < 90
      ) {
        return {
          score: 68,

          interpretation:
            "ATTENTION" as const,

          reason:
            "The reading is above a commonly used normal reference range.",
        };
      }

      return {
        score: 50,

        interpretation:
          "ATTENTION" as const,

        reason:
          "The recorded blood pressure is elevated relative to common reference ranges.",
      };
    }

    case "HEART_RATE": {
      if (
        value < 60
      ) {
        return {
          score: 72,

          interpretation:
            "ATTENTION" as const,

          reason:
            "The recorded resting heart rate is below the common adult resting range.",
        };
      }

      if (
        value <= 100
      ) {
        return {
          score: 92,

          interpretation:
            "GOOD" as const,

          reason:
            "The value is within the common adult resting reference range.",
        };
      }

      return {
        score: 65,

        interpretation:
          "ATTENTION" as const,

        reason:
          "The heart rate is elevated relative to the common resting range.",
      };
    }

    case "OXYGEN_SATURATION": {
      if (
        value >= 95
      ) {
        return {
          score: 95,

          interpretation:
            "GOOD" as const,

          reason:
            "The oxygen saturation is within a commonly expected range.",
        };
      }

      if (
        value >= 90
      ) {
        return {
          score: 60,

          interpretation:
            "ATTENTION" as const,

          reason:
            "The oxygen saturation is below the commonly expected range.",
        };
      }

      return {
        score: 40,

        interpretation:
          "ATTENTION" as const,

        reason:
          "The oxygen saturation is substantially below the commonly expected range.",
      };
    }

    case "TEMPERATURE": {
      if (
        value >= 97 &&
        value <= 99.5
      ) {
        return {
          score: 92,

          interpretation:
            "GOOD" as const,

          reason:
            "The temperature falls within a commonly observed adult range.",
        };
      }

      if (
        value >= 100.4
      ) {
        return {
          score: 55,

          interpretation:
            "ATTENTION" as const,

          reason:
            "The temperature is in a fever-range value.",
        };
      }

      return {
        score: 72,

        interpretation:
          "NEUTRAL" as const,

        reason:
          "The temperature is outside the common reference range and should be interpreted in context.",
      };
    }

    case "BLOOD_GLUCOSE":
      return {
        score: 75,

        interpretation:
          "NEUTRAL" as const,

        reason:
          "Glucose interpretation depends on whether the reading was fasting, post-meal, or random.",
      };

    case "WEIGHT":
      return {
        score: 80,

        interpretation:
          "NEUTRAL" as const,

        reason:
          "Weight is best interpreted as a longitudinal trend.",
      };

    case "STEPS": {
      if (
        value >= 8000
      ) {
        return {
          score: 92,

          interpretation:
            "GOOD" as const,

          reason:
            "The recorded activity level is relatively high.",
        };
      }

      if (
        value >= 5000
      ) {
        return {
          score: 78,

          interpretation:
            "NEUTRAL" as const,

          reason:
            "The recorded activity level provides moderate movement data.",
        };
      }

      return {
        score: 65,

        interpretation:
          "NEUTRAL" as const,

        reason:
          "The recorded step count is relatively low.",
      };
    }

    case "SLEEP_DURATION": {
      if (
        value >= 7 &&
        value <= 9
      ) {
        return {
          score: 92,

          interpretation:
            "GOOD" as const,

          reason:
            "The recorded sleep duration falls within a commonly recommended adult range.",
        };
      }

      if (
        value >= 6
      ) {
        return {
          score: 75,

          interpretation:
            "NEUTRAL" as const,

          reason:
            "The recorded sleep duration is somewhat below the commonly recommended range.",
        };
      }

      return {
        score: 60,

        interpretation:
          "ATTENTION" as const,

        reason:
          "The recorded sleep duration is below a commonly recommended adult range.",
      };
    }

    default:
      return {
        score: 70,

        interpretation:
          "NEUTRAL" as const,

        reason:
          "The measurement is stored for longitudinal analysis.",
      };
  }
}

/* =========================================================
   GROUP
   ========================================================= */

function groupByVitalType(
  vitals: VitalAnalyticsInput[]
) {
  const grouped =
    new Map<
      VitalType,
      VitalAnalyticsInput[]
    >();

  for (
    const vital of vitals
  ) {
    if (
      !isValidStoredVital(
        vital
      )
    ) {
      continue;
    }

    const current =
      grouped.get(
        vital.vitalType
      ) || [];

    current.push(
      vital
    );

    grouped.set(
      vital.vitalType,
      current
    );
  }

  for (
    const values of grouped.values()
  ) {
    values.sort(
      (a, b) =>
        b.recordedAt.getTime() -
        a.recordedAt.getTime()
    );
  }

  return grouped;
}

/* =========================================================
   TREND
   ========================================================= */

function calculateTrend(
  type: VitalType,
  values: VitalAnalyticsInput[]
): VitalTrend {
  const latest =
    values[0];

  const previous =
    values[1];

  const numericValues =
    values
      .map(
        (item) =>
          item.value
      )
      .filter(
        (
          value
        ): value is number =>
          typeof value ===
            "number" &&
          Number.isFinite(
            value
          )
      );

  const average =
    numericValues.length >
    0
      ? numericValues.reduce(
          (
            total,
            value
          ) =>
            total + value,
          0
        ) /
        numericValues.length
      : null;

  let changePercent:
    | number
    | null = null;

  if (
    previous?.value !==
      null &&
    previous?.value !==
      undefined &&
    latest?.value !==
      null &&
    latest?.value !==
      undefined &&
    previous.value !==
      0
  ) {
    changePercent =
      Number(
        (
          ((latest.value -
            previous.value) /
            Math.abs(
              previous.value
            )) *
          100
        ).toFixed(1)
      );
  }

  let direction:
    | "UP"
    | "DOWN"
    | "STABLE"
    | "INSUFFICIENT_DATA" =
    "INSUFFICIENT_DATA";

  if (
    changePercent !==
      null
  ) {
    if (
      changePercent >
      3
    ) {
      direction =
        "UP";
    } else if (
      changePercent <
      -3
    ) {
      direction =
        "DOWN";
    } else {
      direction =
        "STABLE";
    }
  }

  const latestScore =
    latest
      ? scoreVital(
          latest
        )
      : null;

  return {
    vitalType:
      type,

    label:
      getVitalLabel(
        type
      ),

    unit:
      latest?.unit ||
      "",

    latestValue:
      latest?.value ??
      null,

    latestSecondaryValue:
      latest?.secondaryValue ??
      null,

    previousValue:
      previous?.value ??
      null,

    previousSecondaryValue:
      previous?.secondaryValue ??
      null,

    averageValue:
      average !== null
        ? Number(
            average.toFixed(
              2
            )
          )
        : null,

    count:
      values.length,

    changePercent,

    direction,

    interpretation:
      latestScore?.interpretation ||
      "NEUTRAL",
  };
}

/* =========================================================
   SUMMARY
   ========================================================= */

export function buildVitalHealthSummary(
  vitals: VitalAnalyticsInput[]
): VitalHealthSummary {
  const validVitals =
    vitals.filter(
      isValidStoredVital
    );

  if (
    validVitals.length ===
    0
  ) {
    return {
      healthScore: 0,

      dataCoverageScore: 0,

      measurementsCount: 0,

      vitalTypesTracked: 0,

      components: [],

      trends: [],

      overallSummary:
        "No valid vital measurements are available for analysis.",

      limitations: [
        "No valid measurements are currently available.",

        "The health score is a wellness/continuity signal, not a diagnosis.",
      ],
    };
  }

  const grouped =
    groupByVitalType(
      validVitals
    );

  const trends =
    Array.from(
      grouped.entries()
    ).map(
      (
        [type, values]
      ) =>
        calculateTrend(
          type,
          values
        )
    );

  const components:
    HealthScoreComponent[] =
    [];

  for (
    const values of grouped.values()
  ) {
    const latest =
      values[0];

    const scored =
      scoreVital(
        latest
      );

    components.push({
      vitalType:
        latest.vitalType,

      label:
        getVitalLabel(
          latest.vitalType
        ),

      score:
        scored.score,

      weight: 1,

      reason:
        scored.reason,
    });
  }

  const possibleTypes =
    6;

  const trackedTypes =
    Math.min(
      grouped.size,
      possibleTypes
    );

  const dataCoverageScore =
    Math.round(
      (trackedTypes /
        possibleTypes) *
        100
    );

  const totalWeight =
    components.reduce(
      (
        total,
        component
      ) =>
        total +
        component.weight,
      0
    );

  const weightedScore =
    components.reduce(
      (
        total,
        component
      ) =>
        total +
        component.score *
          component.weight,
      0
    );

  const rawScore =
    totalWeight > 0
      ? Math.round(
          weightedScore /
            totalWeight
        )
      : 0;

  const healthScore =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          rawScore * 0.8 +
            dataCoverageScore *
              0.2
        )
      )
    );

  const attentionCount =
    trends.filter(
      (trend) =>
        trend.interpretation ===
        "ATTENTION"
    ).length;

  const stableCount =
    trends.filter(
      (trend) =>
        trend.direction ===
        "STABLE"
    ).length;

  let overallSummary =
    "JeevanLink has limited measurements available for interpretation.";

  if (
    attentionCount ===
      0 &&
    stableCount > 0
  ) {
    overallSummary =
      "The currently recorded measurements show mostly stable or reassuring observations.";
  } else if (
    attentionCount >
    0
  ) {
    overallSummary =
      "Some recorded measurements warrant closer monitoring or additional context.";
  } else {
    overallSummary =
      "Measurements have been recorded and are ready for longitudinal trend analysis.";
  }

  const limitations:
    string[] = [];

  if (
    validVitals.length <
    5
  ) {
    limitations.push(
      "There are only a small number of valid measurements, so longitudinal conclusions are limited."
    );
  }

  if (
    grouped.size <
    3
  ) {
    limitations.push(
      "Only a limited range of vital types is currently available."
    );
  }

  if (
    validVitals.every(
      (vital) =>
        vital.source ===
        "MANUAL"
    )
  ) {
    limitations.push(
      "All currently available measurements were entered manually."
    );
  }

  if (
    validVitals.length <
    vitals.length
  ) {
    limitations.push(
      "Some stored measurements were excluded because their values failed validation."
    );
  }

  limitations.push(
    "The score is a wellness/continuity signal, not a clinical diagnosis or medical-risk score."
  );

  return {
    healthScore,

    dataCoverageScore,

    measurementsCount:
      validVitals.length,

    vitalTypesTracked:
      grouped.size,

    components,

    trends,

    overallSummary,

    limitations,
  };
}

/* =========================================================
   CLIENT-SAFE SINGLE-VITAL INTERPRETATION
   ========================================================= */

export function interpretVitalMeasurement(
  vital: VitalAnalyticsInput
) {
  const scored =
    scoreVital(
      vital
    );

  return {
    title:
      scored.interpretation ===
      "GOOD"
        ? "Measurement looks reassuring."
        : scored.interpretation ===
          "ATTENTION"
        ? "Measurement deserves attention."
        : "Measurement recorded.",

    status:
      scored.interpretation ===
      "GOOD"
        ? "good" as const
        : scored.interpretation ===
          "ATTENTION"
        ? "attention" as const
        : "neutral" as const,

    summary:
      vital.vitalType ===
      "BLOOD_PRESSURE"
        ? `${vital.value ?? "—"}/${vital.secondaryValue ?? "—"} ${vital.unit} recorded.`
        : `${vital.value ?? "—"} ${vital.unit} recorded.`,

    details:
      scored.reason,

    score:
      scored.score,
  };
}