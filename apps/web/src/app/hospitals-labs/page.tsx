 "use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  BedDouble,
  Bell,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileText,
  FlaskConical,
  HeartPulse,
  Link2,
  LogOut,
  MapPin,
  Mic,
  Pill,
  RefreshCw,
  LifeBuoy,
  ShieldCheck,
  Stethoscope,
  TestTube2,
  UserCheck,
  Workflow,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";

type Hospital = {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
};

type HospitalEncounter = {
  id: string;
  encounterType?: string | null;
  encounterDate?: string | null;
  clinicianName?: string | null;
  department?: string | null;
  notes?: string | null;
};

type HospitalTest = {
  id: string;
  name: string;
  category?: string | null;
  status?: string | null;
  orderedAt?: string | null;
  resultSummary?: string | null;
  notes?: string | null;
};

type HospitalProcedure = {
  id: string;
  name: string;
  status?: string | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  clinicianName?: string | null;
  notes?: string | null;
};

type HospitalBillItem = {
  id: string;
  description: string;
  category?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  amount?: number | null;
};

type InsuranceClaim = {
  id: string;
  insurerName: string;
  policyNumber?: string | null;
  claimNumber?: string | null;
  status?: string | null;
  claimedAmount?: number | null;
  approvedAmount?: number | null;
  patientPayableAmount?: number | null;
};

type HospitalBill = {
  id: string;
  invoiceNumber?: string | null;
  status?: string | null;
  issuedAt?: string | null;
  subtotal?: number | null;
  totalAmount?: number | null;
  insuranceCoveredAmount?: number | null;
  patientPayableAmount?: number | null;
  currency?: string | null;
  items?: HospitalBillItem[];
  insuranceClaims?: InsuranceClaim[];
};

type HospitalAdmission = {
  id: string;
  admissionNumber?: string | null;
  status?: string | null;
  admissionDate?: string | null;
  dischargeDate?: string | null;
  ward?: string | null;
  bed?: string | null;
  attendingClinicianName?: string | null;
  reason?: string | null;
  dischargeSummary?: string | null;
  hospital: Hospital;
  encounters?: HospitalEncounter[];
  tests?: HospitalTest[];
  procedures?: HospitalProcedure[];
  bills?: HospitalBill[];
  insuranceClaims?: InsuranceClaim[];
};

type Lab = {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
};

type MedicalRecordLink = {
  id: string;
  status?: string | null;
  documentName?: string | null;
  documentType?: string | null;
  verifiedAt?: string | null;
};

type LabReport = {
  id: string;
  reportNumber?: string | null;
  testName: string;
  testCategory?: string | null;
  status?: string | null;
  resultSummary?: string | null;
  reportDate?: string | null;
  finalizedAt?: string | null;
  digitallyReceived?: boolean;
  notes?: string | null;
  lab: Lab;
  labOrder?: {
    id: string;
    orderNumber?: string | null;
    status?: string | null;
  } | null;
  medicalRecord?: MedicalRecordLink | null;
};

type LabOrder = {
  id: string;
  orderNumber?: string | null;
  testName: string;
  testCategory?: string | null;
  status?: string | null;
  orderedAt?: string | null;
  sampleCollectedAt?: string | null;
  finalizedAt?: string | null;
  clinicalNotes?: string | null;
  lab: Lab;
  reports?: LabReport[];
};

type HospitalsLabsResponse = {
  success: boolean;
  patient?: {
    id: string;
    name: string;
  };
  hospital?: {
    admissions: HospitalAdmission[];
    encounters: HospitalEncounter[];
  };
  labs?: {
    orders: LabOrder[];
    reports: LabReport[];
  };
  error?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function money(
  value?: number | null,
  currency?: string | null
) {
  if (value === null || value === undefined) return "—";

  const code = currency || "INR";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: code,
    maximumFractionDigits: 2,
  }).format(value);
}

function titleCase(value?: string | null) {
  if (!value) return "Unknown";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusClass(value?: string | null) {
  const status = String(value || "").toUpperCase();

  if (
    status === "VERIFIED" ||
    status === "FINAL" ||
    status === "FINALIZED" ||
    status === "COMPLETED" ||
    status === "PAID"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    status === "PENDING" ||
    status === "ORDERED" ||
    status === "PROCESSING" ||
    status === "ADMITTED" ||
    status === "IN_PROGRESS" ||
    status === "ISSUED"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (
    status === "CANCELLED" ||
    status === "REJECTED"
  ) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}


const navItems = [
  { label: "Dashboard", icon: Activity, href: "/dashboard" },
  { label: "Health Records", icon: FileText, href: "/records" },
  { label: "Health Timeline", icon: Activity, href: "/health-timeline" },
  { label: "Prescriptions", icon: Pill, href: "/prescriptions" },
  { label: "Vitals", icon: HeartPulse, href: "/vitals" },
  { label: "Medication & Reminders", icon: Bell, href: "/medications" },
  { label: "Personalized Health", icon: BrainCircuit, href: "/personalized-health" },
  { label: "Hospitals & Labs", icon: Building2, href: "/hospitals-labs" },
  { label: "Voice Assistant", icon: Mic, href: "/voice-assistant" },
  { label: "FHIR / ABDM", icon: Workflow },
  { label: "Consent & Privacy", icon: ShieldCheck, href: "/consent" },
  { label: "Help & Support", icon: LifeBuoy, href: "/support" },
];

function getNavLabel(label: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    "Dashboard": t("nav.dashboard"),
    "Health Records": t("nav.records"),
    "Health Timeline": t("nav.timeline"),
    "Prescriptions": t("nav.prescriptions"),
    "Vitals": t("nav.vitals"),
    "Medication & Reminders": t("nav.medications"),
    "Personalized Health": t("nav.personalizedHealth"),
    "Hospitals & Labs": t("nav.hospitalsLabs"),
    "Voice Assistant": t("nav.voiceAssistant"),
    "FHIR / ABDM": t("nav.fhir"),
    "Consent & Privacy": t("nav.consent"),
    "Help & Support": t("nav.support"),
  };

  return labels[label] ?? label;
}


function labStageState(
  report?: LabReport | null,
  order?: LabOrder | null
) {
  const reportStatus = String(report?.status || "").toUpperCase();
  const orderStatus = String(order?.status || "").toUpperCase();

  if (reportStatus === "FINAL" || reportStatus === "CORRECTED") {
    return {
      ordered: true,
      sample: true,
      processing: true,
      final: true,
    };
  }

  if (orderStatus === "PROCESSING") {
    return {
      ordered: true,
      sample: true,
      processing: true,
      final: false,
    };
  }

  if (
    orderStatus === "SAMPLE_COLLECTED"
  ) {
    return {
      ordered: true,
      sample: true,
      processing: false,
      final: false,
    };
  }

  return {
    ordered: true,
    sample: false,
    processing: false,
    final: false,
  };
}

function LabPipeline({
  report,
  order,
}: {
  report?: LabReport | null;
  order?: LabOrder | null;
}) {
  const state = labStageState(report, order);

  const stages = [
    { label: "Ordered", done: state.ordered },
    { label: "Sample", done: state.sample },
    { label: "Processing", done: state.processing },
    { label: "Final", done: state.final },
  ];

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Lab progress
        </p>
        <p className="text-[11px] font-medium text-slate-400">
          {state.final ? "Report ready" : "In progress"}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {stages.map((stage, index) => (
          <div key={stage.label} className="flex min-w-0 flex-1 items-center">
            <div className="min-w-0 flex-1">
              <div
                className={`h-2 rounded-full transition ${
                  stage.done
                    ? "bg-gradient-to-r from-teal-500 to-indigo-500"
                    : "bg-slate-100"
                }`}
              />
              <p
                className={`mt-2 truncate text-[10px] font-semibold ${
                  stage.done ? "text-slate-700" : "text-slate-400"
                }`}
              >
                {stage.label}
              </p>
            </div>

            {index < stages.length - 1 && (
              <span className="mx-1 text-slate-200">•</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HospitalsLabsPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [data, setData] = useState<HospitalsLabsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expandedAdmissions, setExpandedAdmissions] = useState<Record<string, boolean>>({});
  const [expandedBills, setExpandedBills] = useState<Record<string, boolean>>({});
  const [selectedAdmission, setSelectedAdmission] =
    useState<HospitalAdmission | null>(null);
  const [selectedReport, setSelectedReport] =
    useState<LabReport | null>(null);

  async function loadData(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const sessionResponse = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const session = await sessionResponse.json().catch(() => null);

      if (
        !sessionResponse.ok ||
        !session?.authenticated ||
        !session?.user
      ) {
        router.replace("/login");
        return;
      }

      if (session.user.role !== "PATIENT") {
        router.replace("/clinician");
        return;
      }

      const response = await fetch("/api/hospitals-labs", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || "Unable to load Hospitals & Labs data."
        );
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Hospitals & Labs data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const admissions = data?.hospital?.admissions || [];
  const encounters = data?.hospital?.encounters || [];
  const labOrders = data?.labs?.orders || [];
  const labReports = data?.labs?.reports || [];

  const summary = useMemo(() => {
    const activeAdmissions = admissions.filter(
      (item) =>
        String(item.status || "").toUpperCase() === "ADMITTED"
    ).length;

    const pendingLabReports = labReports.filter((report) => {
      const status = String(report.medicalRecord?.status || "").toUpperCase();
      return (
        status === "PENDING" ||
        String(report.status || "").toUpperCase() === "FINAL"
      );
    }).length;

    const digitallyReceived = labReports.filter(
      (report) => report.digitallyReceived !== false
    ).length;

    const totalPatientPayable = admissions.reduce((sum, admission) => {
      return (
        sum +
        (admission.bills || []).reduce(
          (billSum, bill) =>
            billSum + Number(bill.patientPayableAmount || 0),
          0
        )
      );
    }, 0);

    return {
      activeAdmissions,
      pendingLabReports,
      digitallyReceived,
      totalPatientPayable,
    };
  }, [admissions, labReports]);

  function toggleAdmission(id: string) {
    setExpandedAdmissions((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  function toggleBill(id: string) {
    setExpandedBills((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  function episodeEvents(admission: HospitalAdmission) {
    const events: Array<{
      id: string;
      title: string;
      subtitle: string;
      date?: string | null;
      icon: typeof Building2;
    }> = [
      {
        id: `${admission.id}-admission`,
        title: "Admission",
        subtitle: admission.reason || "Hospital admission",
        date: admission.admissionDate,
        icon: Building2,
      },
      ...(admission.encounters || []).map((item) => ({
        id: `${admission.id}-encounter-${item.id}`,
        title: item.department || "Care encounter",
        subtitle: item.clinicianName || "Clinical encounter",
        date: item.encounterDate,
        icon: Stethoscope,
      })),
      ...(admission.tests || []).map((item) => ({
        id: `${admission.id}-test-${item.id}`,
        title: item.name,
        subtitle: `Test · ${titleCase(item.status)}`,
        date: item.orderedAt,
        icon: FlaskConical,
      })),
      ...(admission.procedures || []).map((item) => ({
        id: `${admission.id}-procedure-${item.id}`,
        title: item.name,
        subtitle: `Procedure · ${titleCase(item.status)}`,
        date: item.scheduledAt,
        icon: Activity,
      })),
      ...(admission.bills || []).map((item) => ({
        id: `${admission.id}-bill-${item.id}`,
        title: item.invoiceNumber || "Hospital bill",
        subtitle: `Billing · ${titleCase(item.status)}`,
        date: item.issuedAt,
        icon: CircleDollarSign,
      })),
    ];

    return events.sort(
      (a, b) =>
        new Date(a.date || 0).getTime() -
        new Date(b.date || 0).getTime()
    );
  }

  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      const response = await fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          result?.error || `Logout failed (${response.status}).`
        );
      }

      window.location.assign("/login");
    } catch (err) {
      setLoggingOut(false);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to log out."
      );
    }
  }

  if (loading) {
    return (
      <main className="app-shell">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <RefreshCw size={20} className="animate-spin" />
            Loading Hospitals & Labs...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Link2 size={30} />
          </div>
          <div>
            <h1>JeevanLink</h1>
            <p>{t("app.tagline")}</p>
          </div>
        </div>

        <div className="sidebar-label">
          {t("app.continuityCentre")}
        </div>

        <nav className="nav-menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            const linked = Boolean(item.href);

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (item.href) {
                    router.push(item.href);
                  }
                }}
                disabled={!linked}
                className={`nav-item ${
                  item.label === "Hospitals & Labs" ? "active" : ""
                } ${
                  !linked
                    ? "cursor-default opacity-60"
                    : ""
                }`}
              >
                <Icon size={21} strokeWidth={1.8} />
                <span>{getNavLabel(item.label, t)}</span>

                {item.label === "Hospitals & Labs" &&
                  summary.pendingLabReports > 0 && (
                    <span className="nav-badge orange">
                      {summary.pendingLabReports}
                    </span>
                  )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="workspace-card">
            <ShieldCheck size={28} />
            <div>
              <strong>{t("app.prototypeWorkspace")}</strong>
              <p>{t("app.aiDisclaimer")}</p>
            </div>
          </div>
        </div>
      </aside>

      <section className="main-content">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-200/20 blur-3xl" />
          <div className="absolute left-1/3 top-10 h-56 w-56 rounded-full bg-indigo-200/20 blur-3xl" />
          <div className="absolute right-1/3 top-56 h-44 w-44 rounded-full bg-purple-200/10 blur-3xl" />
        </div>

        <header className="topbar relative z-10">
          <div className="breadcrumb">
            <span className="menu-lines">☰</span>
            <span>JeevanLink</span>
            <span className="chevron">›</span>
            <strong>{t("nav.hospitalsLabs")}</strong>
          </div>

          <div className="top-actions">
            <LanguageSwitcher />

            <button
              type="button"
              className="notification-button"
              onClick={() => router.push("/records")}
              aria-label="Open health records"
              title="Pending health records"
            >
              <Bell size={20} />

              {summary.pendingLabReports > 0 && (
                <span>{summary.pendingLabReports}</span>
              )}
            </button>

            <div className="profile" title={data?.patient?.name || "Patient"}>
              <div className="avatar">
                {(data?.patient?.name || "P")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <span>{data?.patient?.name || "Patient"}</span>
              <ChevronDown size={16} />
            </div>

            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={refreshing}
              className="ml-1 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              title="Refresh data"
              aria-label="Refresh data"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              <span className="hidden xl:inline">
                {refreshing ? "Refreshing" : "Refresh"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="ml-1 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">
                {loggingOut ? "Logging out..." : t("common.logout")}
              </span>
            </button>
          </div>
        </header>

        <div className="page-content">
          <div className="relative mb-8 overflow-hidden rounded-3xl border border-teal-100 bg-gradient-to-br from-white via-teal-50/70 to-indigo-50/30 p-6 shadow-sm md:p-7">
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-teal-200/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-indigo-200/20 blur-3xl" />
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
                  <Building2 size={14} />
                  Continuity Centre
                </div>

                <h2 className="text-4xl font-semibold tracking-tight text-slate-900">
                  Hospitals & Labs
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  One place for hospital episodes, investigations, bills,
                  insurance and digitally received lab reports—with clinician
                  verification kept visible.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                  <ShieldCheck size={14} />
                  Authenticated patient view
                </span>

                <button
                  type="button"
                  onClick={() => void loadData(true)}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw
                    size={16}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  {refreshing ? "Syncing..." : "Sync now"}
                </button>
              </div>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
                <div className="rounded-xl bg-teal-100 p-2 text-teal-700">
                  <Building2 size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Hospital continuity
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {admissions.length} care episode{admissions.length === 1 ? "" : "s"} connected
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
                <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700">
                  <FlaskConical size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Lab continuity
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {labOrders.length} order{labOrders.length === 1 ? "" : "s"} · {labReports.length} report{labReports.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
                <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Verification
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {summary.pendingLabReports
                      ? `${summary.pendingLabReports} item${summary.pendingLabReports === 1 ? "" : "s"} awaiting clinician review`
                      : "No pending lab review"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
              <AlertCircle className="mt-0.5 shrink-0" size={19} />
              <div>
                <p className="font-semibold">Unable to load this module</p>
                <p className="mt-1 text-sm">{error}</p>
              </div>
            </div>
          )}

          <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-teal-50/40 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Total admissions
                </span>
                <Building2 size={20} className="text-teal-600" />
              </div>
              <div className="text-3xl font-semibold text-slate-900">
                {admissions.length}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {summary.activeAdmissions} currently admitted
              </p>
            </div>

            <div className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-indigo-50/40 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Lab orders
                </span>
                <TestTube2 size={20} className="text-indigo-600" />
              </div>
              <div className="text-3xl font-semibold text-slate-900">
                {labOrders.length}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Orders and sample workflow
              </p>
            </div>

            <div className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-purple-50/40 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Digital reports
                </span>
                <FlaskConical size={20} className="text-purple-600" />
              </div>
              <div className="text-3xl font-semibold text-slate-900">
                {summary.digitallyReceived}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {summary.pendingLabReports} linked to pending review
              </p>
            </div>

            <div className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-orange-50/40 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">
                  Patient payable
                </span>
                <CircleDollarSign size={20} className="text-orange-600" />
              </div>
              <div className="text-3xl font-semibold text-slate-900">
                {money(summary.totalPatientPayable)}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Across available hospital bills
              </p>
            </div>
          </div>

          <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-teal-50/50 p-5 md:flex-row md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-600">
                  Your care journey
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  From hospital episode to verified health record
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-teal-700">
                  Care
                </span>
                <span className="text-slate-300">→</span>
                <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-indigo-700">
                  Lab
                </span>
                <span className="text-slate-300">→</span>
                <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-amber-700">
                  Review
                </span>
                <span className="text-slate-300">→</span>
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-emerald-700">
                  Continuity
                </span>
              </div>
            </div>

            <div className="grid gap-px bg-slate-100 md:grid-cols-4">
              {[
                {
                  icon: Building2,
                  label: "Hospital",
                  value: admissions.length,
                  suffix: admissions.length === 1 ? "episode" : "episodes",
                  note: "Admissions stay connected",
                },
                {
                  icon: Stethoscope,
                  label: "Care",
                  value: encounters.length,
                  suffix: encounters.length === 1 ? "encounter" : "encounters",
                  note: "Clinical touchpoints",
                },
                {
                  icon: FlaskConical,
                  label: "Diagnostics",
                  value: labOrders.length + labReports.length,
                  suffix: "lab item" + (labOrders.length + labReports.length === 1 ? "" : "s"),
                  note: "Orders and reports",
                },
                {
                  icon: UserCheck,
                  label: "Verification",
                  value: summary.pendingLabReports,
                  suffix: summary.pendingLabReports === 1 ? "pending" : "pending",
                  note: "Human review stays visible",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className="bg-white p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="rounded-xl bg-slate-50 p-2">
                        <Icon size={17} className="text-teal-600" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {item.label}
                      </span>
                    </div>

                    <div className="text-2xl font-semibold text-slate-900">
                      {item.value}
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">
                      {item.suffix}
                    </p>
                    <p className="mt-2 text-[11px] leading-5 text-slate-400">
                      {item.note}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
            <section className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
              <div className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-gradient-to-r from-teal-400 via-indigo-400 to-purple-400" />
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    Hospital care
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Admissions, care progress, tests, procedures, bills and
                    insurance.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {admissions.length} episode{admissions.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                {[
                  ["Admission", Building2],
                  ["Care", Stethoscope],
                  ["Diagnostics", FlaskConical],
                  ["Billing", CircleDollarSign],
                ].map(([label, Icon], index) => (
                  <div key={String(label)} className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                      <Icon size={14} className="text-teal-600" />
                      {String(label)}
                    </div>
                    {index < 3 && (
                      <span className="text-slate-300">→</span>
                    )}
                  </div>
                ))}
              </div>

              {admissions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  No hospital admissions are available yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {admissions.map((admission) => {
                    const open = Boolean(expandedAdmissions[admission.id]);

                    return (
                      <div
                        key={admission.id}
                        className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"
                      >
                        <button
                          type="button"
                          onClick={() => toggleAdmission(admission.id)}
                          className="flex w-full items-center justify-between gap-4 bg-slate-50 p-5 text-left transition hover:bg-slate-100"
                        >
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <h4 className="font-semibold text-slate-900">
                                {admission.hospital?.name || "Hospital"}
                              </h4>
                              <span
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                                  admission.status
                                )}`}
                              >
                                {titleCase(admission.status)}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span>
                                Admitted {formatDate(admission.admissionDate)}
                              </span>
                              {admission.admissionNumber && (
                                <span>
                                  Admission #{admission.admissionNumber}
                                </span>
                              )}
                              {admission.ward && (
                                <span className="inline-flex items-center gap-1">
                                  <BedDouble size={13} />
                                  {admission.ward}
                                  {admission.bed ? ` · Bed ${admission.bed}` : ""}
                                </span>
                              )}
                            </div>
                          </div>

                          <ChevronDown
                            size={19}
                            className={`shrink-0 text-slate-400 transition ${
                              open ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {open && (
                          <div className="space-y-5 p-5">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="rounded-2xl border border-slate-200 p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                                  <MapPin size={16} />
                                  Hospital
                                </div>
                                <p className="text-sm font-medium text-slate-900">
                                  {admission.hospital?.name || "—"}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {[
                                    admission.hospital?.address,
                                    admission.hospital?.city,
                                    admission.hospital?.state,
                                    admission.hospital?.pincode,
                                  ]
                                    .filter(Boolean)
                                    .join(", ") || "Address unavailable"}
                                </p>
                              </div>

                              <div className="rounded-2xl border border-slate-200 p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                                  <Stethoscope size={16} />
                                  Care team
                                </div>
                                <p className="text-sm text-slate-700">
                                  <span className="text-slate-400">Attending:</span>{" "}
                                  {admission.attendingClinicianName || "Not recorded"}
                                </p>
                                <p className="mt-1 text-sm text-slate-700">
                                  <span className="text-slate-400">Reason:</span>{" "}
                                  {admission.reason || "Not recorded"}
                                </p>
                              </div>
                            </div>

                            {(admission.encounters?.length || 0) > 0 && (
                              <div>
                                <h5 className="mb-3 text-sm font-semibold text-slate-800">
                                  Care progress
                                </h5>
                                <div className="space-y-2">
                                  {admission.encounters?.map((encounter) => (
                                    <div
                                      key={encounter.id}
                                      className="group rounded-2xl border border-slate-200 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="font-medium text-slate-900">
                                          {encounter.department || "General care"}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                          {formatDateTime(encounter.encounterDate)}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {titleCase(encounter.encounterType)}
                                        {encounter.clinicianName
                                          ? ` · ${encounter.clinicianName}`
                                          : ""}
                                      </p>
                                      {encounter.notes && (
                                        <p className="mt-3 text-sm leading-6 text-slate-600">
                                          {encounter.notes}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(admission.tests?.length || 0) > 0 && (
                              <div>
                                <h5 className="mb-3 text-sm font-semibold text-slate-800">
                                  Tests
                                </h5>
                                <div className="grid gap-3 md:grid-cols-2">
                                  {admission.tests?.map((test) => (
                                    <div
                                      key={test.id}
                                      className="group rounded-2xl border border-slate-200 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <p className="font-medium text-slate-900">
                                            {test.name}
                                          </p>
                                          <p className="mt-1 text-xs text-slate-500">
                                            {test.category || "Laboratory / diagnostic"}
                                          </p>
                                        </div>
                                        <span
                                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                                            test.status
                                          )}`}
                                        >
                                          {titleCase(test.status)}
                                        </span>
                                      </div>

                                      <p className="mt-3 text-xs text-slate-500">
                                        Ordered {formatDate(test.orderedAt)}
                                      </p>

                                      {test.resultSummary && (
                                        <p className="mt-2 text-sm text-slate-600">
                                          {test.resultSummary}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(admission.procedures?.length || 0) > 0 && (
                              <div>
                                <h5 className="mb-3 text-sm font-semibold text-slate-800">
                                  Procedures
                                </h5>
                                <div className="space-y-2">
                                  {admission.procedures?.map((procedure) => (
                                    <div
                                      key={procedure.id}
                                      className="group rounded-2xl border border-slate-200 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="font-medium text-slate-900">
                                          {procedure.name}
                                        </span>
                                        <span
                                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                                            procedure.status
                                          )}`}
                                        >
                                          {titleCase(procedure.status)}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {procedure.clinicianName || "Clinician not recorded"}
                                      </p>
                                      {procedure.notes && (
                                        <p className="mt-2 text-sm text-slate-600">
                                          {procedure.notes}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(admission.bills?.length || 0) > 0 && (
                              <div>
                                <h5 className="mb-3 text-sm font-semibold text-slate-800">
                                  Bills & insurance
                                </h5>
                                <div className="space-y-3">
                                  {admission.bills?.map((bill) => {
                                    const billOpen = Boolean(expandedBills[bill.id]);

                                    return (
                                      <div
                                        key={bill.id}
                                        className="rounded-2xl border border-slate-200"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => toggleBill(bill.id)}
                                          className="w-full p-4 text-left"
                                        >
                                          <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <CircleDollarSign
                                                  size={16}
                                                  className="text-orange-600"
                                                />
                                                <span className="font-medium text-slate-900">
                                                  {bill.invoiceNumber || "Hospital bill"}
                                                </span>
                                                <span
                                                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                                                    bill.status
                                                  )}`}
                                                >
                                                  {titleCase(bill.status)}
                                                </span>
                                              </div>
                                              <p className="mt-1 text-xs text-slate-500">
                                                Issued {formatDate(bill.issuedAt)}
                                              </p>
                                            </div>

                                            <div className="text-right">
                                              <p className="text-sm font-semibold text-slate-900">
                                                {money(
                                                  bill.patientPayableAmount,
                                                  bill.currency
                                                )}
                                              </p>
                                              <p className="text-[11px] text-slate-500">
                                                patient payable
                                              </p>
                                            </div>
                                          </div>
                                        </button>

                                        {billOpen && (
                                          <div className="border-t border-slate-200 p-4">
                                            <div className="grid gap-3 md:grid-cols-3">
                                              <div className="rounded-xl bg-slate-50 p-3">
                                                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                                  Subtotal
                                                </p>
                                                <p className="mt-1 font-semibold text-slate-900">
                                                  {money(bill.subtotal, bill.currency)}
                                                </p>
                                              </div>

                                              <div className="rounded-xl bg-emerald-50 p-3">
                                                <p className="text-[11px] uppercase tracking-wide text-emerald-600">
                                                  Insurance covered
                                                </p>
                                                <p className="mt-1 font-semibold text-emerald-800">
                                                  {money(
                                                    bill.insuranceCoveredAmount,
                                                    bill.currency
                                                  )}
                                                </p>
                                              </div>

                                              <div className="rounded-xl bg-orange-50 p-3">
                                                <p className="text-[11px] uppercase tracking-wide text-orange-600">
                                                  Patient payable
                                                </p>
                                                <p className="mt-1 font-semibold text-orange-800">
                                                  {money(
                                                    bill.patientPayableAmount,
                                                    bill.currency
                                                  )}
                                                </p>
                                              </div>
                                            </div>

                                            {(bill.items?.length || 0) > 0 && (
                                              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                                                <div className="grid grid-cols-[1fr_90px_110px] bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                                  <span>Item</span>
                                                  <span className="text-right">Qty</span>
                                                  <span className="text-right">Amount</span>
                                                </div>
                                                {bill.items?.map((item) => (
                                                  <div
                                                    key={item.id}
                                                    className="grid grid-cols-[1fr_90px_110px] border-t border-slate-100 px-3 py-3 text-sm"
                                                  >
                                                    <div>
                                                      <p className="font-medium text-slate-800">
                                                        {item.description}
                                                      </p>
                                                      {item.category && (
                                                        <p className="text-[11px] text-slate-400">
                                                          {item.category}
                                                        </p>
                                                      )}
                                                    </div>
                                                    <span className="text-right text-slate-500">
                                                      {item.quantity ?? 1}
                                                    </span>
                                                    <span className="text-right font-medium text-slate-800">
                                                      {money(
                                                        item.amount,
                                                        bill.currency
                                                      )}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}

                                            {(bill.insuranceClaims?.length || 0) > 0 && (
                                              <div className="mt-4 space-y-2">
                                                {bill.insuranceClaims?.map((claim) => (
                                                  <div
                                                    key={claim.id}
                                                    className="rounded-xl border border-slate-200 p-3"
                                                  >
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                      <span className="font-medium text-slate-800">
                                                        {claim.insurerName}
                                                      </span>
                                                      <span
                                                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                                                          claim.status
                                                        )}`}
                                                      >
                                                        {titleCase(claim.status)}
                                                      </span>
                                                    </div>
                                                    <div className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                                                      <span>
                                                        Claimed{" "}
                                                        {money(
                                                          claim.claimedAmount,
                                                          bill.currency
                                                        )}
                                                      </span>
                                                      <span>
                                                        Approved{" "}
                                                        {money(
                                                          claim.approvedAmount,
                                                          bill.currency
                                                        )}
                                                      </span>
                                                      <span>
                                                        Patient{" "}
                                                        {money(
                                                          claim.patientPayableAmount,
                                                          bill.currency
                                                        )}
                                                      </span>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {admission.dischargeSummary && (
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                                  <FileText size={16} />
                                  Discharge summary
                                </div>
                                <p className="text-sm leading-6 text-slate-600">
                                  {admission.dischargeSummary}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="space-y-6">
              <section className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
              <div className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-gradient-to-r from-teal-400 via-indigo-400 to-purple-400" />
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">
                      Lab orders
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Track ordered tests and their report lifecycle.
                    </p>
                  </div>
                  <FlaskConical size={22} className="text-purple-600" />
                </div>

                {labOrders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-7 text-center text-sm text-slate-500">
                    No lab orders are available yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {labOrders.map((order) => (
                      <div
                        key={order.id}
                        className="group rounded-2xl border border-slate-200 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">
                              {order.testName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {order.lab?.name || "Laboratory"}
                              {order.testCategory
                                ? ` · ${order.testCategory}`
                                : ""}
                            </p>
                          </div>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                              order.status
                            )}`}
                          >
                            {titleCase(order.status)}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span>
                            Ordered {formatDate(order.orderedAt)}
                          </span>
                          {order.orderNumber && (
                            <span>#{order.orderNumber}</span>
                          )}
                          {order.sampleCollectedAt && (
                            <span>
                              Sample {formatDate(order.sampleCollectedAt)}
                            </span>
                          )}
                        </div>

                        <LabPipeline
                          order={order}
                          report={order.reports?.[0] || null}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">
                      Digital lab reports
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Reports received directly from a laboratory and linked
                      into JeevanLink.
                    </p>
                  </div>
                  <TestTube2 size={22} className="text-indigo-600" />
                </div>

                {labReports.length > 0 && (
                  <div className="mb-4 flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3">
                    <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                      <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-indigo-500 opacity-70" />
                      <span className="relative h-2.5 w-2.5 rounded-full bg-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                        Live continuity signal
                      </p>
                      <p className="text-sm font-medium text-slate-700">
                        Digital report linked to the authenticated health record
                      </p>
                    </div>
                  </div>
                )}

                {labReports.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-7 text-center text-sm text-slate-500">
                    No lab reports are available yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {labReports.map((report) => {
                      const recordStatus = String(
                        report.medicalRecord?.status || ""
                      ).toUpperCase();

                      const verified = Boolean(
                        report.medicalRecord?.verifiedAt
                      );

                      return (
                        <div
                          key={report.id}
                          className="group rounded-2xl border border-slate-200 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-900">
                                  {report.testName}
                                </p>

                                {report.digitallyReceived !== false && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                    <CheckCircle2 size={12} />
                                    Digitally received
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 text-xs text-slate-500">
                                {report.lab?.name || "Laboratory"}
                                {report.reportNumber
                                  ? ` · ${report.reportNumber}`
                                  : ""}
                              </p>
                            </div>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                                report.status
                              )}`}
                            >
                              {titleCase(report.status)}
                            </span>
                          </div>

                          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                            <div className="grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
                              <div>
                                <span className="text-slate-400">
                                  Report date
                                </span>
                                <p className="mt-1 font-medium text-slate-700">
                                  {formatDate(report.reportDate)}
                                </p>
                              </div>

                              <div>
                                <span className="text-slate-400">
                                  Medical record
                                </span>
                                <p className="mt-1 font-medium text-slate-700">
                                  {report.medicalRecord
                                    ? report.medicalRecord.documentName || "Linked"
                                    : "Not linked"}
                                </p>
                              </div>
                            </div>

                            {report.resultSummary && (
                              <div className="mt-4 border-t border-slate-200 pt-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Result summary
                                </p>
                                <p className="mt-2 text-sm leading-6 text-slate-700">
                                  {report.resultSummary}
                                </p>
                              </div>
                            )}

                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              {verified ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                                  <CheckCircle2 size={13} />
                                  Clinician verified
                                </span>
                              ) : recordStatus === "PENDING" ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                                  <UserCheck size={13} />
                                  Pending clinician verification
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                                  <FileText size={13} />
                                  Medical record linked
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => setSelectedReport(report)}
                                className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                              >
                                View report
                              </button>

                              {report.medicalRecord?.id && (
                                <button
                                  type="button"
                                  onClick={() => router.push("/records")}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                >
                                  Open Health Records
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    <ShieldCheck size={22} className="text-teal-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Continuity by design
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      A finalized digital lab report enters JeevanLink as a
                      linked medical record, but it remains pending until a
                      clinician verifies it.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50/70 via-white to-indigo-50/40 p-4 text-xs leading-5 text-slate-500 shadow-sm">
            <div className="flex items-start gap-2">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-teal-600" />
              <p>
                This page displays data returned for the authenticated patient.
                AI or digital ingestion does not by itself constitute a clinical
                conclusion or clinician verification.
              </p>
            </div>
          </div>
        </div>

        {(selectedAdmission || selectedReport) && (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-[2px]"
            onClick={() => {
              setSelectedAdmission(null);
              setSelectedReport(null);
            }}
          >
            <aside
              className="h-full w-full max-w-xl overflow-y-auto border-l border-white/60 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-600">
                    {selectedAdmission ? "Hospital episode" : "Laboratory report"}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900">
                    {selectedAdmission
                      ? selectedAdmission.hospital?.name || "Hospital episode"
                      : selectedReport?.testName || "Lab report"}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedAdmission(null);
                    setSelectedReport(null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                  aria-label="Close details"
                  title="Close"
                >
                  <X size={19} />
                </button>
              </div>

              {selectedAdmission && (
                <div className="space-y-6 p-6">
                  <div className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-slate-500">
                          {selectedAdmission.admissionNumber
                            ? `Admission #${selectedAdmission.admissionNumber}`
                            : "Hospital admission"}
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">
                          {selectedAdmission.hospital?.name || "Hospital"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(selectedAdmission.admissionDate)}
                          {selectedAdmission.dischargeDate
                            ? ` → ${formatDate(selectedAdmission.dischargeDate)}`
                            : " → ongoing"}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass(
                          selectedAdmission.status
                        )}`}
                      >
                        {titleCase(selectedAdmission.status)}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white/80 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          Ward / bed
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {selectedAdmission.ward || "—"}
                          {selectedAdmission.bed
                            ? ` · ${selectedAdmission.bed}`
                            : ""}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/80 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          Attending
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {selectedAdmission.attendingClinicianName || "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-semibold text-slate-900">
                          Episode timeline
                        </h4>
                        <p className="mt-1 text-xs text-slate-500">
                          A simple chronological view of the care episode.
                        </p>
                      </div>
                      <Activity size={18} className="text-teal-600" />
                    </div>

                    <div className="relative space-y-4 pl-2">
                      <div className="absolute bottom-4 left-[19px] top-4 w-px bg-slate-200" />

                      {episodeEvents(selectedAdmission).map((event) => {
                        const EventIcon = event.icon;

                        return (
                          <div key={event.id} className="relative flex gap-3">
                            <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                              <EventIcon size={15} className="text-teal-600" />
                            </div>

                            <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-800">
                                  {event.title}
                                </p>
                                <span className="text-[11px] text-slate-400">
                                  {formatDateTime(event.date)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {event.subtitle}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {selectedAdmission.reason && (
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Admission reason
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {selectedAdmission.reason}
                      </p>
                    </div>
                  )}

                  {selectedAdmission.dischargeSummary && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-slate-500" />
                        <p className="text-sm font-semibold text-slate-800">
                          Discharge summary
                        </p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {selectedAdmission.dischargeSummary}
                      </p>
                    </div>
                  )}

                  <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-sm text-slate-600">
                    <div className="flex items-start gap-2">
                      <ShieldCheck size={16} className="mt-0.5 shrink-0 text-teal-700" />
                      <p>
                        Hospital information is shown for this authenticated patient.
                        Clinical interpretation and verification remain separate steps.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedReport && (
                <div className="space-y-6 p-6">
                  <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-indigo-700">
                            {selectedReport.testCategory || "Laboratory"}
                          </p>
                          {selectedReport.digitallyReceived !== false && (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                              Digitally received
                            </span>
                          )}
                        </div>

                        <h4 className="mt-2 text-2xl font-semibold text-slate-900">
                          {selectedReport.testName}
                        </h4>
                        <p className="mt-1 text-sm text-slate-500">
                          {selectedReport.lab?.name || "Laboratory"}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass(
                          selectedReport.status
                        )}`}
                      >
                        {titleCase(selectedReport.status)}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white/80 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          Report number
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {selectedReport.reportNumber || "—"}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/80 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          Report date
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {formatDate(selectedReport.reportDate)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <LabPipeline
                    order={selectedReport.labOrder ? {
                      id: selectedReport.labOrder.id,
                      orderNumber: selectedReport.labOrder.orderNumber,
                      testName: selectedReport.testName,
                      testCategory: selectedReport.testCategory,
                      status: selectedReport.labOrder.status,
                      lab: selectedReport.lab,
                    } : null}
                    report={selectedReport}
                  />

                  <div className="rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center gap-2">
                      <FileText size={17} className="text-indigo-600" />
                      <h4 className="text-sm font-semibold text-slate-900">
                        Result summary
                      </h4>
                    </div>

                    <p className="mt-3 text-sm leading-7 text-slate-700">
                      {selectedReport.resultSummary ||
                        "No result summary was supplied."}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Lab order
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {selectedReport.labOrder?.orderNumber || "Linked order"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {titleCase(selectedReport.labOrder?.status)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Verification
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {selectedReport.medicalRecord?.verifiedAt
                          ? "Clinician verified"
                          : "Pending clinician verification"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                    <div className="flex items-start gap-2">
                      <UserCheck size={16} className="mt-0.5 shrink-0 text-amber-700" />
                      <div>
                        <p className="text-sm font-semibold text-amber-900">
                          Verification remains human-led
                        </p>
                        <p className="mt-1 text-xs leading-5 text-amber-800/80">
                          Digital receipt or automated ingestion does not make this
                          report a clinical conclusion.
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedReport.medicalRecord?.id && (
                    <button
                      type="button"
                      onClick={() => router.push("/records")}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Open linked Health Record
                    </button>
                  )}
                </div>
              )}
            </aside>
          </div>
        )}

      </section>
    </main>
  );
}
