"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  FileText,
  Clock,
  ShieldCheck,
  UserRound,
  Pill,
  Plus,
  Trash2,
} from "lucide-react";

type Medication = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
};

type LabResult = {
  testName: string;
  result: string;
  unit: string;
  referenceRange: string;
  status: string;
};

type VerificationRecord = {
  id: string;
  documentName: string;
  documentType: string;
  patientName?: string;

  summary?: string;
  interpretation?: string;

  medications: Medication[];
  labResults?: LabResult[];

  submittedAt: string;

  status:
    | "pending"
    | "Pending Review"
    | "approved"
    | "rejected";
};

export default function VerificationPage() {
  const router = useRouter();

  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [selectedRecord, setSelectedRecord] =
    useState<VerificationRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadRecords = useCallback(() => {
    try {
      /*
       Supports both storage keys.

       clinicianCases = records created by your prescription page
       verificationRecords = previous verification workflow
      */

      const clinicianCases = JSON.parse(
        localStorage.getItem("clinicianCases") || "[]"
      );

      const verificationRecords = JSON.parse(
        localStorage.getItem("verificationRecords") || "[]"
      );

      const allRecords: VerificationRecord[] = [
        ...clinicianCases,
        ...verificationRecords,
      ];

      /*
       Remove duplicate records with same ID
      */

      const uniqueRecords = Array.from(
        new Map(
          allRecords.map((record) => [
            record.id,
            {
              ...record,

              medications: Array.isArray(record.medications)
                ? record.medications
                : [],

              labResults: Array.isArray(record.labResults)
                ? record.labResults
                : [],
            },
          ])
        ).values()
      );

      /*
       Only pending records should appear in clinician queue
      */

      const pendingRecords = uniqueRecords.filter(
        (record) =>
          record.status === "pending" ||
          record.status === "Pending Review"
      );

      setRecords(pendingRecords);

      if (pendingRecords.length > 0) {
        setSelectedRecord(pendingRecords[0]);
      } else {
        setSelectedRecord(null);
      }
    } catch (error) {
      console.error("Failed to load verification records:", error);

      setRecords([]);
      setSelectedRecord(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadRecords, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadRecords]);

  function selectRecord(record: VerificationRecord) {
    setSelectedRecord({
      ...record,

      medications: [...(record.medications || [])],

      labResults: record.labResults
        ? [...record.labResults]
        : [],
    });

    setMessage("");
  }

  function updateSummary(value: string) {
    if (!selectedRecord) return;

    setSelectedRecord({
      ...selectedRecord,
      summary: value,
      interpretation: value,
    });
  }

  function updateMedication(
    index: number,
    field: keyof Medication,
    value: string
  ) {
    if (!selectedRecord) return;

    const updatedMedications = [
      ...(selectedRecord.medications || []),
    ];

    updatedMedications[index] = {
      ...updatedMedications[index],
      [field]: value,
    };

    setSelectedRecord({
      ...selectedRecord,
      medications: updatedMedications,
    });
  }

  function addMedication() {
    if (!selectedRecord) return;

    setSelectedRecord({
      ...selectedRecord,

      medications: [
        ...(selectedRecord.medications || []),

        {
          name: "",
          dosage: "",
          frequency: "",
          duration: "",
        },
      ],
    });
  }

  function removeMedication(index: number) {
    if (!selectedRecord) return;

    const updatedMedications =
      selectedRecord.medications.filter(
        (_, medicationIndex) =>
          medicationIndex !== index
      );

    setSelectedRecord({
      ...selectedRecord,
      medications: updatedMedications,
    });
  }

  function updateLabResult(
    index: number,
    field: keyof LabResult,
    value: string
  ) {
    if (!selectedRecord) return;

    const currentLabs = selectedRecord.labResults || [];

    const updatedLabResults = [...currentLabs];

    updatedLabResults[index] = {
      ...updatedLabResults[index],
      [field]: value,
    };

    setSelectedRecord({
      ...selectedRecord,
      labResults: updatedLabResults,
    });
  }

  function saveRecord(
    updatedRecord: VerificationRecord
  ) {
    try {
      const clinicianCases = JSON.parse(
        localStorage.getItem("clinicianCases") || "[]"
      );

      const verificationRecords = JSON.parse(
        localStorage.getItem("verificationRecords") || "[]"
      );

      /*
       Update record in clinicianCases
      */

      const updatedClinicianCases = clinicianCases.map(
        (record: VerificationRecord) =>
          record.id === updatedRecord.id
            ? updatedRecord
            : record
      );

      /*
       Update record in verificationRecords
      */

      const updatedVerificationRecords =
        verificationRecords.map(
          (record: VerificationRecord) =>
            record.id === updatedRecord.id
              ? updatedRecord
              : record
        );

      localStorage.setItem(
        "clinicianCases",
        JSON.stringify(updatedClinicianCases)
      );

      localStorage.setItem(
        "verificationRecords",
        JSON.stringify(updatedVerificationRecords)
      );
    } catch (error) {
      console.error(
        "Failed to save verification record:",
        error
      );
    }
  }

  function approveRecord() {
    if (!selectedRecord) return;

    const approvedRecord: VerificationRecord = {
      ...selectedRecord,
      status: "approved",
    };

    saveRecord(approvedRecord);

    const remainingRecords = records.filter(
      (record) =>
        record.id !== selectedRecord.id
    );

    setRecords(remainingRecords);

    setSelectedRecord(
      remainingRecords.length > 0
        ? remainingRecords[0]
        : null
    );

    setMessage(
      "Record approved successfully and removed from the verification queue."
    );
  }

  function rejectRecord() {
    if (!selectedRecord) return;

    const rejectedRecord: VerificationRecord = {
      ...selectedRecord,
      status: "rejected",
    };

    saveRecord(rejectedRecord);

    const remainingRecords = records.filter(
      (record) =>
        record.id !== selectedRecord.id
    );

    setRecords(remainingRecords);

    setSelectedRecord(
      remainingRecords.length > 0
        ? remainingRecords[0]
        : null
    );

    setMessage(
      "Record rejected and removed from the verification queue."
    );
  }

  function formatDate(date: string) {
    try {
      return new Date(date).toLocaleString();
    } catch {
      return date;
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7f7]">
        <div className="flex items-center gap-3 text-slate-500">
          <ClipboardCheck className="animate-pulse" />
          Loading verification queue...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7f7] p-6 md:p-8">

      {/* HEADER */}

      <div className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-start">

        <div>

          <button
            onClick={() => router.push("/")}
            className="mb-4 flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900"
          >
            ← Back to dashboard
          </button>

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
            Clinical Verification
          </p>

          <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
            Review AI-extracted records
          </h1>

          <p className="mt-3 text-slate-500">
            Verify, correct, and approve AI-generated medical information.
          </p>

        </div>

        {/* PENDING COUNT */}

        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">

          <div className="flex items-center gap-4">

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">

              <ClipboardCheck size={24} />

            </div>

            <div>

              <p className="text-sm text-slate-500">
                Pending reviews
              </p>

              <p className="text-2xl font-semibold text-slate-900">
                {records.length}
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* SUCCESS MESSAGE */}

      {message && (

        <div className="mb-6 flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-5 py-4 text-sm font-medium text-teal-800">

          <CheckCircle2 size={20} />

          {message}

        </div>

      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">

        {/* LEFT SIDEBAR */}

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="mb-6 flex items-start justify-between">

            <div>

              <h2 className="text-lg font-semibold text-slate-900">
                Verification queue
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Documents awaiting review
              </p>

            </div>

            <Clock
              size={20}
              className="text-slate-400"
            />

          </div>

          {records.length === 0 ? (

            <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center">

              <FileText
                size={38}
                className="mx-auto mb-4 text-slate-300"
              />

              <h3 className="font-medium text-slate-900">
                No cases available
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Submitted documents will appear here.
              </p>

            </div>

          ) : (

            <div className="space-y-3">

              {records.map((record) => (

                <button
                  key={record.id}
                  onClick={() =>
                    selectRecord(record)
                  }
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedRecord?.id === record.id
                      ? "border-teal-500 bg-teal-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50"
                  }`}
                >

                  <div className="flex items-start justify-between gap-3">

                    <div className="min-w-0">

                      <p className="truncate font-semibold text-slate-900">
                        {record.patientName || "Patient"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {record.documentType}
                      </p>

                    </div>

                    <span className="whitespace-nowrap rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                      Pending Review
                    </span>

                  </div>

                  <p className="mt-3 truncate text-xs text-slate-500">
                    {record.documentName}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    Submitted{" "}
                    {formatDate(record.submittedAt)}
                  </p>

                </button>

              ))}

            </div>

          )}

        </aside>

        {/* REVIEW PANEL */}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">

          {!selectedRecord ? (

            <div className="flex min-h-[600px] flex-col items-center justify-center text-center">

              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">

                <ShieldCheck
                  size={38}
                  className="text-slate-300"
                />

              </div>

              <h2 className="text-2xl font-semibold text-slate-900">
                Select a medical record
              </h2>

              <p className="mt-2 text-slate-500">
                Choose a document from the verification queue.
              </p>

            </div>

          ) : (

            <div className="space-y-8">

              {/* RECORD HEADER */}

              <div className="border-b border-slate-200 pb-6">

                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">

                  <div className="flex gap-4">

                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-100">

                      <UserRound
                        size={30}
                        className="text-slate-700"
                      />

                    </div>

                    <div>

                      <p className="text-sm text-slate-500">
                        Patient record
                      </p>

                      <h2 className="text-2xl font-semibold text-slate-900">

                        {selectedRecord.patientName ||
                          "Patient"}

                      </h2>

                      <p className="mt-1 text-sm text-slate-500">

                        {selectedRecord.documentType} ·{" "}

                        {selectedRecord.documentName}

                      </p>

                    </div>

                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600">

                    <Clock size={17} />

                    {formatDate(selectedRecord.submittedAt)}

                  </div>

                </div>

              </div>

              {/* AI NOTICE */}

              <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-5">

                <div className="flex items-start gap-3">

                  <ShieldCheck
                    size={22}
                    className="mt-0.5 shrink-0 text-teal-700"
                  />

                  <div>

                    <h3 className="font-semibold text-slate-800">
                      AI-generated clinical draft
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Review all extracted information carefully before
                      approving. AI output should not be considered a final
                      clinical decision without professional verification.
                    </p>

                  </div>

                </div>

              </div>

              {/* DOCUMENT INTERPRETATION */}

              <div>

                <div className="mb-3 flex items-center gap-2">

                  <FileText
                    size={21}
                    className="text-slate-600"
                  />

                  <h3 className="text-lg font-semibold text-slate-900">
                    Document interpretation
                  </h3>

                </div>

                <textarea
                  value={
                    selectedRecord.summary ||
                    selectedRecord.interpretation ||
                    ""
                  }
                  onChange={(event) =>
                    updateSummary(event.target.value)
                  }
                  rows={5}
                  className="w-full resize-none rounded-2xl border border-slate-300 bg-slate-50 p-5 leading-7 text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white"
                />

              </div>

              {/* LAB RESULTS */}

              {selectedRecord.labResults &&
                selectedRecord.labResults.length > 0 && (

                  <div>

                    <div className="mb-3 flex items-center gap-2">

                      <ClipboardCheck
                        size={21}
                        className="text-slate-600"
                      />

                      <h3 className="text-lg font-semibold text-slate-900">
                        Key information
                      </h3>

                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200">

                      <div className="overflow-x-auto">

                        <table className="w-full min-w-[750px] text-left">

                          <thead className="bg-slate-50">

                            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">

                              <th className="px-4 py-4">
                                Test name
                              </th>

                              <th className="px-4 py-4">
                                Result
                              </th>

                              <th className="px-4 py-4">
                                Unit
                              </th>

                              <th className="px-4 py-4">
                                Reference range
                              </th>

                              <th className="px-4 py-4">
                                Status
                              </th>

                            </tr>

                          </thead>

                          <tbody>

                            {selectedRecord.labResults.map(
                              (lab, index) => (

                                <tr
                                  key={index}
                                  className="border-b border-slate-100 last:border-none"
                                >

                                  <td className="px-4 py-3">

                                    <input
                                      value={lab.testName}
                                      onChange={(event) =>
                                        updateLabResult(
                                          index,
                                          "testName",
                                          event.target.value
                                        )
                                      }
                                      className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-teal-500"
                                    />

                                  </td>

                                  <td className="px-4 py-3">

                                    <input
                                      value={lab.result}
                                      onChange={(event) =>
                                        updateLabResult(
                                          index,
                                          "result",
                                          event.target.value
                                        )
                                      }
                                      className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-teal-500"
                                    />

                                  </td>

                                  <td className="px-4 py-3">

                                    <input
                                      value={lab.unit}
                                      onChange={(event) =>
                                        updateLabResult(
                                          index,
                                          "unit",
                                          event.target.value
                                        )
                                      }
                                      className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-teal-500"
                                    />

                                  </td>

                                  <td className="px-4 py-3">

                                    <input
                                      value={lab.referenceRange}
                                      onChange={(event) =>
                                        updateLabResult(
                                          index,
                                          "referenceRange",
                                          event.target.value
                                        )
                                      }
                                      className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-teal-500"
                                    />

                                  </td>

                                  <td className="px-4 py-3">

                                    <input
                                      value={lab.status}
                                      onChange={(event) =>
                                        updateLabResult(
                                          index,
                                          "status",
                                          event.target.value
                                        )
                                      }
                                      className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-teal-500"
                                    />

                                  </td>

                                </tr>

                              )
                            )}

                          </tbody>

                        </table>

                      </div>

                    </div>

                  </div>

                )}

              {/* MEDICATIONS */}

              <div>

                <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

                  <div className="flex items-start gap-3">

                    <Pill
                      size={22}
                      className="mt-1 text-slate-600"
                    />

                    <div>

                      <h3 className="text-lg font-semibold text-slate-900">
                        Medication entries
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Review and correct extracted prescriptions.
                      </p>

                    </div>

                  </div>

                  <button
                    onClick={addMedication}
                    className="flex items-center justify-center gap-2 rounded-xl border border-teal-600 px-4 py-2.5 text-sm font-medium text-teal-700 transition hover:bg-teal-50"
                  >

                    <Plus size={18} />

                    Add medication

                  </button>

                </div>

                {selectedRecord.medications.length === 0 ? (

                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">

                    <Pill
                      size={30}
                      className="mx-auto mb-3 text-slate-300"
                    />

                    <p className="font-medium text-slate-700">
                      No medications identified in this document.
                    </p>

                    <p className="mt-2 text-sm text-slate-500">
                      This may be a diagnostic, laboratory, or imaging report.
                    </p>

                  </div>

                ) : (

                  <div className="space-y-4">

                    {selectedRecord.medications.map(
                      (medication, index) => (

                        <div
                          key={index}
                          className="rounded-2xl border border-slate-200 p-5"
                        >

                          <div className="mb-4 flex items-center justify-between">

                            <p className="font-semibold text-slate-700">

                              Medication {index + 1}

                            </p>

                            <button
                              onClick={() =>
                                removeMedication(index)
                              }
                              className="flex items-center gap-2 text-sm font-medium text-red-600 transition hover:text-red-700"
                            >

                              <Trash2 size={16} />

                              Remove

                            </button>

                          </div>

                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

                            <div>

                              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Medication
                              </label>

                              <input
                                value={medication.name}
                                onChange={(event) =>
                                  updateMedication(
                                    index,
                                    "name",
                                    event.target.value
                                  )
                                }
                                placeholder="Medication name"
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500"
                              />

                            </div>

                            <div>

                              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Dosage
                              </label>

                              <input
                                value={medication.dosage}
                                onChange={(event) =>
                                  updateMedication(
                                    index,
                                    "dosage",
                                    event.target.value
                                  )
                                }
                                placeholder="e.g. 500 mg"
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500"
                              />

                            </div>

                            <div>

                              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Frequency
                              </label>

                              <input
                                value={medication.frequency}
                                onChange={(event) =>
                                  updateMedication(
                                    index,
                                    "frequency",
                                    event.target.value
                                  )
                                }
                                placeholder="e.g. Twice daily"
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500"
                              />

                            </div>

                            <div>

                              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Duration
                              </label>

                              <input
                                value={medication.duration}
                                onChange={(event) =>
                                  updateMedication(
                                    index,
                                    "duration",
                                    event.target.value
                                  )
                                }
                                placeholder="e.g. 7 days"
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-500"
                              />

                            </div>

                          </div>

                        </div>

                      )
                    )}

                  </div>

                )}

              </div>

              {/* CLINICAL DECISION */}

              <div className="border-t border-slate-200 pt-6">

                <div className="mb-5 flex items-start gap-3 rounded-xl bg-slate-50 p-4">

                  <ShieldCheck
                    size={20}
                    className="mt-0.5 shrink-0 text-teal-700"
                  />

                  <p className="text-sm leading-6 text-slate-600">

                    By approving this record, the clinician confirms that the
                    extracted information has been reviewed and verified.

                  </p>

                </div>

                <div className="flex flex-col gap-3 sm:flex-row">

                  <button
                    onClick={rejectRecord}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-6 py-4 font-medium text-red-600 transition hover:bg-red-50"
                  >

                    <XCircle size={20} />

                    Reject record

                  </button>

                  <button
                    onClick={approveRecord}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 px-6 py-4 font-semibold text-white transition hover:bg-teal-800"
                  >

                    <CheckCircle2 size={20} />

                    Approve verified record

                  </button>

                </div>

              </div>

            </div>

          )}

        </section>

      </div>

    </main>
  );
}
