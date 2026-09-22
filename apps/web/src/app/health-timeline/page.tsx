"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSearch,
  FileText,
  Filter,
  FlaskConical,
  History,
  Loader2,
  Pill,
  RefreshCw,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";

import LogoutButton from "@/components/LogoutButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import Sidebar from "@/components/Sidebar";
import MobileSidebarToggle from "@/components/MobileSidebarToggle";
import type { TranslationKey } from "@/app/lib/i18n";
import ClinicalIntakeSummary, {
  clinicalIntakePreviewText,
} from "@/components/ClinicalIntakeSummary";

type Medication = {
  name?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
};

type LabResultEntry = {
  testName?: string | null;
  value?: string | null;
  unit?: string | null;
  referenceRange?: string | null;
  status?: string | null;
};

type VerificationAudit = {
  id?: string;
  action?: string;
  note?: string | null;
  createdAt?: string;
};

type MedicalRecord = {
  id: string;
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
  labResults?: LabResultEntry[];
};

type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "PATIENT" | "CLINICIAN";
};

type TimelineFilter =
  | "all"
  | "prescriptions"
  | "labs"
  | "verified"
  | "pending"
  | "attention";

function getRecordStatus(record: MedicalRecord) {
  const value = String(
    record.status || record.clinicianDecision || "PENDING"
  )
    .trim()
    .toLowerCase();

  if (value === "verified" || value === "approved") {
    return "verified" as const;
  }

  if (
    value === "rejected" ||
    value === "needs correction" ||
    value === "needs_correction"
  ) {
    return "attention" as const;
  }

  return "pending" as const;
}

function getDocumentKind(record: MedicalRecord) {
  const value = `${record.documentType || ""} ${record.documentName || ""}`.toLowerCase();

  if (
    value.includes("lab") ||
    value.includes("pathology") ||
    value.includes("blood test") ||
    value.includes("report")
  ) {
    return "labs" as const;
  }

  return "prescriptions" as const;
}

function getDateValue(record: MedicalRecord) {
  return (
    record.submittedAt ||
    record.createdAt ||
    record.reviewedAt ||
    record.verifiedAt ||
    ""
  );
}

function formatDate(value: string | null | undefined, t: (key: TranslationKey | string) => string) {
  if (!value) return t("timeline.dateUnavailable");

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDay(value: string | null | undefined, t: (key: TranslationKey | string) => string) {
  if (!value) return t("timeline.dateUnavailable");

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/*
 * Small curated set of well-known, clinically significant interaction
 * pairs, matched by case-insensitive substring against medication name
 * strings across ALL of a patient's records (not just one document).
 * This is deliberately a short, deterministic, hardcoded list rather
 * than a model-based check: it needs no API call so it's always
 * available and testable, at the cost of only covering the pairs
 * listed here. It will miss interactions involving brand names not
 * listed, combination products, or anything not on this list -- it is
 * not a substitute for pharmacist or clinician review.
 */
const DRUG_INTERACTIONS: { a: string[]; b: string[]; note: string }[] = [
  {
    a: ["warfarin"],
    b: ["aspirin", "ibuprofen", "naproxen", "diclofenac"],
    note: "Combining an anticoagulant with aspirin/an NSAID can significantly increase bleeding risk.",
  },
  {
    a: ["warfarin"],
    b: ["clopidogrel"],
    note: "Combining warfarin with clopidogrel increases bleeding risk.",
  },
  {
    a: ["aspirin"],
    b: ["clopidogrel"],
    note: "Dual antiplatelet use needs clinician-guided monitoring for bleeding risk.",
  },
  {
    a: ["sildenafil", "tadalafil", "vardenafil"],
    b: ["nitroglycerin", "isosorbide", "nitrate"],
    note: "Combining a PDE5 inhibitor with nitrates can cause a severe, dangerous drop in blood pressure.",
  },
  {
    a: ["simvastatin", "atorvastatin", "lovastatin"],
    b: ["clarithromycin", "erythromycin", "itraconazole", "ketoconazole"],
    note: "This combination can raise statin levels and increase the risk of muscle damage (rhabdomyolysis).",
  },
  {
    a: ["lisinopril", "enalapril", "ramipril", "losartan", "valsartan", "telmisartan"],
    b: ["spironolactone", "potassium"],
    note: "Combining an ACE inhibitor/ARB with a potassium-sparing agent can raise potassium to dangerous levels.",
  },
  {
    a: ["lithium"],
    b: ["ibuprofen", "naproxen", "diclofenac", "lisinopril", "enalapril", "ramipril"],
    note: "NSAIDs and ACE inhibitors can raise lithium levels into the toxic range.",
  },
  {
    a: ["digoxin"],
    b: ["amiodarone"],
    note: "Amiodarone can raise digoxin levels, increasing the risk of digoxin toxicity.",
  },
  {
    a: ["methotrexate"],
    b: ["ibuprofen", "naproxen", "diclofenac", "aspirin"],
    note: "NSAIDs can reduce methotrexate clearance and increase its toxicity.",
  },
  {
    a: ["glimepiride", "glipizide", "glyburide", "glibenclamide"],
    b: ["fluconazole"],
    note: "Fluconazole can increase sulfonylurea levels, raising the risk of low blood sugar.",
  },
  {
    a: ["theophylline"],
    b: ["ciprofloxacin"],
    note: "Ciprofloxacin can raise theophylline levels, increasing the risk of toxicity.",
  },
  {
    a: ["alprazolam", "diazepam", "clonazepam", "lorazepam"],
    b: ["tramadol", "morphine", "codeine", "oxycodone"],
    note: "Combining a benzodiazepine with an opioid increases the risk of severe sedation and slowed breathing.",
  },
  {
    a: ["sertraline", "fluoxetine", "escitalopram", "paroxetine"],
    b: ["tramadol"],
    note: "Combining an SSRI with tramadol increases the risk of serotonin syndrome.",
  },
];

type InteractionFlag = {
  medicationA: string;
  medicationB: string;
  note: string;
};

function findDrugInteractions(medicationNames: string[]): InteractionFlag[] {
  const names = Array.from(
    new Set(medicationNames.map((name) => name.trim()).filter(Boolean))
  );

  const results: InteractionFlag[] = [];

  for (const rule of DRUG_INTERACTIONS) {
    const matchesA = names.filter((name) =>
      rule.a.some((term) => name.toLowerCase().includes(term))
    );
    const matchesB = names.filter((name) =>
      rule.b.some((term) => name.toLowerCase().includes(term))
    );

    for (const medicationA of matchesA) {
      for (const medicationB of matchesB) {
        if (medicationA.toLowerCase() === medicationB.toLowerCase()) continue;
        results.push({ medicationA, medicationB, note: rule.note });
      }
    }
  }

  const seen = new Set<string>();

  return results.filter((flag) => {
    const key = [flag.medicationA.toLowerCase(), flag.medicationB.toLowerCase()]
      .sort()
      .join("::");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isAbnormalStatus(status?: string | null) {
  return /high|low|abnormal/i.test(String(status || ""));
}

function auditLabel(action: string | undefined, t: (key: TranslationKey | string) => string) {
  if (!action) return t("timeline.recordUpdateDefault");

  return String(action)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function StatusBadge({ record }: { record: MedicalRecord }) {
  const { t } = useLanguage();
  const status = getRecordStatus(record);

  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 size={14} />
        {t("timeline.status.verified")}
      </span>
    );
  }

  if (status === "attention") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
        <XCircle size={14} />
        {t("timeline.status.attention")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
      <Clock size={14} />
      {t("timeline.status.pending")}
    </span>
  );
}

function KindBadge({ record }: { record: MedicalRecord }) {
  const { t } = useLanguage();
  const kind = getDocumentKind(record);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
      {kind === "labs" ? <FileSearch size={13} /> : <Pill size={13} />}
      {kind === "labs" ? t("timeline.kind.lab") : t("timeline.kind.prescription")}
    </span>
  );
}

export default function HealthTimelinePage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [loading, setLoading] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [error, setError] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const checkAccess = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.authenticated || !result?.user) {
        router.replace("/login");
        return;
      }

      if (result.user.role !== "PATIENT") {
        router.replace("/clinician");
        return;
      }

      setUser(result.user as SessionUser);
    } catch (err) {
      console.error("Timeline access check failed:", err);
      router.replace("/login");
    } finally {
      setCheckingAccess(false);
    }
  }, [router]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/medical-records", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || t("timeline.errors.loadFailed")
        );
      }

      const incoming = Array.isArray(result.records) ? result.records : [];

      const normalized = incoming.map((record: any) => ({
        id: String(record.id),
        documentName: record.documentName || t("timeline.defaultDocumentName"),
        documentType: record.documentType || t("timeline.defaultDocumentType"),
        interpretation: record.interpretation ?? record.summary ?? "",
        summary: record.summary ?? record.interpretation ?? "",
        medications: Array.isArray(record.medications)
          ? record.medications
          : [],
        status: record.status,
        clinicianDecision: record.clinicianDecision,
        submittedAt: record.submittedAt || record.createdAt,
        createdAt: record.createdAt,
        reviewedAt: record.reviewedAt,
        verifiedAt: record.verifiedAt,
        rejectionReason: record.rejectionReason,
        originalFileUrl: record.originalFileUrl,
        originalFileType: record.originalFileType,
        verificationAudits: Array.isArray(record.verificationAudits)
          ? record.verificationAudits
          : [],
        labResults: Array.isArray(record.labResults)
          ? record.labResults
          : [],
      })) as MedicalRecord[];

      normalized.sort(
        (a, b) =>
          new Date(getDateValue(b)).getTime() -
          new Date(getDateValue(a)).getTime()
      );

      setRecords(normalized);
      setSelectedRecordId((current) => {
        if (current && normalized.some((record) => record.id === current)) {
          return current;
        }
        return normalized[0]?.id || null;
      });
    } catch (err) {
      console.error("Health timeline loading failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : t("timeline.errors.loadFailed")
      );
      setRecords([]);
      setSelectedRecordId(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess]);

  useEffect(() => {
    if (!checkingAccess && user?.role === "PATIENT") {
      void loadRecords();
    }
  }, [checkingAccess, user, loadRecords]);

  const filteredRecords = useMemo(() => {
    if (filter === "all") return records;

    return records.filter((record) => {
      if (filter === "verified") return getRecordStatus(record) === "verified";
      if (filter === "pending") return getRecordStatus(record) === "pending";
      if (filter === "attention") return getRecordStatus(record) === "attention";
      return getDocumentKind(record) === filter;
    });
  }, [filter, records]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId) || null,
    [records, selectedRecordId]
  );

  /*
   * Cross-document safety signals: unlike everything else on this page
   * (which looks at one record at a time), these two look ACROSS every
   * record the patient has, which is what the PS actually asks for --
   * abnormal-value and drug-interaction highlighting across documents,
   * not just per-document.
   */
  const abnormalFindings = useMemo(() => {
    const findings: Array<{
      recordId: string;
      documentName: string;
      date: string;
      testName: string;
      value: string;
      unit: string;
      referenceRange: string;
      status: string;
    }> = [];

    for (const record of records) {
      for (const result of record.labResults || []) {
        if (!isAbnormalStatus(result.status)) continue;

        findings.push({
          recordId: record.id,
          documentName: record.documentName || t("timeline.defaultDocumentName"),
          date: getDateValue(record),
          testName: result.testName || t("timeline.unnamedTest"),
          value: result.value || "—",
          unit: result.unit || "",
          referenceRange: result.referenceRange || "",
          status: result.status || "",
        });
      }
    }

    return findings.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [records, t]);

  const interactionFlags = useMemo(() => {
    const activeMedicationNames = records
      .filter((record) => getRecordStatus(record) !== "attention")
      .flatMap((record) => record.medications || [])
      .map((medication) => medication.name || "")
      .filter(Boolean) as string[];

    return findDrugInteractions(activeMedicationNames);
  }, [records]);

  const groupedTimeline = useMemo(() => {
    const groups = new Map<string, MedicalRecord[]>();

    const dateUnavailableKey = t("timeline.dateUnavailable");

    for (const record of filteredRecords) {
      const date = new Date(getDateValue(record));
      const key = Number.isNaN(date.getTime())
        ? dateUnavailableKey
        : date.toISOString().slice(0, 10);

      const existing = groups.get(key) || [];
      existing.push(record);
      groups.set(key, existing);
    }

    return Array.from(groups.entries()).map(([key, group]) => ({
      key,
      label:
        key === dateUnavailableKey
          ? key
          : formatDay(group[0] ? getDateValue(group[0]) : null, t),
      records: group,
    }));
  }, [filteredRecords, t]);

  const counts = useMemo(
    () => ({
      all: records.length,
      prescriptions: records.filter(
        (record) => getDocumentKind(record) === "prescriptions"
      ).length,
      labs: records.filter((record) => getDocumentKind(record) === "labs").length,
      verified: records.filter((record) => getRecordStatus(record) === "verified")
        .length,
      pending: records.filter((record) => getRecordStatus(record) === "pending")
        .length,
      attention: records.filter((record) => getRecordStatus(record) === "attention")
        .length,
    }),
    [records]
  );

  if (checkingAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7f7] text-slate-700">
        <div className="flex items-center gap-3">
          <Loader2 size={20} className="animate-spin" />
          {t("timeline.checkingAccess")}
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="main-content min-h-screen bg-[#f5f7f7] text-slate-900">
      <div className="mx-auto max-w-[1500px] px-5 py-7 md:px-8 md:py-9">
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <MobileSidebarToggle />
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft size={16} />
                {t("timeline.backDashboard")}
              </Link>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
              <History size={15} />
              {t("timeline.eyebrow")}
            </div>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              {t("timeline.title")}
            </h1>

            <p className="mt-2 max-w-3xl text-slate-500">
              {t("timeline.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {user && (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-slate-500">{t("timeline.patientLabel")}</p>
              </div>
            )}

            <LanguageSwitcher />

            <button
              type="button"
              onClick={() => void loadRecords()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
              {t("timeline.refresh")}
            </button>

            <LogoutButton />
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {(abnormalFindings.length > 0 || interactionFlags.length > 0) && (
          <section className="mb-7 rounded-3xl border border-amber-200 bg-amber-50/60 p-5 md:p-7">
            <div className="mb-5 flex items-start gap-3">
              <div className="rounded-xl bg-white p-2.5 text-amber-700 shadow-sm">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-amber-900">
                  {t("timeline.safety.title")}
                </h2>
                <p className="mt-1 text-sm leading-6 text-amber-800">
                  {t("timeline.safety.subtitle")}
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {abnormalFindings.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <FlaskConical size={16} className="text-amber-700" />
                    <h3 className="text-sm font-semibold text-slate-800">
                      {t("timeline.safety.abnormalTitle")} ({abnormalFindings.length})
                    </h3>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {abnormalFindings.map((finding, index) => (
                      <button
                        key={`${finding.recordId}-${finding.testName}-${index}`}
                        type="button"
                        onClick={() => setSelectedRecordId(finding.recordId)}
                        className="block w-full rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left hover:border-amber-300 hover:bg-amber-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-800">
                            {finding.testName}
                          </span>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
                            {finding.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {finding.value} {finding.unit}
                          {finding.referenceRange
                            ? ` · ${t("timeline.safety.referencePrefix")} ${finding.referenceRange}`
                            : ""}
                          {" · "}
                          {formatDate(finding.date, t)}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-400">
                          {finding.documentName}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {interactionFlags.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Pill size={16} className="text-amber-700" />
                    <h3 className="text-sm font-semibold text-slate-800">
                      {t("timeline.safety.interactionsTitle")} ({interactionFlags.length})
                    </h3>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {interactionFlags.map((flag, index) => (
                      <div
                        key={`${flag.medicationA}-${flag.medicationB}-${index}`}
                        className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                      >
                        <p className="text-sm font-semibold text-slate-800">
                          {flag.medicationA} + {flag.medicationB}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {flag.note}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-slate-400">
                    {t("timeline.safety.interactionsDisclaimer")}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {(
            [
              ["all", t("timeline.filter.all"), counts.all],
              ["prescriptions", t("timeline.filter.prescriptions"), counts.prescriptions],
              ["labs", t("timeline.filter.labs"), counts.labs],
              ["verified", t("timeline.filter.verified"), counts.verified],
              ["pending", t("timeline.filter.pending"), counts.pending],
              ["attention", t("timeline.filter.attention"), counts.attention],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-2xl border p-4 text-left transition ${
                filter === value
                  ? "border-teal-500 bg-teal-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-600">{label}</span>
                <Filter
                  size={16}
                  className={filter === value ? "text-teal-700" : "text-slate-300"}
                />
              </div>
              <strong className="mt-2 block text-2xl font-semibold">{count}</strong>
            </button>
          ))}
        </section>

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <div className="mb-6 flex flex-col gap-2 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">{t("timeline.timelineHeading")}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredRecords.length} {t("timeline.recordsInView")}
                </p>
              </div>
              <Link
                href="/records"
                className="text-sm font-semibold text-teal-700 hover:text-teal-800"
              >
                {t("timeline.openDetailedRecords")} →
              </Link>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-dashed p-12 text-center">
                <Loader2 size={32} className="mx-auto mb-3 animate-spin text-slate-400" />
                <p className="font-medium">{t("timeline.loading")}</p>
              </div>
            ) : groupedTimeline.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-12 text-center">
                <FileText size={38} className="mx-auto mb-3 text-slate-300" />
                <h3 className="font-semibold text-slate-700">{t("timeline.empty.title")}</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                  {records.length === 0
                    ? t("timeline.empty.noneYet")
                    : t("timeline.empty.tryFilter")}
                </p>
                {records.length === 0 && (
                  <Link
                    href="/prescriptions"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
                  >
                    <Upload size={16} />
                    {t("timeline.uploadDocument")}
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {groupedTimeline.map((group) => (
                  <div key={group.key}>
                    <div className="mb-4 flex items-center gap-3">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                        {group.label}
                      </span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    <div className="relative space-y-4 pl-6 before:absolute before:left-[10px] before:top-2 before:h-[calc(100%-8px)] before:w-px before:bg-slate-200">
                      {group.records.map((record) => {
                        const status = getRecordStatus(record);
                        const kind = getDocumentKind(record);
                        const isSelected = selectedRecordId === record.id;

                        return (
                          <button
                            key={record.id}
                            type="button"
                            onClick={() => setSelectedRecordId(record.id)}
                            className={`relative block w-full rounded-2xl border p-5 text-left transition ${
                              isSelected
                                ? "border-teal-400 bg-teal-50/60 shadow-sm"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                            }`}
                          >
                            <span
                              className={`absolute -left-[22px] top-6 h-4 w-4 rounded-full border-4 border-white shadow-sm ${
                                status === "verified"
                                  ? "bg-emerald-500"
                                  : status === "attention"
                                  ? "bg-red-500"
                                  : "bg-amber-400"
                              }`}
                            />

                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  <KindBadge record={record} />
                                  <StatusBadge record={record} />
                                </div>

                                <h3 className="text-lg font-semibold text-slate-800">
                                  {record.documentName || t("timeline.defaultDocumentName")}
                                </h3>

                                <p className="mt-1 text-sm text-slate-500">
                                  {record.documentType || (kind === "labs" ? t("timeline.kind.lab") : t("timeline.kind.prescription"))}
                                </p>

                                <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
                                  {clinicalIntakePreviewText(
                                    record.interpretation,
                                    record.summary || t("timeline.detail.noInterpretation")
                                  )}
                                </p>
                              </div>

                              <div className="shrink-0 text-xs text-slate-400 md:text-right">
                                {formatDate(getDateValue(record), t)}
                                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-slate-300">
                                  {t("timeline.openEvent")}
                                </p>
                              </div>
                            </div>

                            {record.medications && record.medications.length > 0 && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {record.medications.slice(0, 4).map((medication, index) => (
                                  <span
                                    key={`${record.id}-${index}`}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600"
                                  >
                                    <Pill size={12} />
                                    {medication.name || t("timeline.medicationDefault")}
                                  </span>
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {!selectedRecord ? (
                <div className="flex min-h-[500px] flex-col items-center justify-center text-center">
                  <History size={48} className="mb-4 text-slate-300" />
                  <h2 className="text-lg font-semibold">{t("timeline.detail.selectEvent")}</h2>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                    {t("timeline.detail.selectEventHint")}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">
                        {t("timeline.detail.healthEvent")}
                      </p>
                      <h2 className="mt-2 text-xl font-semibold">
                        {selectedRecord.documentName || t("timeline.defaultDocumentName")}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatDate(getDateValue(selectedRecord), t)}
                      </p>
                    </div>
                    <StatusBadge record={selectedRecord} />
                  </div>

                  <div className="mt-6">
                    <KindBadge record={selectedRecord} />
                  </div>

                  <div className="mt-6">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {t("timeline.detail.interpretation")}
                    </h3>
                    <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                      {selectedRecord.interpretation ? (
                        <ClinicalIntakeSummary
                          interpretation={selectedRecord.interpretation}
                          fallback={
                            <p className="text-sm leading-6 text-slate-700">
                              {selectedRecord.interpretation ||
                                selectedRecord.summary ||
                                t("timeline.detail.noInterpretation")}
                            </p>
                          }
                        />
                      ) : (
                        <p className="text-sm leading-6 text-slate-700">
                          {selectedRecord.summary ||
                            t("timeline.detail.noInterpretation")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {t("timeline.detail.medications")}
                      </h3>
                      <Pill size={16} className="text-slate-300" />
                    </div>

                    {selectedRecord.medications && selectedRecord.medications.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {selectedRecord.medications.map((medication, index) => (
                          <div
                            key={`${selectedRecord.id}-detail-${index}`}
                            className="rounded-2xl border border-slate-200 p-3"
                          >
                            <p className="text-sm font-semibold text-slate-800">
                              {medication.name || t("timeline.medicationDefault")}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {[medication.dosage, medication.frequency, medication.duration]
                                .filter(Boolean)
                                .join(" · ") || t("timeline.detail.detailsNotRecorded")}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-dashed p-4 text-sm text-slate-500">
                        {t("timeline.detail.noMedications")}
                      </div>
                    )}
                  </div>

                  {getRecordStatus(selectedRecord) === "attention" && (
                    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        <XCircle size={18} className="mt-0.5 text-amber-700" />
                        <div>
                          <h3 className="text-sm font-semibold text-amber-900">
                            {t("timeline.detail.correctionRequested")}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-amber-800">
                            {selectedRecord.rejectionReason ||
                              t("timeline.detail.correctionDefault")}
                          </p>
                          <Link
                            href={`/prescriptions?correctionRecordId=${encodeURIComponent(
                              selectedRecord.id
                            )}`}
                            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-amber-800"
                          >
                            <Upload size={15} />
                            {t("timeline.detail.uploadCorrected")}
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={17} className="text-teal-700" />
                      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {t("timeline.detail.verificationHistory")}
                      </h3>
                    </div>

                    {selectedRecord.verificationAudits &&
                    selectedRecord.verificationAudits.length > 0 ? (
                      <div className="mt-3 space-y-3">
                        {selectedRecord.verificationAudits.map((audit, index) => (
                          <div
                            key={audit.id || `${selectedRecord.id}-audit-${index}`}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm font-semibold text-slate-700">
                                {auditLabel(audit.action, t)}
                              </p>
                              <span className="text-xs text-slate-400">
                                {formatDate(audit.createdAt, t)}
                              </span>
                            </div>
                            {audit.note && (
                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                {audit.note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-dashed p-4 text-sm text-slate-500">
                        {t("timeline.detail.noVerification")}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-6">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {t("timeline.detail.originalSource")}
                    </h3>

                    {selectedRecord.originalFileUrl ? (
                      <div className="mt-3 space-y-2">
                        <button
                          type="button"
                          onClick={() => setShowOriginal(true)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800"
                        >
                          <FileSearch size={16} />
                          {t("timeline.detail.viewOriginal")}
                        </button>

                        <a
                          href={`/api/medical-records/${selectedRecord.id}/document`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <ExternalLink size={16} />
                          {t("timeline.detail.openOriginal")}
                        </a>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-dashed p-4 text-sm text-slate-500">
                        {t("timeline.detail.originalUnavailable")}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>

      {showOriginal && selectedRecord?.originalFileUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="font-semibold text-slate-900">{t("timeline.modal.title")}</p>
                <p className="mt-0.5 text-xs text-slate-500">{t("timeline.modal.patientView")}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowOriginal(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                {t("timeline.modal.close")}
              </button>
            </div>

            <div className="min-h-0 flex-1 bg-slate-100 p-4">
              {selectedRecord.originalFileType === "application/pdf" ||
              selectedRecord.originalFileUrl.toLowerCase().includes(".pdf") ? (
                <iframe
                  src={`/api/medical-records/${selectedRecord.id}/document#toolbar=0&navpanes=0&scrollbar=1`}
                  title={t("timeline.modal.title")}
                  className="h-full w-full rounded-2xl border border-slate-200 bg-white"
                />
              ) : (
                <div className="flex h-full items-center justify-center overflow-auto rounded-2xl border border-slate-200 bg-white p-4">
                  <img
                    src={`/api/medical-records/${selectedRecord.id}/document`}
                    alt={t("timeline.modal.title")}
                    className="max-h-full max-w-full object-contain"
                    draggable={false}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
    </main>
  );
}
