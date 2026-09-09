"use client";

import {
  Activity,
  ArrowDown,
  ArrowUp,
  Minus,
  Pill,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

type Medication = {
  id?: string;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
};

type MedicalRecord = {
  id: string;
  documentName: string;
  documentType: string;
  status:
    | "PENDING"
    | "VERIFIED"
    | "REJECTED";
  createdAt: string;
  medications: Medication[];
};

type Vital = {
  id: string;
  vitalType: string;
  value?: number | null;
  secondaryValue?: number | null;
  unit: string;
  recordedAt: string;
  source: string;
};

type ClinicalSnapshotPanelProps = {
  records: MedicalRecord[];
  vitals: Vital[];
};

type TrendDirection =
  | "up"
  | "down"
  | "stable";

type TrendInfo = {
  latest: Vital;
  previous?: Vital;
  changePercent?: number;
  direction: TrendDirection;
};

function labelForVital(
  vitalType: string
) {
  const labels: Record<
    string,
    string
  > = {
    HEART_RATE: "Heart Rate",
    BLOOD_PRESSURE: "Blood Pressure",
    OXYGEN_SATURATION:
      "Oxygen Saturation",
    TEMPERATURE: "Temperature",
    WEIGHT: "Weight",
    BLOOD_GLUCOSE: "Blood Glucose",
    STEPS: "Steps",
    SLEEP_DURATION: "Sleep Duration",
  };

  return (
    labels[vitalType] ||
    vitalType.replaceAll("_", " ")
  );
}

function formatDate(
  value?: string
) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getNumericValue(
  vital: Vital
) {
  /*
   * For BP, trend calculations use
   * systolic as the primary value.
   */
  if (
    vital.vitalType ===
    "BLOOD_PRESSURE"
  ) {
    return vital.value ?? null;
  }

  return vital.value ?? null;
}

function formatVitalValue(
  vital: Vital
) {
  if (
    vital.vitalType ===
      "BLOOD_PRESSURE" &&
    vital.value != null &&
    vital.secondaryValue != null
  ) {
    return `${vital.value}/${vital.secondaryValue}`;
  }

  if (vital.value == null) {
    return "Not available";
  }

  return `${vital.value}`;
}

function buildTrendMap(
  vitals: Vital[]
) {
  const grouped =
    new Map<string, Vital[]>();

  for (const vital of vitals) {
    if (!grouped.has(vital.vitalType)) {
      grouped.set(
        vital.vitalType,
        []
      );
    }

    grouped
      .get(vital.vitalType)!
      .push(vital);
  }

  const result =
    new Map<
      string,
      TrendInfo
    >();

  for (const [
    vitalType,
    measurements,
  ] of grouped.entries()) {
    const sorted =
      [...measurements].sort(
        (a, b) =>
          new Date(
            b.recordedAt
          ).getTime() -
          new Date(
            a.recordedAt
          ).getTime()
      );

    const latest =
      sorted[0];

    const previous =
      sorted[1];

    if (!latest) {
      continue;
    }

    const latestValue =
      getNumericValue(
        latest
      );

    const previousValue =
      previous
        ? getNumericValue(
            previous
          )
        : null;

    let changePercent:
      | number
      | undefined;

    let direction:
      | TrendDirection =
      "stable";

    if (
      latestValue != null &&
      previousValue != null &&
      previousValue !== 0
    ) {
      changePercent =
        ((latestValue -
          previousValue) /
          Math.abs(
            previousValue
          )) *
        100;

      if (
        Math.abs(
          changePercent
        ) < 2
      ) {
        direction = "stable";
      } else if (
        changePercent > 0
      ) {
        direction = "up";
      } else {
        direction = "down";
      }
    }

    result.set(
      vitalType,
      {
        latest,
        previous,
        changePercent,
        direction,
      }
    );
  }

  return result;
}

function TrendIcon({
  direction,
}: {
  direction: TrendDirection;
}) {
  if (direction === "up") {
    return (
      <ArrowUp
        size={16}
      />
    );
  }

  if (direction === "down") {
    return (
      <ArrowDown
        size={16}
      />
    );
  }

  return (
    <Minus
      size={16}
    />
  );
}

function trendText(
  trend: TrendInfo
) {
  if (
    trend.changePercent == null
  ) {
    return "No previous reading";
  }

  const amount =
    Math.abs(
      trend.changePercent
    ).toFixed(1);

  if (
    trend.direction === "up"
  ) {
    return `${amount}% higher than previous`;
  }

  if (
    trend.direction === "down"
  ) {
    return `${amount}% lower than previous`;
  }

  return "Stable compared with previous";
}

export default function ClinicalSnapshotPanel({
  records,
  vitals,
}: ClinicalSnapshotPanelProps) {
  const trendMap =
    buildTrendMap(vitals);

  const trends =
    Array.from(
      trendMap.entries()
    )
      .sort(
        (a, b) =>
          new Date(
            b[1].latest.recordedAt
          ).getTime() -
          new Date(
            a[1].latest.recordedAt
          ).getTime()
      )
      .slice(0, 8);

  /*
   * Only medications from VERIFIED
   * medical records are shown as
   * current trusted medication data.
   */
  const verifiedMedicationMap =
    new Map<
      string,
      Medication
    >();

  for (const record of records) {
    if (
      record.status !==
      "VERIFIED"
    ) {
      continue;
    }

    for (const medication of
      record.medications || []) {
      const normalized =
        medication.name
          .trim()
          .toLowerCase();

      if (
        normalized &&
        !verifiedMedicationMap.has(
          normalized
        )
      ) {
        verifiedMedicationMap.set(
          normalized,
          medication
        );
      }
    }
  }

  const verifiedMedications =
    Array.from(
      verifiedMedicationMap.values()
    ).slice(0, 8);

  const verifiedRecords =
    records.filter(
      (record) =>
        record.status ===
        "VERIFIED"
    );

  const pendingRecords =
    records.filter(
      (record) =>
        record.status ===
        "PENDING"
    );

  const rejectedRecords =
    records.filter(
      (record) =>
        record.status ===
        "REJECTED"
    );

  return (
    <section className="space-y-6">
      {/* =====================================================
          LONGITUDINAL VITAL TRENDS
          ===================================================== */}

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-teal-50 p-3 text-teal-700">
                <Activity
                  size={22}
                />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Longitudinal monitoring
                </p>

                <h2 className="mt-1 text-xl font-semibold">
                  Vital trends
                </h2>
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Compare the patient&apos;s latest
              available measurement with the
              immediately preceding valid reading.
            </p>
          </div>

          <div className="rounded-xl border bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Trend direction is descriptive only
            and should be interpreted in clinical
            context.
          </div>
        </div>

        {trends.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <Activity
              size={32}
              className="mx-auto mb-3 text-slate-300"
            />

            <p className="font-medium text-slate-700">
              No longitudinal vital data
              available
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Vital measurements will appear here
              once they are recorded.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {trends.map(
              ([
                vitalType,
                trend,
              ]) => (
                <div
                  key={vitalType}
                  className="rounded-2xl border bg-slate-50 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                        {labelForVital(
                          vitalType
                        )}
                      </p>

                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {formatVitalValue(
                          trend.latest
                        )}{" "}
                        <span className="text-xs font-medium text-slate-500">
                          {vitalType ===
                          "BLOOD_PRESSURE"
                            ? "mmHg"
                            : trend.latest.unit}
                        </span>
                      </p>
                    </div>

                    <div
                      className={`rounded-xl p-2 ${
                        trend.direction ===
                        "up"
                          ? "bg-amber-50 text-amber-700"
                          : trend.direction ===
                            "down"
                          ? "bg-sky-50 text-sky-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      <TrendIcon
                        direction={
                          trend.direction
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-sm">
                    {trend.direction ===
                      "up" && (
                      <TrendingUp
                        size={16}
                        className="text-amber-600"
                      />
                    )}

                    {trend.direction ===
                      "down" && (
                      <TrendingDown
                        size={16}
                        className="text-sky-600"
                      />
                    )}

                    {trend.direction ===
                      "stable" && (
                      <Minus
                        size={16}
                        className="text-slate-500"
                      />
                    )}

                    <span className="font-medium text-slate-700">
                      {trendText(
                        trend
                      )}
                    </span>
                  </div>

                  <div className="mt-4 border-t pt-4">
                    <p className="text-xs text-slate-400">
                      Latest reading
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(
                        trend.latest
                          .recordedAt
                      )}
                    </p>

                    {trend.previous && (
                      <>
                        <p className="mt-3 text-xs text-slate-400">
                          Previous
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatVitalValue(
                            trend.previous
                          )}{" "}
                          ·{" "}
                          {formatDate(
                            trend.previous
                              .recordedAt
                          )}
                        </p>
                      </>
                    )}

                    <p className="mt-3 text-[11px] text-slate-400">
                      Source:{" "}
                      {
                        trend.latest
                          .source
                      }
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
          The dashboard reports measurement
          changes only. It does not diagnose a
          condition or determine whether an
          increase or decrease is clinically
          harmful.
        </div>
      </div>

      {/* =====================================================
          MEDICATION SUMMARY
          ===================================================== */}

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-violet-50 p-3 text-violet-700">
            <Pill
              size={22}
            />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Medication continuity
            </p>

            <h2 className="mt-1 text-xl font-semibold">
              Verified medications
            </h2>
          </div>
        </div>

        {verifiedMedications.length ===
        0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <Pill
              size={32}
              className="mx-auto mb-3 text-slate-300"
            />

            <p className="font-medium text-slate-700">
              No verified medications
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Medications become part of this
              summary after their source record
              is clinically verified.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {verifiedMedications.map(
              (
                medication,
                index
              ) => (
                <div
                  key={`${medication.name}-${index}`}
                  className="rounded-2xl border bg-slate-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-white p-2 text-violet-700 shadow-sm">
                      <Pill
                        size={17}
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">
                        {
                          medication.name
                        }
                      </p>

                      {medication.dosage && (
                        <p className="mt-1 text-sm text-slate-600">
                          Dosage:{" "}
                          {
                            medication.dosage
                          }
                        </p>
                      )}

                      {medication.frequency && (
                        <p className="mt-1 text-sm text-slate-600">
                          Frequency:{" "}
                          {
                            medication.frequency
                          }
                        </p>
                      )}

                      {medication.duration && (
                        <p className="mt-1 text-sm text-slate-600">
                          Duration:{" "}
                          {
                            medication.duration
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/50 p-4 text-xs leading-5 text-violet-900">
          Medication entries shown here come
          only from records marked VERIFIED.
          This panel does not independently
          determine whether a medication should
          be continued or changed.
        </div>
      </div>

      {/* =====================================================
          CLINICAL ACTIVITY
          ===================================================== */}

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            Record activity
          </p>

          <h2 className="mt-1 text-xl font-semibold">
            Clinical activity summary
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-emerald-50/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Verified
            </p>

            <p className="mt-2 text-2xl font-semibold text-emerald-900">
              {
                verifiedRecords.length
              }
            </p>

            <p className="mt-1 text-xs text-emerald-700">
              Clinically verified records
            </p>
          </div>

          <div className="rounded-2xl border bg-amber-50/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Pending
            </p>

            <p className="mt-2 text-2xl font-semibold text-amber-900">
              {
                pendingRecords.length
              }
            </p>

            <p className="mt-1 text-xs text-amber-700">
              Awaiting review
            </p>
          </div>

          <div className="rounded-2xl border bg-rose-50/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
              Correction
            </p>

            <p className="mt-2 text-2xl font-semibold text-rose-900">
              {
                rejectedRecords.length
              }
            </p>

            <p className="mt-1 text-xs text-rose-700">
              Sent back for correction
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}