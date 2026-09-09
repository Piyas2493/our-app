"use client";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  HeartPulse,
  History,
  LockKeyhole,
  MessageSquareWarning,
  Pill,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";

import LogoutButton from "@/components/LogoutButton";
import VitalTrendPanel from "@/components/clinician/VitalTrendPanel";
import ClinicalHistoryPanel from "@/components/clinician/ClinicalHistoryPanel";

/* =========================================================
   TYPES
   ========================================================= */

type Medication = {
  id?: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
};

type Audit = {
  id: string;
  action: string;
  note: string | null;
  createdAt: string;
  clinicianId?: string | null;
};

type VerificationStatus =
  | "Pending Review"
  | "Verified"
  | "Needs Correction";

type LabReportSummary = {
  id: string;
  reportNumber?: string | null;
  testName: string;
  testCategory?: string | null;
  status: string;
  resultSummary?: string | null;
  reportDate: string;
  finalizedAt?: string | null;
  digitallyReceived?: boolean;
  sourceDocumentUrl?: string | null;
  sourceDocumentType?: string | null;
  notes?: string | null;
  lab?: {
    id: string;
    name: string;
    code?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  labOrder?: {
    id: string;
    orderNumber?: string | null;
    status?: string | null;
    orderedAt?: string | null;
  } | null;
};

type MedicalRecord = {
  id: string;
  patientId?: string | null;
  patientName: string;
  documentName: string;
  documentType: string;
  interpretation: string;
  status:
    | "PENDING"
    | "VERIFIED"
    | "REJECTED";
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  originalFileUrl?: string | null;
  originalFileType?: string | null;
  labReport?: LabReportSummary | null;
  medications: Medication[];
  verificationAudits?: Audit[];
};

type VerificationCase = {
  id: string;
  patientId?: string | null;
  patientName: string;
  documentName: string;
  documentType: string;
  submittedAt: string;
  interpretation: string;
  medications: Medication[];
  status: VerificationStatus;
  correctionNote?: string;
  reviewedAt?: string;
  originalFileUrl?: string | null;
  originalFileType?: string | null;
  labReport?: LabReportSummary | null;
  verificationAudits: Audit[];
};

type Vital = {
  id: string;
  vitalType: string;
  value?: number | null;
  secondaryValue?: number | null;
  unit: string;
  recordedAt: string;
  source: string;
  deviceName?: string | null;
  notes?: string | null;
};

type PatientSnapshot = {
  patient: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  records: MedicalRecord[];
  vitals: Vital[];
};

/* =========================================================
   CLINICAL INTAKE DRAFT
   Structured patient-reported history captured through the
   AI-assisted case-taking flow (clinical-intake). Distinct
   from a plain uploaded document: this is edited field by
   field rather than as a single interpretation blob.
   ========================================================= */

type ClinicalIntakeDraft = {
  preferredLanguage?: string;
  mode?: string;
  consent?: Record<string, boolean>;
  chiefComplaint: string;
  hpi: {
    onset: string;
    duration: string;
    character: string;
    location: string;
    radiation: string;
    severity: string;
    aggravating: string;
    relieving: string;
    associatedSymptoms: string;
  };
  pastMedicalHistory: string[];
  pastSurgicalHistory: string[];
  medications: string[];
  allergies: string[];
  familyHistory: string[];
  personalHistory: {
    diet: string;
    sleep: string;
    smoking: string;
    alcohol: string;
    occupation: string;
  };
  reviewOfSystems: Record<string, string>;
  priorInvestigations: string[];
  ayush: Record<string, string>;
  redFlags: string[];
  sourceDocuments?: Array<{ name: string; type: string; url: string }>;
};

const AYUSH_FIELD_LABELS: Array<[string, string]> = [
  ["prakriti", "Prakriti"],
  ["vikriti", "Vikriti"],
  ["sara", "Sara"],
  ["samhanana", "Samhanana"],
  ["pramana", "Pramana"],
  ["satmya", "Satmya"],
  ["satva", "Satva"],
  ["aharaShakti", "Ahara Shakti"],
  ["vyayamaShakti", "Vyayama Shakti"],
  ["vaya", "Vaya"],
];

const HPI_FIELD_LABELS: Array<[keyof ClinicalIntakeDraft["hpi"], string]> = [
  ["onset", "Onset"],
  ["duration", "Duration"],
  ["character", "Character"],
  ["location", "Location"],
  ["radiation", "Radiation"],
  ["severity", "Severity"],
  ["aggravating", "Aggravating factors"],
  ["relieving", "Relieving factors"],
  ["associatedSymptoms", "Associated symptoms"],
];

function parseClinicalIntake(
  interpretation: string
): ClinicalIntakeDraft | null {
  try {
    const parsed = JSON.parse(interpretation);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.chiefComplaint !== "string" ||
      !parsed.hpi ||
      typeof parsed.hpi !== "object"
    ) {
      return null;
    }

    return {
      preferredLanguage: parsed.preferredLanguage,
      mode: parsed.mode,
      consent: parsed.consent || {},
      chiefComplaint: String(parsed.chiefComplaint || ""),
      hpi: {
        onset: String(parsed.hpi.onset || ""),
        duration: String(parsed.hpi.duration || ""),
        character: String(parsed.hpi.character || ""),
        location: String(parsed.hpi.location || ""),
        radiation: String(parsed.hpi.radiation || ""),
        severity: String(parsed.hpi.severity || ""),
        aggravating: String(parsed.hpi.aggravating || ""),
        relieving: String(parsed.hpi.relieving || ""),
        associatedSymptoms: String(parsed.hpi.associatedSymptoms || ""),
      },
      pastMedicalHistory: Array.isArray(parsed.pastMedicalHistory)
        ? parsed.pastMedicalHistory.map(String)
        : [],
      pastSurgicalHistory: Array.isArray(parsed.pastSurgicalHistory)
        ? parsed.pastSurgicalHistory.map(String)
        : [],
      medications: Array.isArray(parsed.medications)
        ? parsed.medications.map(String)
        : [],
      allergies: Array.isArray(parsed.allergies)
        ? parsed.allergies.map(String)
        : [],
      familyHistory: Array.isArray(parsed.familyHistory)
        ? parsed.familyHistory.map(String)
        : [],
      personalHistory: {
        diet: String(parsed.personalHistory?.diet || ""),
        sleep: String(parsed.personalHistory?.sleep || ""),
        smoking: String(parsed.personalHistory?.smoking || ""),
        alcohol: String(parsed.personalHistory?.alcohol || ""),
        occupation: String(parsed.personalHistory?.occupation || ""),
      },
      reviewOfSystems:
        parsed.reviewOfSystems && typeof parsed.reviewOfSystems === "object"
          ? parsed.reviewOfSystems
          : {},
      priorInvestigations: Array.isArray(parsed.priorInvestigations)
        ? parsed.priorInvestigations.map(String)
        : [],
      ayush:
        parsed.ayush && typeof parsed.ayush === "object" ? parsed.ayush : {},
      redFlags: Array.isArray(parsed.redFlags)
        ? parsed.redFlags.map(String)
        : [],
      sourceDocuments: Array.isArray(parsed.sourceDocuments)
        ? parsed.sourceDocuments
        : [],
    };
  } catch {
    return null;
  }
}

function joinClinicalList(values: string[]) {
  return values.join("\n");
}

function splitClinicalList(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isClinicalIntake(documentType: string) {
  return (
    String(documentType || "").trim().toUpperCase() === "CLINICAL_INTAKE"
  );
}

/* =========================================================
   STATUS HELPERS
   ========================================================= */

function normalizeStatus(
  status: MedicalRecord["status"]
): VerificationStatus {
  if (status === "VERIFIED") {
    return "Verified";
  }

  if (status === "REJECTED") {
    return "Needs Correction";
  }

  return "Pending Review";
}

/* =========================================================
   RECORD MAPPER
   ========================================================= */

function mapRecordToCase(
  record: MedicalRecord
): VerificationCase {
  return {
    id: record.id,

    patientId:
      record.patientId ?? null,

    patientName:
      record.patientName ||
      "Patient",

    documentName:
      record.documentName ||
      "Medical Document",

    documentType:
      record.documentType ||
      "Medical Document",

    submittedAt:
      record.createdAt,

    interpretation:
      record.interpretation ||
      "",

    medications:
      Array.isArray(
        record.medications
      )
        ? record.medications
        : [],

    status:
      normalizeStatus(
        record.status
      ),

    correctionNote:
      record.rejectionReason ||
      "",

    reviewedAt:
      record.verifiedAt ||
      undefined,

    originalFileUrl:
      record.originalFileUrl ||
      null,

    originalFileType:
      record.originalFileType ||
      null,

    labReport: record.labReport || null,

    verificationAudits:
      Array.isArray(
        record.verificationAudits
      )
        ? record.verificationAudits
        : [],
  };
}

/* =========================================================
   RED FLAGS
   Cases from the AI-assisted case-taking flow may carry
   patient-reported red flags detected at submission time.
   ========================================================= */

function getCaseRedFlags(item: VerificationCase): string[] {
  if (!isClinicalIntake(item.documentType)) {
    return [];
  }

  return parseClinicalIntake(item.interpretation || "")?.redFlags || [];
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

  const date = new Date(
    value
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

/* =========================================================
   VITAL HELPERS
   ========================================================= */

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
    vitalType.replaceAll(
      "_",
      " "
    )
  );
}

function formatVitalValue(
  vital: Vital
) {
  if (
    vital.vitalType ===
      "BLOOD_PRESSURE" &&
    vital.value != null &&
    vital.secondaryValue !=
      null
  ) {
    return `${vital.value}/${vital.secondaryValue}`;
  }

  if (vital.value == null) {
    return "Not available";
  }

  return String(
    vital.value
  );
}

function formatVitalUnit(
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

function getLatestVitals(
  vitals: Vital[]
) {
  const map =
    new Map<string, Vital>();

  const sorted =
    [...vitals].sort(
      (first, second) =>
        new Date(
          second.recordedAt
        ).getTime() -
        new Date(
          first.recordedAt
        ).getTime()
    );

  for (const vital of sorted) {
    if (
      !map.has(
        vital.vitalType
      )
    ) {
      map.set(
        vital.vitalType,
        vital
      );
    }
  }

  return Array.from(
    map.values()
  ).slice(0, 8);
}

/* =========================================================
   CLINICAL INTAKE REVIEW
   Structured, field-by-field editing of a patient-reported
   clinical intake draft, including the Dashavidha Pariksha
   (AYUSH) fields when the patient chose AYUSH-mode intake.
   ========================================================= */

function IntakeField({
  label,
  value,
  onChange,
  disabled,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          rows={3}
          className="w-full rounded-xl border bg-slate-50 p-3 text-sm leading-6 outline-none focus:border-teal-500 disabled:opacity-60"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="w-full rounded-xl border bg-slate-50 p-3 text-sm outline-none focus:border-teal-500 disabled:opacity-60"
        />
      )}
    </label>
  );
}

function IntakeListField({
  label,
  helpText,
  values,
  onChange,
  disabled,
}: {
  label: string;
  helpText?: string;
  values: string[];
  onChange: (values: string[]) => void;
  disabled: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {helpText && (
        <span className="mb-1.5 block text-xs text-slate-400">
          {helpText}
        </span>
      )}
      <textarea
        value={joinClinicalList(values)}
        onChange={(event) =>
          onChange(splitClinicalList(event.target.value))
        }
        disabled={disabled}
        rows={3}
        placeholder="One item per line"
        className="w-full rounded-xl border bg-slate-50 p-3 text-sm leading-6 outline-none focus:border-teal-500 disabled:opacity-60"
      />
    </label>
  );
}

function ClinicalIntakeReview({
  draft,
  onChange,
  disabled,
}: {
  draft: ClinicalIntakeDraft;
  onChange: (value: ClinicalIntakeDraft) => void;
  disabled: boolean;
}) {
  const isAyush =
    draft.mode === "AYUSH" ||
    AYUSH_FIELD_LABELS.some(([key]) => (draft.ayush[key] || "").trim());

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-4">
        <p className="text-sm font-semibold text-teal-900">
          Structured clinical-intake verification
        </p>
        <p className="mt-1 text-sm leading-6 text-teal-800">
          This is the patient&apos;s own AI-assisted case-taking history.
          Review each field against the original document and correct
          the draft before verification.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Stethoscope size={20} className="text-teal-700" />
          <h3 className="font-semibold">Chief complaint</h3>
        </div>
        <textarea
          value={draft.chiefComplaint}
          onChange={(event) =>
            onChange({ ...draft, chiefComplaint: event.target.value })
          }
          disabled={disabled}
          rows={3}
          className="w-full rounded-xl border bg-slate-50 p-3 leading-6 outline-none focus:border-teal-500 disabled:opacity-60"
        />
      </div>

      <div className="rounded-2xl border bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <History size={20} className="text-teal-700" />
          <h3 className="font-semibold">History of present illness</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {HPI_FIELD_LABELS.map(([field, label]) => (
            <IntakeField
              key={field}
              label={label}
              value={draft.hpi[field]}
              onChange={(value) =>
                onChange({
                  ...draft,
                  hpi: { ...draft.hpi, [field]: value },
                })
              }
              disabled={disabled}
              multiline={field === "associatedSymptoms"}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileText size={20} className="text-teal-700" />
          <h3 className="font-semibold">Past &amp; current history</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <IntakeListField
            label="Past medical history"
            values={draft.pastMedicalHistory}
            onChange={(values) =>
              onChange({ ...draft, pastMedicalHistory: values })
            }
            disabled={disabled}
          />
          <IntakeListField
            label="Past surgical history"
            values={draft.pastSurgicalHistory}
            onChange={(values) =>
              onChange({ ...draft, pastSurgicalHistory: values })
            }
            disabled={disabled}
          />
          <IntakeListField
            label="Allergies"
            values={draft.allergies}
            onChange={(values) => onChange({ ...draft, allergies: values })}
            disabled={disabled}
          />
          <IntakeListField
            label="Family history"
            values={draft.familyHistory}
            onChange={(values) =>
              onChange({ ...draft, familyHistory: values })
            }
            disabled={disabled}
          />
          <IntakeListField
            label="Prior investigations"
            values={draft.priorInvestigations}
            onChange={(values) =>
              onChange({ ...draft, priorInvestigations: values })
            }
            disabled={disabled}
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserRound size={20} className="text-teal-700" />
          <h3 className="font-semibold">Personal history</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              ["diet", "Diet"],
              ["sleep", "Sleep"],
              ["smoking", "Smoking"],
              ["alcohol", "Alcohol"],
              ["occupation", "Occupation"],
            ] as Array<[keyof ClinicalIntakeDraft["personalHistory"], string]>
          ).map(([field, label]) => (
            <IntakeField
              key={field}
              label={label}
              value={draft.personalHistory[field]}
              onChange={(value) =>
                onChange({
                  ...draft,
                  personalHistory: {
                    ...draft.personalHistory,
                    [field]: value,
                  },
                })
              }
              disabled={disabled}
            />
          ))}
        </div>
      </div>

      {Object.keys(draft.reviewOfSystems).length > 0 && (
        <div className="rounded-2xl border bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck size={20} className="text-teal-700" />
            <h3 className="font-semibold">Review of systems</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(draft.reviewOfSystems).map(([system, value]) => (
              <IntakeField
                key={system}
                label={system}
                value={value}
                onChange={(nextValue) =>
                  onChange({
                    ...draft,
                    reviewOfSystems: {
                      ...draft.reviewOfSystems,
                      [system]: nextValue,
                    },
                  })
                }
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {isAyush && (
        <div className="rounded-2xl border border-teal-100 bg-white p-5">
          <div className="mb-1 flex items-center gap-2">
            <Activity size={20} className="text-teal-700" />
            <h3 className="font-semibold">
              Dashavidha Pariksha (AYUSH assessment)
            </h3>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Patient-reported, in their own words. Verify against clinical
            judgment — this is not a scored or diagnostic instrument.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {AYUSH_FIELD_LABELS.map(([key, label]) => (
              <IntakeField
                key={key}
                label={label}
                value={draft.ayush[key] || ""}
                onChange={(value) =>
                  onChange({
                    ...draft,
                    ayush: { ...draft.ayush, [key]: value },
                  })
                }
                disabled={disabled}
                multiline
              />
            ))}
          </div>
        </div>
      )}

      {Array.isArray(draft.sourceDocuments) &&
        draft.sourceDocuments.length > 1 && (
          <p className="text-xs text-slate-400">
            {draft.sourceDocuments.length} documents were attached at
            intake. The primary document is shown on the left; additional
            attachments are not yet individually viewable here.
          </p>
        )}
    </div>
  );
}

/* =========================================================
   PAGE
   ========================================================= */

export default function ClinicianPage() {
  const [
    cases,
    setCases,
  ] =
    useState<VerificationCase[]>(
      []
    );

  const [
    selectedCase,
    setSelectedCase,
  ] =
    useState<VerificationCase | null>(
      null
    );

  const [
    interpretation,
    setInterpretation,
  ] = useState("");

  const [
    clinicalIntakeDraft,
    setClinicalIntakeDraft,
  ] = useState<ClinicalIntakeDraft | null>(null);

  const [
    medications,
    setMedications,
  ] =
    useState<Medication[]>(
      []
    );

  const [
    correctionNote,
    setCorrectionNote,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    snapshotLoading,
    setSnapshotLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    snapshotError,
    setSnapshotError,
  ] = useState("");

  const [
    snapshot,
    setSnapshot,
  ] =
    useState<PatientSnapshot | null>(
      null
    );

  /* =========================================================
     DERIVED DATA
     ========================================================= */

  const pendingCases =
    useMemo(
      () =>
        [...cases]
          .filter(
            (item) =>
              item.status ===
              "Pending Review"
          )
          .sort((first, second) => {
            const firstFlags = getCaseRedFlags(first).length > 0 ? 1 : 0;
            const secondFlags = getCaseRedFlags(second).length > 0 ? 1 : 0;
            return secondFlags - firstFlags;
          }),
      [cases]
    );

  const verifiedCount =
    useMemo(
      () =>
        cases.filter(
          (item) =>
            item.status ===
            "Verified"
        ).length,
      [cases]
    );

  const correctionCount =
    useMemo(
      () =>
        cases.filter(
          (item) =>
            item.status ===
            "Needs Correction"
        ).length,
      [cases]
    );

  const latestVitals =
    useMemo(
      () =>
        getLatestVitals(
          snapshot?.vitals ||
            []
        ),
      [snapshot?.vitals]
    );

  const recentRecords =
    useMemo(
      () =>
        (
          snapshot?.records ||
          []
        ).slice(0, 6),
      [snapshot?.records]
    );

  const recentAudit =
    useMemo(
      () =>
        (
          selectedCase?.verificationAudits ||
          []
        ).slice(0, 8),
      [
        selectedCase?.verificationAudits,
      ]
    );

  const verifiedMedications =
    useMemo(() => {
      const medicationMap =
        new Map<string, Medication>();

      for (const record of
        snapshot?.records || []) {
        if (record.status !== "VERIFIED") {
          continue;
        }

        for (const medication of
          record.medications || []) {
          const key =
            medication.name
              .trim()
              .toLowerCase();

          if (key && !medicationMap.has(key)) {
            medicationMap.set(
              key,
              medication
            );
          }
        }
      }

      return Array.from(
        medicationMap.values()
      ).slice(0, 8);
    }, [snapshot?.records]);

  const verifiedRecordCount =
    useMemo(
      () =>
        (snapshot?.records || []).filter(
          (record) =>
            record.status === "VERIFIED"
        ).length,
      [snapshot?.records]
    );

  const pendingRecordCount =
    useMemo(
      () =>
        (snapshot?.records || []).filter(
          (record) =>
            record.status === "PENDING"
        ).length,
      [snapshot?.records]
    );

  const rejectedRecordCount =
    useMemo(
      () =>
        (snapshot?.records || []).filter(
          (record) =>
            record.status === "REJECTED"
        ).length,
      [snapshot?.records]
    );

  /* =========================================================
     INITIAL LOAD
     ========================================================= */

  useEffect(() => {
    void loadCases();
  }, []);

  /* =========================================================
     PATIENT SNAPSHOT LOAD
     ========================================================= */

  useEffect(() => {
    if (
      selectedCase?.patientId
    ) {
      void loadPatientSnapshot(
        selectedCase.patientId
      );
    } else {
      setSnapshot(null);
    }
  }, [
    selectedCase?.patientId,
  ]);

  /* =========================================================
     LOAD CASES
     ========================================================= */

  async function loadCases() {
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

      let result: any =
        null;

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

      const records: MedicalRecord[] =
        Array.isArray(
          result.records
        )
          ? result.records
          : [];

      const mappedCases =
        records.map(
          mapRecordToCase
        );

      setCases(
        mappedCases
      );

      setSelectedCase(
        (current) => {
          if (current) {
            const matchingCase =
              mappedCases.find(
                (item) =>
                  item.id ===
                  current.id
              );

            if (matchingCase) {
              return matchingCase;
            }
          }

          return (
            mappedCases.find(
              (item) =>
                item.status ===
                "Pending Review"
            ) ||
            mappedCases[0] ||
            null
          );
        }
      );
    } catch (err) {
      console.error(
        "Unable to load clinician cases:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load medical records."
      );

      setCases([]);
      setSelectedCase(null);
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     LOAD PATIENT SNAPSHOT
     ========================================================= */

  async function loadPatientSnapshot(
    patientId: string
  ) {
    setSnapshotLoading(true);
    setSnapshotError("");

    try {
      const response =
        await fetch(
          `/api/clinician/patient?patientId=${encodeURIComponent(
            patientId
          )}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

      let result: any =
        null;

      try {
        result =
          await response.json();
      } catch {
        throw new Error(
          "The server returned an invalid patient snapshot."
        );
      }

      if (
        !response.ok ||
        !result?.success
      ) {
        throw new Error(
          result?.error ||
            "Unable to load patient snapshot."
        );
      }

      setSnapshot({
        patient:
          result.patient,

        records:
          Array.isArray(
            result.records
          )
            ? result.records
            : [],

        vitals:
          Array.isArray(
            result.vitals
          )
            ? result.vitals
            : [],
      });
    } catch (err) {
      console.error(
        "Unable to load patient snapshot:",
        err
      );

      setSnapshotError(
        err instanceof Error
          ? err.message
          : "Unable to load patient snapshot."
      );

      setSnapshot(null);
    } finally {
      setSnapshotLoading(false);
    }
  }

  /* =========================================================
     SELECT CASE
     ========================================================= */

  function selectCase(
    item: VerificationCase
  ) {
    setSelectedCase(
      item
    );

    setInterpretation(
      item.interpretation ||
        ""
    );

    setClinicalIntakeDraft(
      isClinicalIntake(item.documentType)
        ? parseClinicalIntake(item.interpretation || "")
        : null
    );

    setMedications(
      item.medications || []
    );

    setCorrectionNote(
      item.correctionNote ||
        ""
    );

    setSnapshotError("");
  }

  /* =========================================================
     MEDICATION EDITING
     ========================================================= */

  function updateMedication(
    index: number,
    field: keyof Medication,
    value: string
  ) {
    setMedications(
      (current) =>
        current.map(
          (
            medication,
            medicationIndex
          ) =>
            medicationIndex ===
            index
              ? {
                  ...medication,
                  [field]:
                    value,
                }
              : medication
        )
    );
  }

  function addMedication() {
    setMedications(
      (current) => [
        ...current,
        {
          name: "",
          dosage: "",
          frequency: "",
          duration: "",
        },
      ]
    );
  }

  function removeMedication(
    index: number
  ) {
    setMedications(
      (current) =>
        current.filter(
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
     SAVE VERIFICATION
     ========================================================= */

  async function saveVerification(
    status:
      | "Verified"
      | "Needs Correction"
  ) {
    if (
      !selectedCase ||
      saving
    ) {
      return;
    }

    if (
      status ===
        "Needs Correction" &&
      correctionNote.trim()
        .length === 0
    ) {
      alert(
        "Please provide a correction note before sending the record back."
      );

      return;
    }

    setSaving(true);
    setError("");

    try {
      const databaseStatus =
        status === "Verified"
          ? "VERIFIED"
          : "REJECTED";

      const response =
        await fetch(
          "/api/medical-records",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials:
              "include",

            cache: "no-store",

            body: JSON.stringify({
              id:
                selectedCase.id,

              interpretation:
                isClinicalIntake(selectedCase.documentType) &&
                clinicalIntakeDraft
                  ? JSON.stringify({
                      ...clinicalIntakeDraft,
                      medications: medications
                        .map((medication) => medication.name.trim())
                        .filter(Boolean),
                    })
                  : interpretation,

              medications,

              status:
                databaseStatus,

              correctionNote:
                status ===
                "Needs Correction"
                  ? correctionNote.trim()
                  : "",
            }),
          }
        );

      let result: any =
        null;

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
            "Unable to update the medical record."
        );
      }

      if (
        status === "Verified"
      ) {
        alert(
          "Medical record verified successfully."
        );
      } else {
        alert(
          "The record has been sent back for correction."
        );
      }

      await loadCases();
    } catch (err) {
      console.error(
        "Unable to save clinician verification:",
        err
      );

      const message =
        err instanceof Error
          ? err.message
          : "Unable to save the verification decision.";

      setError(message);

      alert(message);
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     ORIGINAL DOCUMENT
     VIEW ONLY
     ========================================================= */

  function renderOriginalDocument() {
    if (
      !selectedCase?.originalFileUrl
    ) {
      return (
        <div className="flex h-[560px] items-center justify-center rounded-2xl border border-dashed bg-slate-50 p-8 text-center">
          <div>
            <FileText
              size={42}
              className="mx-auto mb-4 text-slate-300"
            />

            <h3 className="font-semibold text-slate-700">
              Original document unavailable
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              This record does not
              have an original document
              attached.
            </p>
          </div>
        </div>
      );
    }

    const fileUrl = `/api/medical-records/${selectedCase.id}/document`;

    const fileType =
      (
        selectedCase.originalFileType ||
        ""
      ).toLowerCase();

    const lowerUrl =
      fileUrl.toLowerCase();

    const isPdf =
      fileType.includes("pdf") ||
      lowerUrl.endsWith(".pdf");

    const isImage =
      fileType.startsWith(
        "image/"
      ) ||
      /\.(jpg|jpeg|png|webp)$/i.test(
        lowerUrl
      );

    if (isPdf) {
      return (
        <div
          className="relative overflow-hidden rounded-2xl border bg-slate-100"
          onContextMenu={(
            event
          ) =>
            event.preventDefault()
          }
        >
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
            <LockKeyhole size={14} />
            CONFIDENTIAL · VIEW ONLY
          </div>

          <iframe
            src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1`}
            title="Confidential original medical document"
            className="h-[560px] w-full border-0"
            referrerPolicy="no-referrer"
            onContextMenu={(
              event
            ) =>
              event.preventDefault()
            }
          />
        </div>
      );
    }

    if (isImage) {
      return (
        <div
          className="relative flex h-[560px] items-center justify-center overflow-auto rounded-2xl border bg-slate-100 p-4"
          onContextMenu={(
            event
          ) =>
            event.preventDefault()
          }
        >
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
            <LockKeyhole size={14} />
            CONFIDENTIAL · VIEW ONLY
          </div>

          <img
            src={fileUrl}
            alt="Confidential original medical document"
            draggable={false}
            onContextMenu={(
              event
            ) =>
              event.preventDefault()
            }
            onDragStart={(
              event
            ) =>
              event.preventDefault()
            }
            className="max-h-full max-w-full select-none rounded-lg object-contain shadow-sm"
          />
        </div>
      );
    }

    return (
      <div className="flex h-[560px] flex-col items-center justify-center rounded-2xl border bg-slate-50 p-8 text-center">
        <LockKeyhole
          size={42}
          className="mb-4 text-slate-400"
        />

        <h3 className="font-semibold text-slate-700">
          Document cannot be previewed
        </h3>

        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
          This document type is not
          available for in-browser
          viewing.
        </p>
      </div>
    );
  }

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f6f7] text-slate-900">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <RefreshCw
              size={20}
              className="animate-spin"
            />

            Loading clinician
            dashboard...
          </div>
        </div>
      </main>
    );
  }

  /* =========================================================
     MAIN RENDER
     ========================================================= */

  return (
    <main className="min-h-screen bg-[#f4f6f7] text-slate-900">
      <div className="mx-auto max-w-[1800px] px-5 py-7 lg:px-7">
        {/* =====================================================
            HEADER
            ===================================================== */}

        <header className="mb-7">
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
            <div>
              <Link
                href="/"
                className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft
                  size={16}
                />

                Back to dashboard
              </Link>

              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-teal-700 p-3 text-white shadow-sm">
                  <Stethoscope
                    size={25}
                  />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
                    Clinician Workspace
                  </p>

                  <h1 className="mt-1 text-3xl font-semibold tracking-tight lg:text-4xl">
                    Clinical verification dashboard
                  </h1>
                </div>
              </div>

              <p className="mt-3 max-w-3xl text-slate-500">
                Review the source document,
                validate the AI draft, inspect
                the patient&apos;s longitudinal
                health information, and record
                the final clinical decision.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 shadow-sm">
                <LockKeyhole
                  size={16}
                />

                Confidential workspace
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadCases()
                }
                disabled={saving}
                className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={17}
                />

                Refresh
              </button>

              <LogoutButton />
            </div>
          </div>
        </header>

        {/* =====================================================
            ERROR
            ===================================================== */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* =====================================================
            KPI CARDS
            ===================================================== */}

        <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                <Clock3
                  size={21}
                />
              </div>

              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Queue
              </span>
            </div>

            <p className="mt-5 text-3xl font-semibold">
              {
                pendingCases.length
              }
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Pending verification
            </p>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                <FileCheck2
                  size={21}
                />
              </div>

              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Complete
              </span>
            </div>

            <p className="mt-5 text-3xl font-semibold">
              {verifiedCount}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Verified records
            </p>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-rose-50 p-3 text-rose-700">
                <MessageSquareWarning
                  size={21}
                />
              </div>

              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Attention
              </span>
            </div>

            <p className="mt-5 text-3xl font-semibold">
              {correctionCount}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Sent back for correction
            </p>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
                <UsersRound
                  size={21}
                />
              </div>

              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Records
              </span>
            </div>

            <p className="mt-5 text-3xl font-semibold">
              {cases.length}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Records in workspace
            </p>
          </div>
        </section>

        {/* =====================================================
            WORKSPACE
            ===================================================== */}

        <div className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          {/* ===================================================
              VERIFICATION QUEUE
              =================================================== */}

          <aside className="rounded-3xl border bg-white p-5 shadow-sm xl:sticky xl:top-5 xl:self-start">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">
                  Verification queue
                </h2>

                <p className="text-sm text-slate-500">
                  Documents awaiting clinical
                  review
                </p>
              </div>

              <div className="rounded-xl bg-slate-100 p-2 text-slate-500">
                <History
                  size={19}
                />
              </div>
            </div>

            {pendingCases.length ===
            0 ? (
              <div className="rounded-2xl border border-dashed p-7 text-center">
                <CheckCircle2
                  className="mx-auto mb-3 text-emerald-500"
                  size={30}
                />

                <p className="font-medium">
                  No pending reviews
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  New submitted documents
                  will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCases.map(
                  (item) => {
                    const flagCount = getCaseRedFlags(item).length;

                    return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        selectCase(
                          item
                        )
                      }
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selectedCase?.id ===
                        item.id
                          ? "border-teal-500 bg-teal-50"
                          : flagCount > 0
                          ? "border-rose-200 bg-rose-50/40 hover:border-rose-300"
                          : "hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {
                              item.patientName
                            }
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {
                              item.documentType
                            }
                          </p>
                        </div>

                        {flagCount > 0 ? (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                            <MessageSquareWarning size={12} />
                            Urgent
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            Pending
                          </span>
                        )}
                      </div>

                      <p className="mt-3 truncate text-xs text-slate-400">
                        {
                          item.documentName
                        }
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Submitted{" "}
                        {formatDate(
                          item.submittedAt
                        )}
                      </p>
                    </button>
                    );
                  }
                )}
              </div>
            )}

            {cases.filter(
              (item) =>
                item.status !==
                "Pending Review"
            ).length > 0 && (
              <div className="mt-7 border-t pt-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Recent decisions
                </p>

                <div className="space-y-2">
                  {cases
                    .filter(
                      (item) =>
                        item.status !==
                        "Pending Review"
                    )
                    .slice(0, 5)
                    .map(
                      (item) => (
                        <button
                          key={
                            item.id
                          }
                          type="button"
                          onClick={() =>
                            selectCase(
                              item
                            )
                          }
                          className="w-full rounded-xl border px-3 py-3 text-left hover:bg-slate-50"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-medium">
                              {
                                item.patientName
                              }
                            </span>

                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                                item.status ===
                                "Verified"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              {
                                item.status
                              }
                            </span>
                          </div>

                          <p className="mt-1 truncate text-xs text-slate-400">
                            {
                              item.documentType
                            }
                          </p>
                        </button>
                      )
                    )}
                </div>
              </div>
            )}
          </aside>

          {/* ===================================================
              MAIN CONTENT
              =================================================== */}

          <section className="space-y-6">
            {!selectedCase ? (
              <div className="rounded-3xl border bg-white p-10 shadow-sm">
                <div className="flex min-h-[550px] flex-col items-center justify-center text-center">
                  <ShieldCheck
                    size={54}
                    className="mb-4 text-slate-300"
                  />

                  <h2 className="text-xl font-semibold">
                    No record selected
                  </h2>

                  <p className="mt-2 max-w-md text-slate-500">
                    Submitted documents will
                    appear in the verification
                    queue.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* =================================================
                    PATIENT CLINICAL SNAPSHOT
                    ================================================= */}

                <section className="rounded-3xl border bg-white p-6 shadow-sm">
                  <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                    <div className="flex items-start gap-4">
                      <div className="rounded-2xl bg-teal-50 p-4 text-teal-700">
                        <UserRound
                          size={27}
                        />
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                          Patient clinical snapshot
                        </p>

                        <h2 className="mt-1 text-2xl font-semibold">
                          {
                            snapshot?.patient
                              ?.name ||
                            selectedCase.patientName
                          }
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          {
                            snapshot?.patient
                              ?.email ||
                            "Patient details unavailable"
                          }
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                          Patient ID:{" "}
                          {selectedCase.patientId ||
                            "Not linked"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Current record
                      </p>

                      <p className="mt-1 font-medium text-slate-700">
                        {
                          selectedCase.documentType
                        }
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Submitted{" "}
                        {formatDate(
                          selectedCase.submittedAt
                        )}
                      </p>
                    </div>
                  </div>

                  {snapshotLoading ? (
                    <div className="mt-6 flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      <RefreshCw
                        size={16}
                        className="animate-spin"
                      />

                      Loading patient
                      longitudinal data...
                    </div>
                  ) : snapshotError ? (
                    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                      {snapshotError}
                    </div>
                  ) : (
                    <>
                      {/* =================================================
                          SNAPSHOT CARDS
                          ================================================= */}

                      <div className="mt-6 grid gap-4 lg:grid-cols-2">
                        {/* LATEST VITALS */}

                        <div className="rounded-2xl border p-5">
                          <div className="mb-4 flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold">
                                Latest vitals
                              </h3>

                              <p className="mt-1 text-sm text-slate-500">
                                Recent measurements
                                from JeevanLink
                              </p>
                            </div>

                            <Activity
                              size={20}
                              className="text-teal-700"
                            />
                          </div>

                          {latestVitals.length ===
                          0 ? (
                            <div className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">
                              No valid vital
                              measurements are
                              available for this
                              patient.
                            </div>
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                              {latestVitals.map(
                                (
                                  vital
                                ) => (
                                  <div
                                    key={
                                      vital.id
                                    }
                                    className="rounded-xl bg-slate-50 p-3"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        {getVitalLabel(
                                          vital.vitalType
                                        )}
                                      </p>

                                      <HeartPulse
                                        size={
                                          15
                                        }
                                        className="text-slate-400"
                                      />
                                    </div>

                                    <p className="mt-2 text-xl font-semibold">
                                      {formatVitalValue(
                                        vital
                                      )}{" "}
                                      <span className="text-xs font-medium text-slate-500">
                                        {formatVitalUnit(
                                          vital
                                        )}
                                      </span>
                                    </p>

                                    <p className="mt-1 text-xs text-slate-400">
                                      {formatDate(
                                        vital.recordedAt
                                      )}
                                    </p>

                                    <p className="mt-1 text-[11px] text-slate-400">
                                      Source:{" "}
                                      {
                                        vital.source
                                      }
                                    </p>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>

                        {/* RECENT MEDICAL HISTORY */}

                        <div className="rounded-2xl border p-5">
                          <div className="mb-4 flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold">
                                Recent medical history
                              </h3>

                              <p className="mt-1 text-sm text-slate-500">
                                Latest documents
                                across the patient&apos;s
                                timeline
                              </p>
                            </div>

                            <FileText
                              size={20}
                              className="text-slate-400"
                            />
                          </div>

                          {recentRecords.length ===
                          0 ? (
                            <div className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">
                              No additional medical
                              records found.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {recentRecords.map(
                                (
                                  record
                                ) => (
                                  <div
                                    key={
                                      record.id
                                    }
                                    className="rounded-xl bg-slate-50 p-3"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="truncate text-sm font-semibold">
                                        {
                                          record.documentName
                                        }
                                      </p>

                                      <span
                                        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                                          record.status ===
                                          "VERIFIED"
                                            ? "bg-emerald-50 text-emerald-700"
                                            : record.status ===
                                              "REJECTED"
                                            ? "bg-rose-50 text-rose-700"
                                            : "bg-amber-50 text-amber-700"
                                        }`}
                                      >
                                        {
                                          record.status
                                        }
                                      </span>
                                    </div>

                                    <p className="mt-1 text-xs text-slate-500">
                                      {
                                        record.documentType
                                      }{" "}
                                      ·{" "}
                                      {formatDate(
                                        record.createdAt
                                      )}
                                    </p>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* =================================================
                          VITAL TRENDS
                          ================================================= */}

                      <div className="mt-6 rounded-2xl border p-5">
                        <div className="mb-5">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                            Longitudinal monitoring
                          </p>

                          <h3 className="mt-1 text-lg font-semibold text-slate-800">
                            Vital trends
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            Historical vital
                            measurements available
                            in JeevanLink.
                          </p>
                        </div>

                        <VitalTrendPanel
                          vitals={
                            snapshot?.vitals ||
                            []
                          }
                        />
                      </div>

                      {/* =================================================
                          MEDICATION + CLINICAL TIMELINE
                          ================================================= */}

                      <div className="mt-6">
                        <ClinicalHistoryPanel
                          records={
                            snapshot?.records ||
                            []
                          }
                        />
                      </div>

                      {/* =================================================
                          VERIFIED MEDICATIONS + ACTIVITY
                          ================================================= */}

                      <div className="mt-6 grid gap-6 lg:grid-cols-2">
                        <div className="rounded-2xl border p-5">
                          <div className="mb-5 flex items-center gap-3">
                            <div className="rounded-xl bg-violet-50 p-2.5 text-violet-700">
                              <Pill size={19} />
                            </div>

                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                                Medication continuity
                              </p>

                              <h3 className="mt-1 text-lg font-semibold text-slate-800">
                                Verified medications
                              </h3>
                            </div>
                          </div>

                          {verifiedMedications.length === 0 ? (
                            <div className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">
                              No medications from a verified record are available.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {verifiedMedications.map(
                                (medication, index) => (
                                  <div
                                    key={`${medication.name}-${index}`}
                                    className="rounded-xl bg-slate-50 p-4"
                                  >
                                    <p className="font-semibold text-slate-800">
                                      {medication.name}
                                    </p>

                                    {medication.dosage && (
                                      <p className="mt-1 text-sm text-slate-600">
                                        Dosage: {medication.dosage}
                                      </p>
                                    )}

                                    {medication.frequency && (
                                      <p className="mt-1 text-sm text-slate-600">
                                        Frequency: {medication.frequency}
                                      </p>
                                    )}

                                    {medication.duration && (
                                      <p className="mt-1 text-sm text-slate-600">
                                        Duration: {medication.duration}
                                      </p>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          )}

                          <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/50 p-3 text-xs leading-5 text-violet-900">
                            Only medications attached to VERIFIED medical records are shown in this clinical summary.
                          </div>
                        </div>

                        <div className="rounded-2xl border p-5">
                          <div className="mb-5 flex items-center gap-3">
                            <div className="rounded-xl bg-sky-50 p-2.5 text-sky-700">
                              <UsersRound size={19} />
                            </div>

                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                                Record activity
                              </p>

                              <h3 className="mt-1 text-lg font-semibold text-slate-800">
                                Clinical activity
                              </h3>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                            <div className="rounded-xl bg-emerald-50/70 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                Verified
                              </p>

                              <p className="mt-2 text-2xl font-semibold text-emerald-900">
                                {verifiedRecordCount}
                              </p>

                              <p className="mt-1 text-xs text-emerald-700">
                                Verified records
                              </p>
                            </div>

                            <div className="rounded-xl bg-amber-50/70 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                                Pending
                              </p>

                              <p className="mt-2 text-2xl font-semibold text-amber-900">
                                {pendingRecordCount}
                              </p>

                              <p className="mt-1 text-xs text-amber-700">
                                Awaiting review
                              </p>
                            </div>

                            <div className="rounded-xl bg-rose-50/70 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                                Correction
                              </p>

                              <p className="mt-2 text-2xl font-semibold text-rose-900">
                                {rejectedRecordCount}
                              </p>

                              <p className="mt-1 text-xs text-rose-700">
                                Sent back for correction
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl border bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                            These counts reflect the patient&apos;s records available to the clinician workspace.
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </section>

                {/* =================================================
                    CURRENT VERIFICATION
                    ================================================= */}

                <section className="rounded-3xl border bg-white p-6 shadow-sm">
                  <div className="mb-6 flex flex-col justify-between gap-5 border-b pb-6 lg:flex-row lg:items-center">
                    <div className="flex items-center gap-4">
                      <div className="rounded-2xl bg-slate-100 p-4">
                        <FileCheck2
                          size={27}
                        />
                      </div>

                      <div>
                        <p className="text-sm text-slate-500">
                          Active verification case
                        </p>

                        <h2 className="text-2xl font-semibold">
                          {
                            selectedCase.patientName
                          }
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          {
                            selectedCase.documentType
                          }
                          {" · "}
                          {
                            selectedCase.documentName
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border bg-slate-50 px-4 py-3">
                      <Clock3
                        size={17}
                        className="text-slate-500"
                      />

                      <span className="text-sm text-slate-600">
                        {formatDate(
                          selectedCase.submittedAt
                        )}
                      </span>
                    </div>
                  </div>

                  {/* CONFIDENTIALITY */}

                  <div className="mb-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <LockKeyhole
                      size={20}
                      className="mt-0.5 shrink-0 text-slate-600"
                    />

                    <div>
                      <p className="font-semibold text-slate-800">
                        Confidential source document
                      </p>

                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        The original report is
                        available for clinical
                        verification in view-only
                        mode. Download, editing,
                        and open-in-new-window
                        controls remain unavailable
                        in the application UI.
                      </p>
                    </div>
                  </div>

                  {selectedCase.labReport && (
                    <section className="mb-6 rounded-2xl border border-sky-200 bg-sky-50/60 p-5">
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="rounded-xl bg-white p-3 text-sky-700 shadow-sm">
                            <FileCheck2 size={21} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
                                Laboratory-originated record
                              </p>
                              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-700 shadow-sm">
                                Digital report
                              </span>
                              {selectedCase.labReport.digitallyReceived !== false && (
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                  Digitally received
                                </span>
                              )}
                            </div>

                            <h3 className="mt-1 text-lg font-semibold text-sky-950">
                              {selectedCase.labReport.testName}
                            </h3>

                            <p className="mt-1 text-sm text-sky-800">
                              {selectedCase.labReport.lab?.name || "Laboratory"}
                              {selectedCase.labReport.reportNumber ? ` · ${selectedCase.labReport.reportNumber}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-2 text-sm sm:grid-cols-3 xl:min-w-[520px]">
                          <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Report date
                            </p>
                            <p className="mt-1 font-semibold text-slate-800">
                              {formatDate(selectedCase.labReport.reportDate)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Report status
                            </p>
                            <p className="mt-1 font-semibold text-slate-800">
                              {selectedCase.labReport.status}
                            </p>
                          </div>
                          <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Linked record
                            </p>
                            <p className="mt-1 font-semibold text-amber-700">
                              Pending clinician verification
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-xl border border-sky-100 bg-white/80 p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Result summary
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {selectedCase.labReport.resultSummary ||
                              "No structured result summary was supplied by the laboratory."}
                          </p>
                        </div>

                        <div className="rounded-xl border border-sky-100 bg-white/80 p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Source chain
                          </p>
                          <div className="mt-2 space-y-2 text-sm text-slate-700">
                            <p>
                              <span className="font-semibold">Lab:</span> {selectedCase.labReport.lab?.name || "Not specified"}
                            </p>
                            <p>
                              <span className="font-semibold">Order:</span> {selectedCase.labReport.labOrder?.orderNumber || selectedCase.labReport.labOrder?.id || "Not linked"}
                            </p>
                            <p>
                              <span className="font-semibold">Received:</span> {selectedCase.labReport.digitallyReceived !== false ? "Yes" : "No"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-sky-100 bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-slate-600">
                          <span className="font-semibold text-slate-800">Clinical gate:</span> this laboratory submission is being reviewed through the same clinician-verification workflow as other medical records.
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                          <Clock3 size={14} />
                          Verify before longitudinal use
                        </span>
                      </div>
                    </section>
                  )}

                  {/* SIDE-BY-SIDE REVIEW */}

                  <div className="grid gap-6 2xl:grid-cols-2">
                    {/* ORIGINAL DOCUMENT */}

                    <div>
                      <div className="mb-3">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                          Primary source
                        </p>

                        <h2 className="mt-1 text-xl font-semibold">
                          Original medical document
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          View only · no download
                          or editing controls
                        </p>
                      </div>

                      {renderOriginalDocument()}
                    </div>

                    {/* AI DRAFT */}

                    <div>
                      <div className="mb-3">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
                          AI output
                        </p>

                        <h2 className="mt-1 text-xl font-semibold">
                          AI-extracted clinical draft
                        </h2>
                      </div>

                      <div className="mb-6 rounded-2xl border border-teal-100 bg-teal-50/60 p-5">
                        <div className="flex gap-3">
                          <ShieldCheck
                            className="mt-0.5 shrink-0 text-teal-700"
                            size={21}
                          />

                          <div>
                            <h3 className="font-semibold text-teal-900">
                              Human verification required
                            </h3>

                            <p className="mt-1 text-sm leading-6 text-teal-800">
                              Compare the AI draft
                              directly against the
                              original document before
                              approving.
                            </p>
                          </div>
                        </div>
                      </div>

                      {isClinicalIntake(selectedCase.documentType) &&
                      clinicalIntakeDraft &&
                      clinicalIntakeDraft.redFlags.length > 0 && (
                        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-5">
                          <div className="flex gap-3">
                            <MessageSquareWarning
                              className="mt-0.5 shrink-0 text-rose-700"
                              size={21}
                            />

                            <div>
                              <h3 className="font-semibold text-rose-900">
                                Patient-reported red flags at intake
                              </h3>

                              <ul className="mt-2 space-y-1 text-sm leading-6 text-rose-800">
                                {clinicalIntakeDraft.redFlags.map((flag) => (
                                  <li key={flag}>• {flag}</li>
                                ))}
                              </ul>

                              <p className="mt-2 text-xs text-rose-700">
                                Detected automatically from the patient&apos;s
                                own words at submission time. This is a
                                triage aid, not a diagnosis — confirm with
                                the patient and escalate if clinically
                                warranted.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {isClinicalIntake(selectedCase.documentType) &&
                      clinicalIntakeDraft ? (
                        <ClinicalIntakeReview
                          draft={clinicalIntakeDraft}
                          onChange={setClinicalIntakeDraft}
                          disabled={saving}
                        />
                      ) : (
                        <div>
                          {/* INTERPRETATION */}

                          <div className="mb-3 flex items-center gap-2">
                            <FileText
                              size={20}
                            />

                            <h3 className="font-semibold">
                              Document interpretation
                            </h3>
                          </div>

                          <textarea
                            value={
                              interpretation
                            }
                            onChange={(
                              event
                            ) =>
                              setInterpretation(
                                event.target
                                  .value
                              )
                            }
                            disabled={
                              saving
                            }
                            rows={8}
                            className="w-full rounded-2xl border bg-slate-50 p-4 leading-6 outline-none transition focus:border-teal-500 disabled:opacity-60"
                          />
                        </div>
                      )}

                      {/* MEDICATIONS */}

                      <div className="mt-8">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">
                              Medication entries
                            </h3>

                            <p className="mt-1 text-sm text-slate-500">
                              Review and correct
                              extracted medications.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={
                              addMedication
                            }
                            disabled={
                              saving
                            }
                            className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Pill
                              size={16}
                            />

                            Add medication
                          </button>
                        </div>

                        {medications.length ===
                        0 ? (
                          <div className="rounded-2xl border border-dashed p-6 text-center text-slate-500">
                            No medications
                            identified in this
                            document.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {medications.map(
                              (
                                medication,
                                index
                              ) => (
                                <div
                                  key={`${selectedCase.id}-${index}`}
                                  className="rounded-2xl border bg-slate-50 p-4"
                                >
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <input
                                      value={
                                        medication.name
                                      }
                                      disabled={
                                        saving
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
                                      placeholder="Medication"
                                      className="rounded-xl border bg-white px-3 py-2.5 outline-none focus:border-teal-500 disabled:opacity-60"
                                    />

                                    <input
                                      value={
                                        medication.dosage ||
                                        ""
                                      }
                                      disabled={
                                        saving
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
                                      placeholder="Dosage"
                                      className="rounded-xl border bg-white px-3 py-2.5 outline-none focus:border-teal-500 disabled:opacity-60"
                                    />

                                    <input
                                      value={
                                        medication.frequency ||
                                        ""
                                      }
                                      disabled={
                                        saving
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
                                      placeholder="Frequency"
                                      className="rounded-xl border bg-white px-3 py-2.5 outline-none focus:border-teal-500 disabled:opacity-60"
                                    />

                                    <input
                                      value={
                                        medication.duration ||
                                        ""
                                      }
                                      disabled={
                                        saving
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
                                      placeholder="Duration"
                                      className="rounded-xl border bg-white px-3 py-2.5 outline-none focus:border-teal-500 disabled:opacity-60"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeMedication(
                                        index
                                      )
                                    }
                                    disabled={
                                      saving
                                    }
                                    className="mt-3 text-sm font-medium text-red-600 disabled:opacity-50"
                                  >
                                    Remove medication
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CORRECTION NOTE */}

                  <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <MessageSquareWarning
                        size={20}
                        className="text-amber-700"
                      />

                      <div>
                        <h3 className="font-semibold text-amber-900">
                          Correction note
                        </h3>

                        <p className="text-sm text-amber-800">
                          Required when sending
                          the record back.
                        </p>
                      </div>
                    </div>

                    <textarea
                      value={
                        correctionNote
                      }
                      onChange={(
                        event
                      ) =>
                        setCorrectionNote(
                          event.target
                            .value
                        )
                      }
                      disabled={
                        saving
                      }
                      rows={3}
                      placeholder="Describe what needs to be corrected..."
                      className="w-full rounded-xl border bg-white p-3 text-sm outline-none focus:border-amber-400 disabled:opacity-60"
                    />
                  </div>

                  {/* ACTIONS */}

                  <div className="mt-8 flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        void saveVerification(
                          "Needs Correction"
                        )
                      }
                      disabled={
                        saving
                      }
                      className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 px-5 py-3 font-medium text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircle
                        size={19}
                      />

                      {saving
                        ? "Saving..."
                        : "Send Back for Correction"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void saveVerification(
                          "Verified"
                        )
                      }
                      disabled={
                        saving
                      }
                      className="flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2
                        size={19}
                      />

                      {saving
                        ? "Saving..."
                        : "Approve & Verify"}
                    </button>
                  </div>
                </section>

                {/* =================================================
                    AUDIT TRAIL
                    ================================================= */}

                <section className="rounded-3xl border bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-2xl bg-violet-50 p-3 text-violet-700">
                      <History
                        size={22}
                      />
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        Verification history
                      </p>

                      <h2 className="mt-1 text-xl font-semibold">
                        Audit trail
                      </h2>
                    </div>
                  </div>

                  {recentAudit.length ===
                  0 ? (
                    <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
                      No verification events are
                      available for this record.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentAudit.map(
                        (
                          audit
                        ) => (
                          <div
                            key={
                              audit.id
                            }
                            className="flex items-start gap-3 rounded-2xl border bg-slate-50 p-4"
                          >
                            <div className="mt-0.5 rounded-xl bg-white p-2 text-slate-500 shadow-sm">
                              <History
                                size={16}
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                                  {
                                    audit.action
                                  }
                                </span>

                                <span className="text-xs text-slate-400">
                                  {formatDate(
                                    audit.createdAt
                                  )}
                                </span>
                              </div>

                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                {audit.note ||
                                  "Verification event recorded."}
                              </p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </section>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}