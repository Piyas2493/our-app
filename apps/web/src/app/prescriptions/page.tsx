"use client";

import {
  ChangeEvent,
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRoundCheck,
  X,
} from "lucide-react";

import LogoutButton from "@/components/LogoutButton";
import { useLanguage } from "@/components/LanguageProvider";

type Medication = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
};

type LabResult = {
  testName?: string;
  name?: string;
  result?: string | number;
  value?: string | number;
  unit?: string;
  referenceRange?: string;
  reference_range?: string;
  status?: string;
};

type ExtractedData = {
  documentType?: string;
  document_type?: string;
  summary?: string;
  interpretation?: string;
  patientName?: string;

  patient?: {
    name?: string;
    age?: string;
    sex?: string;
    patientId?: string;
  };

  medications?: Medication[];
  labResults?: LabResult[];
  lab_results?: LabResult[];
  keyInformation?: LabResult[];

  [key: string]: unknown;
};

export default function PrescriptionsPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [extracting, setExtracting] =
    useState(false);

  const [extracted, setExtracted] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [data, setData] =
    useState<ExtractedData>({});

  const [medications, setMedications] =
    useState<Medication[]>([]);

  const [correctionRecordId, setCorrectionRecordId] =
    useState<string | null>(null);

  const [correctionRecord, setCorrectionRecord] =
    useState<any | null>(null);

  const [loadingCorrection, setLoadingCorrection] =
    useState(false);

  /* =========================================================
     CORRECTION / RESUBMISSION MODE
     ========================================================= */

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const id =
      params.get(
        "correctionRecordId"
      );

    if (!id) {
      return;
    }

    setCorrectionRecordId(id);
    setLoadingCorrection(true);

    let cancelled = false;

    async function loadCorrectionRecord() {
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
            t("prescriptions.errors.correctionLoadFailed")
          );
        }

        if (
          !response.ok ||
          !result?.success
        ) {
          throw new Error(
            result?.error ||
              t("prescriptions.errors.correctionLoadFailed")
          );
        }

        const record =
          Array.isArray(
            result.records
          )
            ? result.records.find(
                (item: any) =>
                  String(item.id) ===
                  String(id)
              )
            : null;

        if (!record) {
          throw new Error(
            t("prescriptions.errors.correctionNotFound")
          );
        }

        if (
          String(
            record.status
          ).toUpperCase() !==
          "REJECTED"
        ) {
          throw new Error(
            t("prescriptions.errors.correctionNotAwaiting")
          );
        }

        if (!cancelled) {
          setCorrectionRecord(
            record
          );

          /*
           * Pre-fill the current AI values so the patient
           * can see what was previously extracted.
           */
          setData({
            documentType:
              record.documentType,

            summary:
              record.interpretation,

            patientName:
              record.patientName,

            medications:
              Array.isArray(
                record.medications
              )
                ? record.medications
                : [],
          });

          setMedications(
            Array.isArray(
              record.medications
            )
              ? record.medications
              : []
          );
        }
      } catch (error) {
        console.error(
          "Unable to load correction record:",
          error
        );

        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : t("prescriptions.errors.correctionLoadFailed")
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCorrection(false);
        }
      }
    }

    void loadCorrectionRecord();

    return () => {
      cancelled = true;
    };
  }, [t]);

  /* =========================================================
     FILE SELECTION
     ========================================================= */

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setSelectedFile(file);
    setExtracted(false);
    setSubmitted(false);
    setSubmitting(false);
    setError("");
    setData({});
    setMedications([]);
  }

  function removeFile() {
    setSelectedFile(null);
    setExtracted(false);
    setSubmitted(false);
    setSubmitting(false);
    setError("");
    setData({});
    setMedications([]);
  }

  /* =========================================================
     AI EXTRACTION
     ========================================================= */

  async function handleExtraction() {
    if (!selectedFile) {
      setError(
        t("prescriptions.errors.noFile")
      );

      return;
    }

    setExtracting(true);
    setExtracted(false);
    setSubmitted(false);
    setError("");

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile
      );

      const response =
        await fetch(
          "/api/analyze-document",
          {
            method: "POST",
            body: formData,
          }
        );

      let result: any =
        null;

      try {
        result =
          await response.json();
      } catch {
        throw new Error(
          t("prescriptions.errors.invalidResponseRetry")
        );
      }

      console.log(
        "JeevanLink AI result:",
        result
      );

      if (
        !response.ok ||
        !result?.success
      ) {
        throw new Error(
          result?.error ||
            result?.message ||
            t("prescriptions.errors.analyzeFailed")
        );
      }

      const extractedData =
        result.data ||
        result.extractedData ||
        result.result ||
        result;

      setData(
        extractedData
      );

      if (
        Array.isArray(
          extractedData?.medications
        )
      ) {
        setMedications(
          extractedData.medications
        );
      } else {
        setMedications([]);
      }

      setExtracted(true);
    } catch (err) {
      console.error(
        "Document extraction error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : t("prescriptions.errors.analyzeFailed")
      );
    } finally {
      setExtracting(false);
    }
  }

  /* =========================================================
     MEDICATIONS
     ========================================================= */

  function addMedication() {
    setMedications(
      (previous) => [
        ...previous,
        {
          name: "",
          dosage: "",
          frequency: "",
          duration: "",
        },
      ]
    );
  }

  function updateMedication(
    index: number,
    field: keyof Medication,
    value: string
  ) {
    setMedications(
      (previous) =>
        previous.map(
          (
            medication,
            medicationIndex
          ) =>
            medicationIndex === index
              ? {
                  ...medication,
                  [field]: value,
                }
              : medication
        )
    );
  }

  function removeMedication(
    index: number
  ) {
    setMedications(
      (previous) =>
        previous.filter(
          (
            _,
            medicationIndex
          ) =>
            medicationIndex !==
            index
        )
    );
  }

  /* =========================================================
     SEND FOR VERIFICATION
     ========================================================= */

  async function sendForVerification() {
    if (
      !selectedFile ||
      !extracted
    ) {
      alert(
        t("prescriptions.errors.notAnalyzed")
      );

      return;
    }

    if (
      submitted ||
      submitting
    ) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      /*
       * STEP 1
       * Store the newly uploaded original/corrected document.
       */

      const uploadFormData =
        new FormData();

      uploadFormData.append(
        "file",
        selectedFile
      );

      const uploadResponse =
        await fetch(
          "/api/upload-document",
          {
            method: "POST",
            credentials: "include",
            body: uploadFormData,
          }
        );

      let uploadResult: any =
        null;

      try {
        uploadResult =
          await uploadResponse.json();
      } catch {
        throw new Error(
          t("prescriptions.errors.uploadInvalidResponse")
        );
      }

      if (
        !uploadResponse.ok ||
        !uploadResult?.success
      ) {
        throw new Error(
          uploadResult?.error ||
            t("prescriptions.errors.uploadFailed")
        );
      }

      const originalFileUrl =
        uploadResult.file?.url;

      const originalFileType =
        uploadResult.file?.type;

      if (!originalFileUrl) {
        throw new Error(
          t("prescriptions.errors.noFileReference")
        );
      }

      /*
       * STEP 2
       * Prepare extracted data.
       */

      const patientName =
        data.patientName ||
        data.patient?.name ||
        correctionRecord?.patientName ||
        "Patient";

      const documentType =
        data.documentType ||
        data.document_type ||
        correctionRecord?.documentType ||
        "Medical Document";

      const interpretation =
        data.summary ||
        data.interpretation ||
        "AI extracted information from the uploaded medical document.";

      const validMedications =
        medications
          .filter(
            (medication) =>
              medication &&
              typeof medication.name ===
                "string" &&
              medication.name
                .trim()
                .length > 0
          )
          .map(
            (medication) => ({
              name:
                medication.name.trim(),

              dosage:
                medication.dosage?.trim() ||
                null,

              frequency:
                medication.frequency?.trim() ||
                null,

              duration:
                medication.duration?.trim() ||
                null,
            })
          );

      /*
       * STEP 3
       *
       * NORMAL SUBMISSION:
       * create a new PENDING record.
       *
       * CORRECTION:
       * update the SAME rejected record:
       * REJECTED -> PENDING.
       */

      if (correctionRecordId) {
        const updateResponse =
          await fetch(
            "/api/medical-records",
            {
              method: "PATCH",

              headers: {
                "Content-Type":
                  "application/json",
              },

              credentials: "include",

              cache: "no-store",

              body: JSON.stringify({
                id:
                  correctionRecordId,

                status:
                  "PENDING",

                interpretation,

                medications:
                  validMedications,

                documentName:
                  selectedFile.name,

                documentType,

                originalFileUrl,

                originalFileType,
              }),
            }
          );

        let updateResult: any =
          null;

        try {
          updateResult =
            await updateResponse.json();
        } catch {
          throw new Error(
            t("prescriptions.errors.resubmitInvalidResponse")
          );
        }

        if (
          !updateResponse.ok ||
          !updateResult?.success
        ) {
          throw new Error(
            updateResult?.error ||
              t("prescriptions.errors.resubmitFailed")
          );
        }

        setSubmitted(true);

        alert(
          t("prescriptions.success.resubmitted")
        );

        router.push(
          "/records"
        );

        router.refresh();

        return;
      }

      /*
       * NORMAL NEW SUBMISSION
       */

      const recordResponse =
        await fetch(
          "/api/medical-records",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials: "include",

            body: JSON.stringify({
              patientName,

              documentName:
                selectedFile.name,

              documentType,

              interpretation,

              medications:
                validMedications,

              originalFileUrl,

              originalFileType,
            }),
          }
        );

      let recordResult: any =
        null;

      try {
        recordResult =
          await recordResponse.json();
      } catch {
        throw new Error(
          t("prescriptions.errors.createInvalidResponse")
        );
      }

      if (
        !recordResponse.ok ||
        !recordResult?.success
      ) {
        throw new Error(
          recordResult?.error ||
            t("prescriptions.errors.createFailed")
        );
      }

      console.log(
        "JeevanLink medical record created:",
        recordResult.record
      );

      setSubmitted(true);

      alert(
        t("prescriptions.success.sent")
      );

      router.push(
        "/records"
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Unable to submit medical record:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : t("prescriptions.errors.sendFailed");

      setError(message);

      alert(message);
    } finally {
      setSubmitting(false);
    }
  }

  /* =========================================================
     DISPLAY VALUES
     ========================================================= */

  const documentType =
    data.documentType ||
    data.document_type ||
    t("prescriptions.display.documentTypeFallback");

  const summary =
    data.summary ||
    data.interpretation ||
    t("prescriptions.display.summaryFallback");

  const labResults =
    data.labResults ||
    data.lab_results ||
    data.keyInformation ||
    [];

  const fileSize =
    selectedFile
      ? `${(
          selectedFile.size /
          1024
        ).toFixed(1)} KB`
      : "";

  /* =========================================================
     PAGE
     ========================================================= */

  return (
    <main className="min-h-screen bg-[#f5f7f7] px-5 py-5 md:px-8 lg:px-12">

      {/* =====================================================
          HERO
          ===================================================== */}

      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-r from-[#f8fbfa] via-[#f4f8f8] to-[#dceff0] px-8 py-8 shadow-sm md:px-12 md:py-10">

        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">

          <div className="w-full">

            {/* TOP CONTROLS */}

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900"
              >
                <ArrowLeft size={17} />
                {t("prescriptions.backDashboard")}
              </Link>

              <LogoutButton />

            </div>

            <div className="mb-4 flex items-center gap-2">

              <ShieldCheck
                size={17}
                className="text-emerald-700"
              />

              <span className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-800">
                {t("prescriptions.eyebrow")}
              </span>

            </div>

            <h1 className="max-w-2xl font-serif text-5xl leading-[1.05] text-slate-800 md:text-6xl">

              {t("prescriptions.title.part1")}
              <br />

              {t("prescriptions.title.part2")}{" "}

              <span className="text-[#23766d]">
                {t("prescriptions.title.highlight")}
              </span>

            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">

              {t("prescriptions.description.line1")}

              <br />

              {t("prescriptions.description.line2")}

            </p>

          </div>

          {/* PROCESS STEPS */}

          <div className="w-full max-w-[300px] rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur lg:mr-2">

            <div className="relative">

              <div className="absolute left-[21px] top-8 h-[110px] w-px bg-slate-200" />

              <div className="relative flex items-center gap-4">

                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-600 bg-emerald-50 text-emerald-700">
                  <Upload size={19} />
                </div>

                <div className="flex-1">

                  <p className="font-semibold text-slate-800">
                    {t("prescriptions.steps.upload.title")}
                  </p>

                  <p className="text-xs text-slate-500">
                    {t("prescriptions.steps.upload.subtitle")}
                  </p>

                </div>

                {selectedFile && (
                  <CheckCircle2
                    size={19}
                    className="text-emerald-600"
                  />
                )}

              </div>

              <div className="relative mt-5 flex items-center gap-4">

                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full border ${
                    extracted
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 bg-white text-slate-500"
                  }`}
                >
                  <Sparkles size={19} />
                </div>

                <div className="flex-1">

                  <p className="font-semibold text-slate-800">
                    {t("prescriptions.steps.extract.title")}
                  </p>

                  <p className="text-xs text-slate-500">
                    {t("prescriptions.steps.extract.subtitle")}
                  </p>

                </div>

                {extracted && (
                  <CheckCircle2
                    size={19}
                    className="text-emerald-600"
                  />
                )}

              </div>

              <div className="relative mt-5 flex items-center gap-4">

                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full border ${
                    submitted
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 bg-white text-slate-500"
                  }`}
                >
                  <UserRoundCheck size={19} />
                </div>

                <div className="flex-1">

                  <p className="font-semibold text-slate-800">
                    {correctionRecord
                      ? t("prescriptions.steps.verify.resubmitTitle")
                      : t("prescriptions.steps.verify.title")}
                  </p>

                  <p className="text-xs text-slate-500">
                    {correctionRecord
                      ? t("prescriptions.steps.verify.resubmitSubtitle")
                      : t("prescriptions.steps.verify.subtitle")}
                  </p>

                </div>

                {submitted && (
                  <CheckCircle2
                    size={19}
                    className="text-emerald-600"
                  />
                )}

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* =====================================================
          MAIN CONTENT
          ===================================================== */}

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(330px,0.9fr)_minmax(600px,1.7fr)]">

        {/* UPLOAD CARD */}

        <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex items-start gap-4">

            <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
              <FileText size={24} />
            </div>

            <div>

              <h2 className="text-lg font-semibold text-slate-800">
                {correctionRecord
                  ? t("prescriptions.upload.correctedTitle")
                  : t("prescriptions.upload.title")}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {correctionRecord
                  ? t("prescriptions.upload.correctedDescription")
                  : t("prescriptions.upload.description")}
              </p>


            </div>

          {correctionRecord && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">

              <p className="text-sm font-semibold text-amber-900">
                {t("prescriptions.upload.correctionNoticeTitle")}
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                {correctionRecord.rejectionReason ||
                  t("prescriptions.upload.correctionNoticeDefault")}
              </p>

            </div>
          )}

          </div>

          {!selectedFile && (

            <label className="mt-7 flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center transition hover:border-emerald-500 hover:bg-emerald-50/30">

              <div className="rounded-full bg-white p-4 text-slate-600 shadow-sm">
                <Upload size={28} />
              </div>

              <p className="mt-4 font-medium text-slate-800">
                {t("prescriptions.upload.dragDrop")}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {t("prescriptions.upload.browse")}
              </p>

              <p className="mt-3 text-xs text-slate-400">
                {t("prescriptions.upload.fileTypes")}
              </p>

              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={
                  handleFileChange
                }
              />

            </label>

          )}

          {selectedFile && (

            <div className="mt-7 flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">

              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                <FileText size={26} />
              </div>

              <div className="min-w-0 flex-1">

                <p className="truncate font-semibold text-slate-800">
                  {selectedFile.name}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {fileSize} · {t("prescriptions.upload.readyForProcessing")}
                </p>

              </div>

              <div className="hidden rounded-full bg-emerald-100 p-1 text-emerald-700 sm:block">
                <Check size={17} />
              </div>

              <button
                onClick={
                  removeFile
                }
                disabled={
                  extracting ||
                  submitting
                }
                className="rounded-full p-2 text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed"
                aria-label={t("prescriptions.upload.removeFile")}
              >
                <X size={20} />
              </button>

            </div>

          )}

          {error && (

            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>

          )}

          <button
            onClick={
              handleExtraction
            }
            disabled={
              !selectedFile ||
              extracting ||
              submitting
            }
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#13776b] px-5 py-4 font-semibold text-white transition hover:bg-[#0d655b] disabled:cursor-not-allowed disabled:opacity-50"
          >

            {extracting ? (

              <>
                <Loader2
                  size={20}
                  className="animate-spin"
                />

                {t("prescriptions.upload.analyzing")}
              </>

            ) : (

              <>
                <Sparkles size={20} />

                {t("prescriptions.upload.extractButton")}
              </>

            )}

          </button>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-4">

            <ShieldCheck
              size={19}
              className="mt-0.5 shrink-0 text-blue-700"
            />

            <p className="text-sm leading-5 text-slate-600">
              {t("prescriptions.upload.safetyNote")}
            </p>

          </div>

        </div>

        {/* AI EXTRACTED PANEL */}

        <div className="min-h-[550px] rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-start">

            <div className="flex gap-4">

              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                <Sparkles size={24} />
              </div>

              <div>

                <h2 className="text-lg font-semibold text-slate-800">
                  {t("prescriptions.panel.title")}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {t("prescriptions.panel.description")}
                </p>

              </div>

            </div>

            {extracted && (

              <div className="text-left md:text-right">

                <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">

                  <CheckCircle2
                    size={16}
                  />

                  {t("prescriptions.panel.completed")}

                </div>

                <p className="mt-2 text-xs text-slate-500">
                  {t("prescriptions.panel.reviewNote")}
                </p>

              </div>

            )}

          </div>

          {!extracted &&
            !extracting && (

              <div className="flex min-h-[400px] flex-col items-center justify-center text-center">

                <div className="rounded-full bg-slate-100 p-6 text-slate-400">
                  <Sparkles size={40} />
                </div>

                <h3 className="mt-5 text-lg font-semibold text-slate-700">
                  {t("prescriptions.panel.awaitingTitle")}
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">

                  {t("prescriptions.panel.awaitingPrefix")}{" "}

                  <span className="font-medium text-slate-700">
                    {t("prescriptions.upload.extractButton")}
                  </span>{" "}

                  {t("prescriptions.panel.awaitingSuffix")}

                </p>

              </div>

            )}

          {extracting && (

            <div className="flex min-h-[400px] flex-col items-center justify-center text-center">

              <Loader2
                size={42}
                className="animate-spin text-emerald-700"
              />

              <h3 className="mt-5 text-lg font-semibold text-slate-800">
                {t("prescriptions.panel.analyzingTitle")}
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                {t("prescriptions.panel.analyzingSubtitle")}
              </p>

            </div>

          )}

          {extracted && (

            <div className="space-y-4 pt-5">

              {/* DOCUMENT INTERPRETATION */}

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">

                <div className="mb-4 flex items-center gap-2">

                  <FileText
                    size={18}
                    className="text-slate-700"
                  />

                  <h3 className="font-semibold text-slate-800">
                    {t("prescriptions.interpretation.title")}
                  </h3>

                </div>

                <div className="grid gap-4 md:grid-cols-[220px_1fr]">

                  <div className="rounded-xl border border-slate-200 bg-white p-4">

                    <p className="text-xs font-medium text-slate-500">
                      {t("prescriptions.interpretation.documentType")}
                    </p>

                    <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">

                      <FlaskConical
                        size={16}
                      />

                      {documentType}

                    </div>

                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">

                    <p className="text-xs font-medium text-slate-500">
                      {t("prescriptions.interpretation.summary")}
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {summary}
                    </p>

                  </div>

                </div>

              </div>

              {/* LAB RESULTS */}

              {Array.isArray(
                labResults
              ) &&
                labResults.length >
                  0 && (

                  <div className="overflow-hidden rounded-2xl border border-slate-200">

                    <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">

                      <ClipboardCheck
                        size={18}
                        className="text-slate-700"
                      />

                      <h3 className="font-semibold text-slate-800">
                        {t("prescriptions.labResults.title")}
                      </h3>

                    </div>

                    <div className="overflow-x-auto">

                      <table className="w-full text-left text-sm">

                        <thead className="border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-slate-500">

                          <tr>

                            <th className="px-4 py-3">
                              {t("prescriptions.labResults.testName")}
                            </th>

                            <th className="px-4 py-3">
                              {t("prescriptions.labResults.result")}
                            </th>

                            <th className="px-4 py-3">
                              {t("prescriptions.labResults.unit")}
                            </th>

                            <th className="px-4 py-3">
                              {t("prescriptions.labResults.referenceRange")}
                            </th>

                            <th className="px-4 py-3">
                              {t("prescriptions.labResults.status")}
                            </th>

                          </tr>

                        </thead>

                        <tbody>

                          {labResults.map(
                            (
                              item,
                              index
                            ) => {

                              const testName =
                                item.testName ||
                                item.name ||
                                t("prescriptions.labResults.notSpecified");

                              const resultValue =
                                item.result ??
                                item.value ??
                                "—";

                              const referenceRange =
                                item.referenceRange ||
                                item.reference_range ||
                                "—";

                              const status =
                                item.status ||
                                t("prescriptions.labResults.reviewed");

                              return (

                                <tr
                                  key={
                                    index
                                  }
                                  className="border-b border-slate-100 last:border-0"
                                >

                                  <td className="px-4 py-4 font-medium text-slate-800">
                                    {
                                      testName
                                    }
                                  </td>

                                  <td className="px-4 py-4 text-slate-700">
                                    {
                                      resultValue
                                    }
                                  </td>

                                  <td className="px-4 py-4 text-slate-600">
                                    {
                                      item.unit ||
                                      "—"
                                    }
                                  </td>

                                  <td className="px-4 py-4 text-slate-600">
                                    {
                                      referenceRange
                                    }
                                  </td>

                                  <td className="px-4 py-4">

                                    <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                                      {
                                        status
                                      }
                                    </span>

                                  </td>

                                </tr>

                              );
                            }
                          )}

                        </tbody>

                      </table>

                    </div>

                  </div>

                )}

              {/* MEDICATIONS */}

              <div className="rounded-2xl border border-slate-200">

                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">

                  <ClipboardCheck
                    size={18}
                    className="text-slate-700"
                  />

                  <h3 className="font-semibold text-slate-800">
                    {t("records.medications.title")}
                  </h3>

                </div>

                <div className="p-4">

                  {medications.length ===
                  0 ? (

                    <div>

                      <p className="font-medium text-slate-700">
                        {t("prescriptions.medications.none")}
                      </p>

                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {t("prescriptions.medications.noneHint")}
                      </p>

                    </div>

                  ) : (

                    <div className="space-y-4">

                      {medications.map(
                        (
                          medication,
                          index
                        ) => (

                          <div
                            key={
                              index
                            }
                            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                          >

                            <div className="mb-3 flex items-center justify-between">

                              <p className="font-semibold text-slate-700">
                                {t("prescriptions.medications.itemLabel")}{" "}
                                {index + 1}
                              </p>

                              <button
                                onClick={() =>
                                  removeMedication(
                                    index
                                  )
                                }
                                disabled={
                                  submitting ||
                                  submitted
                                }
                                className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >

                                <X
                                  size={
                                    18
                                  }
                                />

                              </button>

                            </div>

                            <div className="grid gap-3 md:grid-cols-2">

                              <input
                                value={
                                  medication.name
                                }
                                disabled={
                                  submitting ||
                                  submitted
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateMedication(
                                    index,
                                    "name",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder={t("prescriptions.medications.placeholderName")}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 disabled:opacity-60"
                              />

                              <input
                                value={
                                  medication.dosage
                                }
                                disabled={
                                  submitting ||
                                  submitted
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateMedication(
                                    index,
                                    "dosage",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder={t("prescriptions.medications.placeholderDosage")}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 disabled:opacity-60"
                              />

                              <input
                                value={
                                  medication.frequency
                                }
                                disabled={
                                  submitting ||
                                  submitted
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateMedication(
                                    index,
                                    "frequency",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder={t("prescriptions.medications.placeholderFrequency")}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 disabled:opacity-60"
                              />

                              <input
                                value={
                                  medication.duration
                                }
                                disabled={
                                  submitting ||
                                  submitted
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateMedication(
                                    index,
                                    "duration",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder={t("prescriptions.medications.placeholderDuration")}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 disabled:opacity-60"
                              />

                            </div>

                          </div>

                        )
                      )}

                    </div>

                  )}

                </div>

              </div>

              {/* ACTIONS */}

              <div className="grid gap-4 pt-1 md:grid-cols-2">

                <button
                  onClick={
                    addMedication
                  }
                  disabled={
                    submitting ||
                    submitted
                  }
                  className="flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-white px-5 py-3.5 font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  <Plus
                    size={19}
                  />

                  {t("prescriptions.medications.add")}

                </button>

                <button
                  onClick={
                    sendForVerification
                  }
                  disabled={
                    submitted ||
                    submitting
                  }
                  className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${
                    submitted
                      ? "bg-emerald-800"
                      : "bg-[#13776b] hover:bg-[#0d655b]"
                  }`}
                >

                  {submitting ? (

                    <>
                      <Loader2
                        size={19}
                        className="animate-spin"
                      />

                      {t("prescriptions.actions.sending")}
                    </>

                  ) : submitted ? (

                    <>
                      <CheckCircle2
                        size={19}
                      />

                      {t("prescriptions.actions.sent")}
                    </>

                  ) : (

                    <>
                      <ShieldCheck
                        size={19}
                      />

                      {t("prescriptions.actions.send")}
                    </>

                  )}

                </button>

              </div>

            </div>

          )}

        </div>

      </section>

    </main>
  );
}