"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileSearch,
  FileText,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserRound,
  XCircle,
  ClipboardList,
  Upload,
} from "lucide-react";

import LogoutButton from "@/components/LogoutButton";

type Medication = {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
};

type VerificationAudit = {
  id?: string;
  action?: string;
  note?: string | null;
  createdAt?: string;
};

type MedicalRecord = {
  id: string;
  patientId?: string;
  patientName?: string;
  documentName?: string;
  documentType?: string;
  interpretation?: string | null;
  summary?: string | null;
  medications?: Medication[];
  status?: string;
  clinicianDecision?: string;
  submittedAt?: string;
  createdAt?: string;
  reviewedAt?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  originalFileUrl?: string | null;
  originalFileType?: string | null;
  verificationAudits?: VerificationAudit[];
};

type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "PATIENT" | "CLINICIAN";
};

type RecordFilter =
  | "all"
  | "verified"
  | "pending"
  | "rejected";

/* =========================================================
   STATUS
   ========================================================= */

function getRecordStatus(
  record: MedicalRecord
) {
  const value = String(
    record.status ||
      record.clinicianDecision ||
      "PENDING"
  )
    .trim()
    .toLowerCase();

  if (
    value === "verified" ||
    value === "approved"
  ) {
    return "verified" as const;
  }

  if (
    value === "rejected" ||
    value === "needs correction" ||
    value === "needs_correction"
  ) {
    return "rejected" as const;
  }

  return "pending" as const;
}

/* =========================================================
   STATUS BADGE
   ========================================================= */

function StatusBadge({
  record,
}: {
  record: MedicalRecord;
}) {
  const status =
    getRecordStatus(record);

  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 size={14} />
        Clinician Verified
      </span>
    );
  }

  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
        <XCircle size={14} />
        Needs Attention
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
      <Clock size={14} />
      Pending Verification
    </span>
  );
}

/* =========================================================
   DATE
   ========================================================= */

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

  return date.toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}

/* =========================================================
   AUDIT LABEL
   ========================================================= */

function auditLabel(
  action?: string
) {
  return String(
    action || "Record update"
  )
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(
      /^./,
      (letter) =>
        letter.toUpperCase()
    );
}

/* =========================================================
   PAGE
   ========================================================= */

export default function RecordsPage() {
  const [records, setRecords] =
    useState<MedicalRecord[]>(
      []
    );

  const [selectedRecord, setSelectedRecord] =
    useState<MedicalRecord | null>(
      null
    );

  const [filter, setFilter] =
    useState<RecordFilter>(
      "all"
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [user, setUser] =
    useState<SessionUser | null>(
      null
    );

  const [checkingAccess, setCheckingAccess] =
    useState(true);

  const [showOriginalDocument, setShowOriginalDocument] =
    useState(false);

  /* =========================================================
     ACCESS CHECK
     ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      try {
        const response =
          await fetch(
            "/api/auth/session",
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            }
          );

        let result: any = null;

        try {
          result =
            await response.json();
        } catch {
          result = null;
        }

        if (cancelled) {
          return;
        }

        /*
         * NOT LOGGED IN
         */
        if (
          !response.ok ||
          !result?.authenticated ||
          !result?.user
        ) {
          window.location.replace(
            "/login"
          );

          return;
        }

        /*
         * CLINICIAN IS NOT ALLOWED
         * TO USE /records.
         */
        if (
          result.user.role !==
          "PATIENT"
        ) {
          window.location.replace(
            "/clinician"
          );

          return;
        }

        setUser(
          result.user as SessionUser
        );
      } catch (err) {
        console.error(
          "Records access check failed:",
          err
        );

        if (!cancelled) {
          window.location.replace(
            "/login"
          );
        }
      } finally {
        if (!cancelled) {
          setCheckingAccess(false);
        }
      }
    }

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =========================================================
     LOAD PATIENT RECORDS
     ========================================================= */

  const loadRecords =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const response =
            await fetch(
              "/api/medical-records",
              {
                method: "GET",
                credentials: "include",
                cache: "no-store",
              }
            );

          let result: any = null;

          try {
            result =
              await response.json();
          } catch {
            throw new Error(
              "The server returned an invalid response."
            );
          }

          if (
            !response.ok ||
            !result?.success
          ) {
            throw new Error(
              result?.error ||
                "Unable to load medical records."
            );
          }

          const databaseRecords =
            Array.isArray(
              result.records
            )
              ? result.records
              : [];

          const normalized: MedicalRecord[] =
            databaseRecords.map(
              (record: any) => ({
                id: String(
                  record.id
                ),

                patientId:
                  record.patientId,

                patientName:
                  record.patientName ||
                  user?.name ||
                  "Patient",

                documentName:
                  record.documentName ||
                  "Medical Document",

                documentType:
                  record.documentType ||
                  "Medical Document",

                interpretation:
                  record.interpretation ??
                  record.summary ??
                  "",

                summary:
                  record.summary ??
                  record.interpretation ??
                  "",

                medications:
                  Array.isArray(
                    record.medications
                  )
                    ? record.medications
                    : [],

                status:
                  record.status,

                clinicianDecision:
                  record.clinicianDecision,

                submittedAt:
                  record.submittedAt ||
                  record.createdAt,

                createdAt:
                  record.createdAt,

                reviewedAt:
                  record.reviewedAt,

                verifiedAt:
                  record.verifiedAt,

                rejectionReason:
                  record.rejectionReason,

                originalFileUrl:
                  record.originalFileUrl,

                originalFileType:
                  record.originalFileType,

                verificationAudits:
                  Array.isArray(
                    record.verificationAudits
                  )
                    ? record.verificationAudits
                    : [],
              })
            );

          setRecords(
            normalized
          );

          const requestedRecordId =
            typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("recordId")
              : null;

          setSelectedRecord(
            (current) => {
              if (!normalized.length) {
                return null;
              }

              if (requestedRecordId) {
                const requested = normalized.find(
                  (record) => record.id === requestedRecordId
                );

                if (requested) {
                  return requested;
                }
              }

              if (current) {
                const match =
                  normalized.find(
                    (record) =>
                      record.id ===
                      current.id
                  );

                if (match) {
                  return match;
                }
              }

              return normalized[0];
            }
          );
        } catch (err) {
          console.error(
            "Failed to load patient records:",
            err
          );

          setError(
            err instanceof Error
              ? err.message
              : "Unable to load medical records."
          );

          setRecords([]);
          setSelectedRecord(null);
        } finally {
          setLoading(false);
        }
      },
      [user?.name]
    );

  /* =========================================================
     LOAD AFTER ACCESS CHECK
     ========================================================= */

  useEffect(() => {
    if (
      !checkingAccess &&
      user?.role === "PATIENT"
    ) {
      void loadRecords();
    }
  }, [
    checkingAccess,
    user,
    loadRecords,
  ]);

  /* =========================================================
     FILTER
     ========================================================= */

  const filteredRecords =
    useMemo(() => {
      if (
        filter === "all"
      ) {
        return records;
      }

      return records.filter(
        (record) =>
          getRecordStatus(
            record
          ) === filter
      );
    }, [
      records,
      filter,
    ]);

  /* =========================================================
     COUNTS
     ========================================================= */

  const verifiedCount =
    records.filter(
      (record) =>
        getRecordStatus(
          record
        ) === "verified"
    ).length;

  const pendingCount =
    records.filter(
      (record) =>
        getRecordStatus(
          record
        ) === "pending"
    ).length;

  const rejectedCount =
    records.filter(
      (record) =>
        getRecordStatus(
          record
        ) === "rejected"
    ).length;

  /* =========================================================
     CORRECTION / RESUBMISSION
     ========================================================= */

  function startCorrection(
    record: MedicalRecord
  ) {
    if (
      getRecordStatus(record) !==
      "rejected"
    ) {
      return;
    }

    const isClinicalIntake =
      String(record.documentType || "")
        .trim()
        .toUpperCase() === "CLINICAL_INTAKE" ||
      String(record.documentName || "")
        .trim()
        .toLowerCase() ===
        "pre-consultation clinical intake".toLowerCase();

    if (isClinicalIntake) {
      window.location.href =
        `/clinical-intake?correctionRecordId=${encodeURIComponent(
          record.id
        )}`;
      return;
    }

    window.location.href =
      `/prescriptions?correctionRecordId=${encodeURIComponent(
        record.id
      )}`;
  }

  /* =========================================================
     ACCESS LOADING
     ========================================================= */

  if (checkingAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7f7]">

        <div className="flex items-center gap-3 text-slate-500">

          <Loader2
            size={20}
            className="animate-spin"
          />

          Checking access...

        </div>

      </main>
    );
  }

  /* =========================================================
     PAGE
     ========================================================= */

  return (
    <main className="min-h-screen bg-[#f5f7f7] text-slate-900">

      <div className="mx-auto max-w-[1600px] px-6 py-8">

        {/* =================================================
            HEADER
            ================================================= */}

        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

          <div>

            <Link
              href="/dashboard"
              className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
            >

              <ArrowLeft
                size={16}
              />

              Back to dashboard

            </Link>

            <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
              Medical Records
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              My Health Records
            </h1>

            <p className="mt-2 text-slate-500">
              View your uploaded medical documents and their clinician verification status.
            </p>

          </div>

          <div className="flex flex-wrap items-center gap-3">

            {user && (

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">

                <div className="flex items-center gap-3">

                  <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700">

                    <UserRound
                      size={19}
                    />

                  </div>

                  <div>

                    <p className="text-sm font-semibold">
                      {user.name}
                    </p>

                    <p className="text-xs text-slate-500">
                      Patient
                    </p>

                  </div>

                </div>

              </div>

            )}

            <Link
              href="/health-timeline"
              className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700 shadow-sm hover:bg-teal-100"
            >

              Health timeline

            </Link>

            <button
              type="button"
              onClick={() =>
                void loadRecords()
              }
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >

              {loading ? (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <RefreshCw
                  size={17}
                />
              )}

              Refresh

            </button>

            <LogoutButton />

          </div>

        </div>

        {/* ERROR */}

        {error && (

          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>

        )}

        {/* =================================================
            SUMMARY
            ================================================= */}

        <div className="mb-8 grid gap-5 md:grid-cols-4">

          <SummaryCard
            icon={
              <ClipboardList
                size={22}
              />
            }
            title="Total records"
            value={
              records.length
            }
          />

          <SummaryCard
            icon={
              <ShieldCheck
                size={22}
              />
            }
            title="Clinician verified"
            value={
              verifiedCount
            }
          />

          <SummaryCard
            icon={
              <Clock
                size={22}
              />
            }
            title="Pending"
            value={
              pendingCount
            }
          />

          <SummaryCard
            icon={
              <XCircle
                size={22}
              />
            }
            title="Needs attention"
            value={
              rejectedCount
            }
          />

        </div>

        {/* FILTERS */}

        <div className="mb-5 flex flex-wrap gap-2">

          {[
            [
              "all",
              "All",
            ],

            [
              "verified",
              "Verified",
            ],

            [
              "pending",
              "Pending",
            ],

            [
              "rejected",
              "Needs Attention",
            ],
          ].map(
            ([value, label]) => (

              <button
                key={value}
                type="button"
                onClick={() =>
                  setFilter(
                    value as RecordFilter
                  )
                }
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  filter ===
                  value
                    ? "bg-teal-700 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>

            )
          )}

        </div>

        {/* =================================================
            MAIN GRID
            ================================================= */}

        <div className="grid gap-6 lg:grid-cols-[430px_1fr]">

          {/* RECORD LIST */}

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

            <div className="mb-5">

              <h2 className="font-semibold">
                Your records
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {filteredRecords.length}{" "}
                record
                {filteredRecords.length ===
                1
                  ? ""
                  : "s"}
              </p>

            </div>

            {loading ? (

              <div className="rounded-2xl border border-dashed p-8 text-center">

                <Loader2
                  size={30}
                  className="mx-auto mb-3 animate-spin text-slate-400"
                />

                <p className="font-medium">
                  Loading records...
                </p>

              </div>

            ) : filteredRecords.length ===
              0 ? (

              <div className="rounded-2xl border border-dashed p-8 text-center">

                <FileText
                  size={34}
                  className="mx-auto mb-3 text-slate-300"
                />

                <p className="font-medium text-slate-700">
                  No records found
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {records.length ===
                  0
                    ? "No medical records are currently available."
                    : "No records match the selected filter."}
                </p>

              </div>

            ) : (

              <div className="space-y-3">

                {filteredRecords.map(
                  (record) => (

                    <button
                      key={
                        record.id
                      }
                      type="button"
                      onClick={() =>
                        setSelectedRecord(
                          record
                        )
                      }
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selectedRecord?.id ===
                        record.id
                          ? "border-teal-500 bg-teal-50"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <p className="font-semibold text-slate-800">
                            {record.documentName ||
                              "Medical Document"}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {record.documentType ||
                              "Medical Record"}
                          </p>

                        </div>

                      </div>

                      <div className="mt-3">

                        <StatusBadge
                          record={
                            record
                          }
                        />

                      </div>

                      <p className="mt-3 text-xs text-slate-400">
                        {formatDate(
                          record.submittedAt ||
                            record.createdAt
                        )}
                      </p>

                    </button>

                  )
                )}

              </div>

            )}

          </section>

          {/* =================================================
              DETAILS
              ================================================= */}

          <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">

            {!selectedRecord ? (

              <div className="flex min-h-[600px] flex-col items-center justify-center text-center">

                <FileSearch
                  size={52}
                  className="mb-4 text-slate-300"
                />

                <h2 className="text-xl font-semibold">
                  Select a record
                </h2>

                <p className="mt-2 max-w-md text-slate-500">
                  Select a medical record to view its details.
                </p>

              </div>

            ) : (

              <>

                {/* HEADER */}

                <div className="flex flex-col gap-5 border-b pb-6 md:flex-row md:items-center md:justify-between">

                  <div className="flex items-center gap-4">

                    <div className="rounded-2xl bg-slate-100 p-4">

                      <FileText
                        size={27}
                      />

                    </div>

                    <div>

                      <p className="text-sm text-slate-500">
                        {selectedRecord.patientName ||
                          "Patient"}
                      </p>

                      <h2 className="text-2xl font-semibold">
                        {selectedRecord.documentName ||
                          "Medical Document"}
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        {selectedRecord.documentType ||
                          "Medical Document"}
                      </p>

                    </div>

                  </div>

                  <StatusBadge
                    record={
                      selectedRecord
                    }
                  />

                </div>

                {/* =================================================
                    ORIGINAL DOCUMENT — PATIENT ONLY
                    ================================================= */}

                <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50/40 p-5">

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                    <div className="flex items-start gap-3">

                      <div className="rounded-xl bg-white p-3 text-teal-700 shadow-sm">

                        <FileSearch
                          size={21}
                        />

                      </div>

                      <div>

                        <h3 className="font-semibold">
                          Original document
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Your private uploaded medical document.
                        </p>

                      </div>

                    </div>

                    {selectedRecord.originalFileUrl ? (

                      <div className="flex flex-wrap gap-2">

                        <button
                          type="button"
                          onClick={() =>
                            setShowOriginalDocument(
                              true
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
                        >

                          <FileSearch
                            size={16}
                          />

                          View original

                        </button>

                        <a
                          href={`/api/medical-records/${selectedRecord.id}/document`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >

                          <ExternalLink
                            size={16}
                          />

                          Open

                        </a>

                      </div>

                    ) : (

                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-500">
                        Original unavailable
                      </span>

                    )}

                  </div>

                </div>

                {/* INTERPRETATION */}

                <div className="mt-8">

                  <h3 className="text-lg font-semibold">
                    Clinical interpretation
                  </h3>

                  <div className="mt-3 rounded-2xl border bg-slate-50 p-5">

                    <p className="leading-7 text-slate-700">
                      {selectedRecord.interpretation ||
                        selectedRecord.summary ||
                        "No interpretation available."}
                    </p>

                  </div>

                </div>

                {/* MEDICATIONS */}

                <div className="mt-8">

                  <h3 className="text-lg font-semibold">
                    Medications
                  </h3>

                  {selectedRecord.medications &&
                  selectedRecord.medications.length >
                    0 ? (

                    <div className="mt-3 space-y-3">

                      {selectedRecord.medications.map(
                        (
                          medication,
                          index
                        ) => (

                          <div
                            key={
                              `${selectedRecord.id}-${index}`
                            }
                            className="rounded-2xl border bg-white p-4"
                          >

                            <p className="font-semibold text-slate-800">
                              {medication.name}
                            </p>

                            <div className="mt-2 grid gap-2 text-sm text-slate-500 sm:grid-cols-3">

                              <span>
                                <strong className="text-slate-700">
                                  Dosage:
                                </strong>{" "}
                                {medication.dosage ||
                                  "—"}
                              </span>

                              <span>
                                <strong className="text-slate-700">
                                  Frequency:
                                </strong>{" "}
                                {medication.frequency ||
                                  "—"}
                              </span>

                              <span>
                                <strong className="text-slate-700">
                                  Duration:
                                </strong>{" "}
                                {medication.duration ||
                                  "—"}
                              </span>

                            </div>

                          </div>

                        )
                      )}

                    </div>

                  ) : (

                    <div className="mt-3 rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
                      No medications recorded.
                    </div>

                  )}

                </div>

                {/* CORRECTION / RESUBMISSION */}

                {getRecordStatus(
                  selectedRecord
                ) === "rejected" && (

                  <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">

                    <div className="flex items-start gap-3">

                      <div className="rounded-xl bg-white p-3 text-amber-700 shadow-sm">

                        <XCircle
                          size={20}
                        />

                      </div>

                      <div className="flex-1">

                        <h3 className="font-semibold text-amber-900">
                          Needs correction
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-amber-800">
                          {selectedRecord.rejectionReason ||
                            "Your clinician has requested a correction to this document."}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            startCorrection(
                              selectedRecord
                            )
                          }
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800"
                        >

                          <Upload
                            size={17}
                          />

                          Upload corrected document

                        </button>

                      </div>

                    </div>

                  </div>

                )}

                {/* VERIFICATION HISTORY */}

                <div className="mt-8 border-t pt-8">

                  <h3 className="text-lg font-semibold">
                    Verification history
                  </h3>

                  {selectedRecord.verificationAudits &&
                  selectedRecord.verificationAudits.length >
                    0 ? (

                    <div className="mt-4 space-y-4">

                      {selectedRecord.verificationAudits.map(
                        (
                          audit,
                          index
                        ) => (

                          <div
                            key={
                              audit.id ||
                              `${selectedRecord.id}-${index}`
                            }
                            className="rounded-2xl border bg-slate-50 p-4"
                          >

                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                              <p className="text-sm font-semibold text-slate-800">
                                {auditLabel(
                                  audit.action
                                )}
                              </p>

                              <time className="text-xs text-slate-400">
                                {formatDate(
                                  audit.createdAt
                                )}
                              </time>

                            </div>

                            {audit.note && (

                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                {audit.note}
                              </p>

                            )}

                          </div>

                        )
                      )}

                    </div>

                  ) : (

                    <div className="mt-4 rounded-2xl border border-dashed p-6 text-center">

                      <Clock
                        size={30}
                        className="mx-auto mb-3 text-slate-300"
                      />

                      <p className="font-medium text-slate-600">
                        No verification history
                      </p>

                    </div>

                  )}

                </div>

              </>

            )}

          </section>

        </div>

      </div>

      {/* =====================================================
          ORIGINAL DOCUMENT MODAL
          PATIENT ONLY
          ===================================================== */}

      {showOriginalDocument &&
        selectedRecord?.originalFileUrl && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">

          <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b px-5 py-4">

              <div>

                <p className="font-semibold text-slate-900">
                  Original medical document
                </p>

                <p className="mt-0.5 text-xs text-slate-500">
                  Private patient document
                </p>

              </div>

              <div className="flex items-center gap-2">

                <a
                  href={`/api/medical-records/${selectedRecord.id}/document`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                >

                  <ExternalLink
                    size={16}
                  />

                  Open

                </a>

                <button
                  type="button"
                  onClick={() =>
                    setShowOriginalDocument(
                      false
                    )
                  }
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Close
                </button>

              </div>

            </div>

            <div className="min-h-0 flex-1 bg-slate-100 p-4">

              {(
                selectedRecord.originalFileType ||
                ""
              )
                .toLowerCase()
                .includes("pdf") ||
              selectedRecord.documentName
                ?.toLowerCase()
                .endsWith(".pdf") ? (

                <iframe
                  src={`/api/medical-records/${selectedRecord.id}/document`}
                  title="Original medical document"
                  className="h-full w-full rounded-2xl border bg-white"
                />

              ) : (

                <div className="flex h-full items-center justify-center overflow-auto rounded-2xl border bg-white p-4">

                  <img
                    src={`/api/medical-records/${selectedRecord.id}/document`}
                    alt="Original medical document"
                    className="max-h-full max-w-full object-contain"
                  />

                </div>

              )}

            </div>

          </div>

        </div>

      )}

    </main>
  );
}

/* ===========================================================
   SUMMARY CARD
   =========================================================== */

function SummaryCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">

      <div className="flex items-center gap-4">

        <div className="rounded-xl bg-teal-50 p-3 text-teal-700">
          {icon}
        </div>

        <div>

          <p className="text-sm text-slate-500">
            {title}
          </p>

          <p className="text-2xl font-semibold">
            {value}
          </p>

        </div>

      </div>

    </div>
  );
}