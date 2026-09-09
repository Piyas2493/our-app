"use client";

import {
  Activity,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

type Vital = {
  id: string;
  vitalType: string;
  value?: number | null;
  secondaryValue?: number | null;
  unit: string;
  recordedAt: string;
  source: string;
};

type Props = {
  vitals: Vital[];
};

function getVitalLabel(
  vitalType: string
) {
  const labels: Record<
    string,
    string
  > = {
    HEART_RATE: "Heart Rate",
    BLOOD_PRESSURE:
      "Blood Pressure",
    OXYGEN_SATURATION:
      "Oxygen Saturation",
    TEMPERATURE: "Temperature",
    WEIGHT: "Weight",
    BLOOD_GLUCOSE:
      "Blood Glucose",
    STEPS: "Steps",
    SLEEP_DURATION:
      "Sleep Duration",
  };

  return (
    labels[vitalType] ||
    vitalType.replaceAll("_", " ")
  );
}

function isValidVital(
  vital: Vital
) {
  if (
    vital.value == null ||
    !Number.isFinite(
      vital.value
    )
  ) {
    return false;
  }

  if (
    vital.vitalType ===
      "BLOOD_PRESSURE" &&
    vital.secondaryValue != null &&
    vital.value <=
      vital.secondaryValue
  ) {
    return false;
  }

  return true;
}

function getDirection(
  previous: number,
  latest: number
) {
  const difference =
    latest - previous;

  const threshold =
    Math.max(
      Math.abs(previous) * 0.02,
      0.1
    );

  if (
    Math.abs(difference) <
    threshold
  ) {
    return "stable" as const;
  }

  return difference > 0
    ? ("up" as const)
    : ("down" as const);
}

function formatValue(
  vital: Vital
) {
  if (
    vital.vitalType ===
      "BLOOD_PRESSURE" &&
    vital.secondaryValue !=
      null
  ) {
    return `${vital.value}/${vital.secondaryValue}`;
  }

  return String(
    vital.value ?? "—"
  );
}

function formatUnit(
  vital: Vital
) {
  if (
    vital.vitalType ===
    "BLOOD_PRESSURE"
  ) {
    return "mmHg";
  }

  return vital.unit;
}

function formatDate(
  value: string
) {
  const date = new Date(
    value
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
    }
  );
}

function TrendIcon({
  direction,
}: {
  direction:
    | "up"
    | "down"
    | "stable";
}) {
  if (
    direction === "up"
  ) {
    return (
      <TrendingUp
        size={15}
        className="text-slate-600"
      />
    );
  }

  if (
    direction === "down"
  ) {
    return (
      <TrendingDown
        size={15}
        className="text-slate-600"
      />
    );
  }

  return (
    <Minus
      size={15}
      className="text-slate-400"
    />
  );
}

export default function VitalTrendPanel({
  vitals,
}: Props) {
  const grouped =
    vitals.reduce(
      (
        result,
        vital
      ) => {
        if (
          !isValidVital(vital)
        ) {
          return result;
        }

        if (
          !result[
            vital.vitalType
          ]
        ) {
          result[
            vital.vitalType
          ] = [];
        }

        result[
          vital.vitalType
        ].push(vital);

        return result;
      },
      {} as Record<
        string,
        Vital[]
      >
    );

  const trendTypes =
    Object.keys(
      grouped
    ).slice(0, 6);

  if (
    trendTypes.length === 0
  ) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center">
        <Activity
          size={28}
          className="mx-auto mb-3 text-slate-300"
        />

        <p className="text-sm font-medium text-slate-600">
          No longitudinal vital
          trends available
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          Valid historical
          measurements will appear
          here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {trendTypes.map(
        (type) => {
          const readings =
            [...grouped[type]]
              .sort(
                (
                  first,
                  second
                ) =>
                  new Date(
                    first.recordedAt
                  ).getTime() -
                  new Date(
                    second.recordedAt
                  ).getTime()
              )
              .slice(-8);

          const latest =
            readings[
              readings.length -
                1
            ];

          const previous =
            readings[
              Math.max(
                readings.length -
                  2,
                0
              )
            ];

          const direction =
            readings.length >= 2
              ? getDirection(
                  previous.value ??
                    0,
                  latest.value ??
                    0
                )
              : "stable";

          const values =
            readings.map(
              (reading) =>
                reading.value ??
                0
            );

          const min =
            Math.min(...values);

          const max =
            Math.max(...values);

          const range =
            Math.max(
              max - min,
              1
            );

          return (
            <div
              key={type}
              className="rounded-2xl border bg-white p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Vital trend
                  </p>

                  <h3 className="mt-1 font-semibold text-slate-800">
                    {getVitalLabel(
                      type
                    )}
                  </h3>
                </div>

                <div className="flex items-center gap-1 rounded-lg border bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
                  <TrendIcon
                    direction={
                      direction
                    }
                  />

                  {direction ===
                  "up"
                    ? "Rising"
                    : direction ===
                      "down"
                    ? "Falling"
                    : "Stable"}
                </div>
              </div>

              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold text-slate-900">
                    {formatValue(
                      latest
                    )}

                    <span className="ml-1 text-xs font-medium text-slate-400">
                      {formatUnit(
                        latest
                      )}
                    </span>
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Latest ·{" "}
                    {formatDate(
                      latest.recordedAt
                    )}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-slate-400">
                    Readings
                  </p>

                  <p className="font-semibold text-slate-700">
                    {
                      readings.length
                    }
                  </p>
                </div>
              </div>

              <div className="mt-5 h-28 rounded-xl bg-slate-50 p-3">
                <svg
                  viewBox="0 0 400 100"
                  className="h-full w-full"
                  preserveAspectRatio="none"
                  aria-label={`${getVitalLabel(
                    type
                  )} trend chart`}
                >
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-slate-700"
                    points={readings
                      .map(
                        (
                          reading,
                          index
                        ) => {
                          const x =
                            readings.length ===
                            1
                              ? 200
                              : (index /
                                  (readings.length -
                                    1)) *
                                  390 +
                                5;

                          const y =
                            95 -
                            (((reading.value ??
                              0) -
                              min) /
                              range) *
                              85;

                          return `${x},${y}`;
                        }
                      )
                      .join(" ")}
                  />

                  {readings.map(
                    (
                      reading,
                      index
                    ) => {
                      const x =
                        readings.length ===
                        1
                          ? 200
                          : (index /
                              (readings.length -
                                1)) *
                              390 +
                            5;

                      const y =
                        95 -
                        (((reading.value ??
                          0) -
                          min) /
                          range) *
                          85;

                      return (
                        <circle
                          key={
                            reading.id
                          }
                          cx={
                            x
                          }
                          cy={
                            y
                          }
                          r="3.5"
                          className="fill-slate-700"
                        />
                      );
                    }
                  )}
                </svg>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {formatDate(
                    readings[0]
                      .recordedAt
                  )}
                </span>

                <span>
                  {formatDate(
                    latest.recordedAt
                  )}
                </span>
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}