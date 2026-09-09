"use client";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Pill,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type Medication = {
  id?: string;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
};

type Audit = {
  id: string;
  action: string;
  note?: string | null;
  createdAt: string;
};

type MedicalRecord = {
  id: string;
  documentName: string;
  documentType: string;
  interpretation?: string | null;
  status:
    | "PENDING"
    | "VERIFIED"
    | "REJECTED";
  createdAt: string;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  medications: Medication[];
  verificationAudits?: Audit[];
};

type Props = {
  records: MedicalRecord[];
};

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

function shortDate(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

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
      year: "numeric",
    }
  );
}

function getStatusLabel(
  status: MedicalRecord["status"]
) {
  if (status === "VERIFIED") {
    return "Verified";
  }

  if (status === "REJECTED") {
    return "Needs Correction";
  }

  return "Pending";
}

function getStatusClasses(
  status: MedicalRecord["status"]
) {
  if (status === "VERIFIED") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "REJECTED") {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-amber-50 text-amber-700";
}

function getAuditIcon(
  action: string
) {
  const normalized =
    action.toUpperCase();

  if (
    normalized.includes(
      "VERIFIED"
    )
  ) {
    return (
      <CheckCircle2
        size={16}
        className="text-emerald-600"
      />
    );
  }

  if (
    normalized.includes(
      "CORRECTION"
    ) ||
    normalized.includes(
      "REJECT"
    )
  ) {
    return (
      <XCircle
        size={16}
        className="text-rose-600"
      />
    );
  }

  if (
    normalized.includes(
      "RESUBMITTED"
    )
  ) {
    return (
      <RotateCcw
        size={16}
        className="text-amber-600"
      />
    );
  }

  return (
    <Clock3
      size={16}
      className="text-slate-500"
    />
  );
}

function medicationKey(
  medication: Medication
) {
  return [
    medication.name
      .trim()
      .toLowerCase(),
    medication.dosage
      ?.trim()
      .toLowerCase() || "",
    medication.frequency
      ?.trim()
      .toLowerCase() || "",
    medication.duration
      ?.trim()
      .toLowerCase() || "",
  ].join("|");
}

export default function ClinicalHistoryPanel({
  records,
}: Props) {
  const sortedRecords =
    [...records].sort(
      (first, second) =>
        new Date(
          second.createdAt
        ).getTime() -
        new Date(
          first.createdAt
        ).getTime()
    );

  /*
   * Medication snapshot:
   * use verified records only because these are the
   * medication entries that have passed clinician review.
   */
  const medicationMap =
    new Map<
      string,
      {
        medication: Medication;
        record: MedicalRecord;
      }
    >();

  for (const record of sortedRecords) {
    if (
      record.status !==
      "VERIFIED"
    ) {
      continue;
    }

    for (const medication of
      record.medications || []) {
      if (
        !medication?.name ||
        !medication.name.trim()
      ) {
        continue;
      }

      const key =
        medicationKey(
          medication
        );

      if (
        !medicationMap.has(key)
      ) {
        medicationMap.set(
          key,
          {
            medication,
            record,
          }
        );
      }
    }
  }

  const medications =
    Array.from(
      medicationMap.values()
    );

  const timelineEvents =
    sortedRecords.flatMap(
      (record) => {
        const audits =
          Array.isArray(
            record.verificationAudits
          )
            ? record.verificationAudits
            : [];

        return [
          {
            type: "RECORD",
            date:
              record.createdAt,
            record,
            audit: null,
          },
          ...audits.map(
            (audit) => ({
              type: "AUDIT",
              date:
                audit.createdAt,
              record,
              audit,
            })
          ),
        ];
      }
    ).sort(
      (first, second) =>
        new Date(
          second.date
        ).getTime() -
        new Date(
          first.date
        ).getTime()
    );

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* =====================================================
          PATIENT MEDICATION SNAPSHOT
          ===================================================== */}

      <section className="rounded-2xl border p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Medication overview
            </p>

            <h3 className="mt-1 text-lg font-semibold text-slate-800">
              Verified medication snapshot
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Medication entries from clinician-verified records.
            </p>
          </div>

          <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700">
            <Pill size={19} />
          </div>
        </div>

        {medications.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <Pill
              size={26}
              className="mx-auto mb-2 text-slate-300"
            />

            <p className="text-sm font-medium text-slate-600">
              No verified medications found
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              Verified prescription entries
              will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {medications.map(
              ({
                medication,
                record,
              }) => (
                <div
                  key={`${record.id}-${medication.id || medicationKey(
                    medication
                  )}`}
                  className="rounded-2xl border bg-slate-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-xl bg-white p-2 text-teal-700 shadow-sm">
                      <Pill size={17} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {medication.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            From{" "}
                            {record.documentName}
                          </p>
                        </div>

                        <span className="self-start rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          Verified
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">
                            Dosage
                          </p>

                          <p className="mt-0.5 font-medium text-slate-700">
                            {medication.dosage ||
                              "Not specified"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">
                            Frequency
                          </p>

                          <p className="mt-0.5 font-medium text-slate-700">
                            {medication.frequency ||
                              "Not specified"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">
                            Duration
                          </p>

                          <p className="mt-0.5 font-medium text-slate-700">
                            {medication.duration ||
                              "Not specified"}
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 text-[11px] text-slate-400">
                        Verified record date:{" "}
                        {shortDate(
                          record.verifiedAt ||
                            record.createdAt
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <ShieldCheck
            size={15}
            className="mt-0.5 shrink-0 text-slate-500"
          />

          <p className="text-xs leading-5 text-slate-500">
            This snapshot only includes medications
            associated with clinician-verified records.
            It is not a replacement for the prescription
            itself.
          </p>
        </div>
      </section>

      {/* =====================================================
          MEDICAL TIMELINE
          ===================================================== */}

      <section className="rounded-2xl border p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Longitudinal record
            </p>

            <h3 className="mt-1 text-lg font-semibold text-slate-800">
              Clinical timeline
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Medical documents and verification events.
            </p>
          </div>

          <div className="rounded-xl bg-violet-50 p-2.5 text-violet-700">
            <CalendarDays size={19} />
          </div>
        </div>

        {timelineEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <FileText
              size={26}
              className="mx-auto mb-2 text-slate-300"
            />

            <p className="text-sm font-medium text-slate-600">
              No timeline events available
            </p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute bottom-3 left-[13px] top-3 w-px bg-slate-200" />

            <div className="space-y-5">
              {timelineEvents
                .slice(0, 14)
                .map(
                  (
                    event,
                    index
                  ) => {
                    if (
                      event.type ===
                      "RECORD"
                    ) {
                      const record =
                        event.record;

                      return (
                        <div
                          key={`record-${record.id}-${index}`}
                          className="relative pl-9"
                        >
                          <div className="absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 shadow-sm">
                            <FileText
                              size={13}
                              className="text-slate-600"
                            />
                          </div>

                          <div className="rounded-xl border bg-white p-3">
                            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800">
                                  {
                                    record.documentName
                                  }
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {
                                    record.documentType
                                  }
                                </p>
                              </div>

                              <span
                                className={`self-start rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${getStatusClasses(
                                  record.status
                                )}`}
                              >
                                {getStatusLabel(
                                  record.status
                                )}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                              <span>
                                Submitted{" "}
                                {formatDate(
                                  record.createdAt
                                )}
                              </span>

                              {record.verifiedAt && (
                                <span>
                                  Verified{" "}
                                  {formatDate(
                                    record.verifiedAt
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const audit =
                      event.audit;

                    if (
                      !audit
                    ) {
                      return null;
                    }

                    return (
                      <div
                        key={`audit-${audit.id}-${index}`}
                        className="relative pl-9"
                      >
                        <div className="absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-white shadow-sm">
                          {getAuditIcon(
                            audit.action
                          )}
                        </div>

                        <div className="rounded-xl border bg-slate-50 p-3">
                          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                            <div>
                              <p className="text-sm font-semibold text-slate-700">
                                {audit.action.replaceAll(
                                  "_",
                                  " "
                                )}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {
                                  event.record
                                    .documentName
                                }
                              </p>
                            </div>

                            <span className="text-[11px] text-slate-400">
                              {formatDate(
                                audit.createdAt
                              )}
                            </span>
                          </div>

                          {audit.note && (
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              {
                                audit.note
                              }
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
            </div>
          </div>
        )}

        {timelineEvents.length >
          14 && (
          <p className="mt-4 text-center text-xs text-slate-400">
            Showing the 14 most recent
            timeline events.
          </p>
        )}
      </section>
    </div>
  );
}