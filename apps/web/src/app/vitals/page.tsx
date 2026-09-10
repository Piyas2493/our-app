"use client";

import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Droplets,
  FileText,
  HeartPulse,
  Link2,
  Mic,
  Pill,
  RefreshCw,
  LifeBuoy,
  ShieldCheck,
  Thermometer,
  Upload,
  User,
  UserCheck,
  Weight,
  Workflow,
  AlertCircle,
} from "lucide-react";

import Link from "next/link";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import LogoutButton from "@/components/LogoutButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";

/* =========================================================
   TYPES
   ========================================================= */

type VitalType =
  | "HEART_RATE"
  | "BLOOD_PRESSURE"
  | "OXYGEN_SATURATION"
  | "TEMPERATURE"
  | "WEIGHT"
  | "BLOOD_GLUCOSE"
  | "STEPS"
  | "SLEEP_DURATION";

type VitalSource =
  | "MANUAL"
  | "GOOGLE_HEALTH_CONNECT"
  | "SAMSUNG_HEALTH"
  | "WEARABLE"
  | "FITNESS_APP";

type VitalMeasurement = {
  id: string;

  patientId: string;

  vitalType: VitalType;

  value: number | null;

  secondaryValue: number | null;

  unit: string;

  recordedAt: string;

  source: VitalSource;

  deviceName: string | null;

  sourceRecordId: string | null;

  notes: string | null;

  createdAt: string;

  updatedAt: string;
};

type SessionUser = {
  id: string;

  name: string;

  email: string;

  role:
    | "PATIENT"
    | "CLINICIAN";
};

type VitalTrend = {
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

type HealthScoreComponent = {
  vitalType: VitalType;

  label: string;

  score: number;

  weight: number;

  reason: string;
};

type VitalHealthSummary = {
  healthScore: number;

  dataCoverageScore: number;

  measurementsCount: number;

  vitalTypesTracked: number;

  components: HealthScoreComponent[];

  trends: VitalTrend[];

  overallSummary: string;

  limitations: string[];
};

type AIReport = {
  title: string;

  overview: string;

  observedTrends: string[];

  whatChanged: string[];

  positiveSignals: string[];

  areasToMonitor: string[];

  dataGaps: string[];

  nextSteps: string[];

  safetyNote: string;
};

type Interpretation = {
  title: string;

  status:
    | "good"
    | "attention"
    | "neutral";

  summary: string;

  details: string;

  score: number;
};

/* =========================================================
   NAVIGATION
   ========================================================= */

const navItems = [
  {
    label: "Dashboard",
    icon: Activity,
    href: "/dashboard",
  },

  {
    label: "Health Records",
    icon: FileText,
    href: "/records",
  },

  {
    label: "Health Timeline",
    icon: Clock,
    href: "/health-timeline",
  },

  {
    label: "Prescriptions",
    icon: Pill,
    href: "/prescriptions",
  },

  {
    label: "AI Medical Scribe",
    icon: Bot,
  },

  {
    label: "Vitals",
    icon: HeartPulse,
    href: "/vitals",
    active: true,
  },

  {
    label: "Medication & Reminders",
    icon: Bell,
    href: "/medications",
  },

  {
    label: "Personalized Health",
    icon: BrainCircuit,
    href: "/personalized-health",
  },

  {
    label: "Hospitals & Labs",
    icon: Building2,
    href: "/hospitals-labs",
  },

  {
    label: "Voice Assistant",
    icon: Mic,
    href: "/voice-assistant",
  },

  {
    label: "Clinician Verification",
    icon: UserCheck,
  },

  {
    label: "FHIR / ABDM",
    icon: Workflow,
  },

  {
    label: "Consent & Privacy",
    icon: ShieldCheck,
    href: "/consent",
  },

  {
    label: "Help & Support",
    icon: LifeBuoy,
    href: "/support",
  },
];

/* =========================================================
   VITAL DEFINITIONS
   ========================================================= */

const vitalDefinitions: Array<{
  type: VitalType;

  label: string;

  shortLabel: string;

  unit: string;

  icon: typeof HeartPulse;
}> = [
  {
    type: "BLOOD_PRESSURE",
    label: "Blood Pressure",
    shortLabel: "Blood Pressure",
    unit: "mmHg",
    icon: HeartPulse,
  },

  {
    type: "HEART_RATE",
    label: "Heart Rate",
    shortLabel: "Heart Rate",
    unit: "bpm",
    icon: Activity,
  },

  {
    type: "OXYGEN_SATURATION",
    label: "Oxygen Saturation",
    shortLabel: "SpO₂",
    unit: "%",
    icon: Droplets,
  },

  {
    type: "TEMPERATURE",
    label: "Temperature",
    shortLabel: "Temperature",
    unit: "°F",
    icon: Thermometer,
  },

  {
    type: "WEIGHT",
    label: "Weight",
    shortLabel: "Weight",
    unit: "kg",
    icon: Weight,
  },

  {
    type: "BLOOD_GLUCOSE",
    label: "Blood Glucose",
    shortLabel: "Glucose",
    unit: "mg/dL",
    icon: Droplets,
  },
];

const vitalLabelKeys: Record<VitalType, string> = {
  BLOOD_PRESSURE: "vitals.type.bloodPressure",
  HEART_RATE: "vitals.type.heartRate",
  OXYGEN_SATURATION: "vitals.type.oxygenSaturation",
  TEMPERATURE: "vitals.type.temperature",
  WEIGHT: "vitals.type.weight",
  BLOOD_GLUCOSE: "vitals.type.bloodGlucose",
  STEPS: "vitals.type.steps",
  SLEEP_DURATION: "vitals.type.sleepDuration",
};

const navLabelKeys: Record<string, string> = {
  "Dashboard": "nav.dashboard",
  "Health Records": "nav.records",
  "Health Timeline": "nav.timeline",
  "Prescriptions": "nav.prescriptions",
  "AI Medical Scribe": "nav.aiScribe",
  "Vitals": "nav.vitals",
  "Medication & Reminders": "nav.medications",
  "Personalized Health": "nav.personalizedHealth",
  "Hospitals & Labs": "nav.hospitalsLabs",
  "Voice Assistant": "nav.voiceAssistant",
  "Clinician Verification": "nav.clinician",
  "FHIR / ABDM": "nav.fhir",
  "Consent & Privacy": "nav.consent",
  "Help & Support": "nav.support",
};

function getVitalLabel(type: VitalType, t: (key: string) => string) {
  return t(vitalLabelKeys[type] || "vitals.type.measurement");
}

/* =========================================================
   HELPERS
   ========================================================= */

function getVitalDefinition(
  type: VitalType
) {
  return vitalDefinitions.find(
    (item) =>
      item.type === type
  );
}

function getDefaultDateTime() {
  const now =
    new Date();

  now.setSeconds(
    0,
    0
  );

  return new Date(
    now.getTime() -
      now.getTimezoneOffset() *
        60000
  )
    .toISOString()
    .slice(
      0,
      16
    );
}

function formatVitalValue(
  vital: VitalMeasurement
) {
  if (
    vital.vitalType ===
    "BLOOD_PRESSURE"
  ) {
    return `${vital.value ?? "—"}/${vital.secondaryValue ?? "—"}`;
  }

  return vital.value ??
    "—";
}

function formatDateTime(
  value: string,
  unknownTimeLabel = "Unknown time"
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return unknownTimeLabel;
  }

  return date.toLocaleString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function formatSource(
  source: VitalSource,
  t: (key: string) => string
) {
  switch (source) {
    case "MANUAL":
      return t("vitals.source.manual");

    case "GOOGLE_HEALTH_CONNECT":
      return t("vitals.source.healthConnect");

    case "SAMSUNG_HEALTH":
      return t("vitals.source.samsungHealth");

    case "WEARABLE":
      return t("vitals.source.wearable");

    case "FITNESS_APP":
      return t("vitals.source.fitnessApp");

    default:
      return source;
  }
}

/* =========================================================
   RULE-BASED CURRENT INTERPRETATION
   ========================================================= */

function interpretVital(
  vital: VitalMeasurement,
  t: (key: string) => string
): Interpretation {
  const value = vital.value;
  const secondary = vital.secondaryValue;

  if (value === null || value === undefined) {
    return {
      title: t("vitals.interpretation.measurementUnavailable.title"),
      status: "neutral",
      summary: t("vitals.interpretation.measurementUnavailable.summary"),
      details: t("vitals.interpretation.measurementUnavailable.details"),
      score: 50,
    };
  }

  if (vital.vitalType === "BLOOD_PRESSURE") {
    const systolic = value;
    const diastolic = secondary ?? 0;
    const reading = `${systolic}/${diastolic} mmHg ${t("vitals.recorded").toLowerCase()}.`;
    if (systolic < 90 || diastolic < 60) return { title: t("vitals.interpretation.bp.low.title"), status: "attention", summary: reading, details: t("vitals.interpretation.bp.low.details"), score: 55 };
    if (systolic < 120 && diastolic < 80) return { title: t("vitals.interpretation.bp.typical.title"), status: "good", summary: reading, details: t("vitals.interpretation.bp.typical.details"), score: 92 };
    if (systolic < 130 && diastolic < 80) return { title: t("vitals.interpretation.bp.slight.title"), status: "attention", summary: reading, details: t("vitals.interpretation.bp.slight.details"), score: 82 };
    if (systolic < 140 && diastolic < 90) return { title: t("vitals.interpretation.bp.elevated.title"), status: "attention", summary: reading, details: t("vitals.interpretation.bp.elevated.details"), score: 68 };
    return { title: t("vitals.interpretation.bp.high.title"), status: "attention", summary: reading, details: t("vitals.interpretation.bp.high.details"), score: 50 };
  }

  if (vital.vitalType === "HEART_RATE") {
    const reading = `${value} bpm ${t("vitals.recorded").toLowerCase()}.`;
    if (value < 60) return { title: t("vitals.interpretation.hr.low.title"), status: "attention", summary: reading, details: t("vitals.interpretation.hr.low.details"), score: 72 };
    if (value <= 100) return { title: t("vitals.interpretation.hr.typical.title"), status: "good", summary: reading, details: t("vitals.interpretation.hr.typical.details"), score: 92 };
    return { title: t("vitals.interpretation.hr.high.title"), status: "attention", summary: reading, details: t("vitals.interpretation.hr.high.details"), score: 65 };
  }

  if (vital.vitalType === "OXYGEN_SATURATION") {
    const reading = `${value}% SpO₂ ${t("vitals.recorded").toLowerCase()}.`;
    if (value >= 95) return { title: t("vitals.interpretation.o2.reassuring.title"), status: "good", summary: reading, details: t("vitals.interpretation.o2.reassuring.details"), score: 95 };
    return { title: t("vitals.interpretation.o2.low.title"), status: "attention", summary: reading, details: t("vitals.interpretation.o2.low.details"), score: 60 };
  }

  if (vital.vitalType === "TEMPERATURE") {
    const reading = `${value}°F ${t("vitals.recorded").toLowerCase()}.`;
    if (value >= 97 && value <= 99.5) return { title: t("vitals.interpretation.temp.typical.title"), status: "good", summary: reading, details: t("vitals.interpretation.temp.typical.details"), score: 92 };
    if (value >= 100.4) return { title: t("vitals.interpretation.temp.high.title"), status: "attention", summary: reading, details: t("vitals.interpretation.temp.high.details"), score: 55 };
    return { title: t("vitals.interpretation.temp.outside.title"), status: "attention", summary: reading, details: t("vitals.interpretation.temp.outside.details"), score: 70 };
  }

  if (vital.vitalType === "WEIGHT") return { title: t("vitals.interpretation.weight.title"), status: "neutral", summary: `${value} kg ${t("vitals.recorded").toLowerCase()}.`, details: t("vitals.interpretation.weight.details"), score: 80 };
  if (vital.vitalType === "BLOOD_GLUCOSE") return { title: t("vitals.interpretation.glucose.title"), status: "neutral", summary: `${value} mg/dL ${t("vitals.recorded").toLowerCase()}.`, details: t("vitals.interpretation.glucose.details"), score: 75 };
  return { title: t("vitals.interpretation.generic.title"), status: "neutral", summary: `${value} ${vital.unit}`, details: t("vitals.interpretation.generic.details"), score: 80 };
}
/* =========================================================
   PAGE
   ========================================================= */

export default function VitalsPage() {
  const router =
    useRouter();
  const { t } = useLanguage();

  const [
    user,
    setUser,
  ] =
    useState<SessionUser | null>(
      null
    );

  const [
    vitals,
    setVitals,
  ] =
    useState<VitalMeasurement[]>(
      []
    );

  const [
    summary,
    setSummary,
  ] =
    useState<VitalHealthSummary | null>(
      null
    );

  const [
    aiReport,
    setAIReport,
  ] =
    useState<AIReport | null>(
      null
    );

  const [
    selectedType,
    setSelectedType,
  ] =
    useState<VitalType>(
      "BLOOD_PRESSURE"
    );

  const [
    primaryValue,
    setPrimaryValue,
  ] =
    useState("");

  const [
    secondaryValue,
    setSecondaryValue,
  ] =
    useState("");

  const [
    recordedAt,
    setRecordedAt,
  ] =
    useState(
      getDefaultDateTime()
    );

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    summaryLoading,
    setSummaryLoading,
  ] =
    useState(false);

  const [
    reportLoading,
    setReportLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    reportError,
    setReportError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");

  const [
    filter,
    setFilter,
  ] =
    useState<
      VitalType | "ALL"
    >("ALL");

  const [
    sourceFilter,
    setSourceFilter,
  ] =
    useState<
      VitalSource | "ALL"
    >("ALL");

  /* =========================================================
     LOAD VITALS
     ========================================================= */

  const loadVitals =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

          setError("");

          const sessionResponse =
            await fetch(
              "/api/auth/session",
              {
                method:
                  "GET",

                credentials:
                  "include",

                cache:
                  "no-store",
              }
            );

          const sessionResult =
            await sessionResponse
              .json()
              .catch(
                () =>
                  null
              );

          if (
            !sessionResponse.ok ||
            !sessionResult?.authenticated ||
            !sessionResult?.user
          ) {
            router.push(
              "/login"
            );

            return;
          }

          const currentUser =
            sessionResult.user as SessionUser;

          if (
            currentUser.role !==
            "PATIENT"
          ) {
            router.push(
              "/clinician"
            );

            return;
          }

          setUser(
            currentUser
          );

          const vitalsResponse =
            await fetch(
              "/api/vitals",
              {
                method:
                  "GET",

                credentials:
                  "include",

                cache:
                  "no-store",
              }
            );

          const result =
            await vitalsResponse
              .json()
              .catch(
                () =>
                  null
              );

          if (
            !vitalsResponse.ok ||
            !result?.success
          ) {
            throw new Error(
              result?.error ||
                "Unable to load vitals."
            );
          }

          setVitals(
            Array.isArray(
              result.vitals
            )
              ? result.vitals
              : []
          );
        } catch (err) {
          console.error(
            "Vitals loading failed:",
            err
          );

          setError(
            err instanceof Error
              ? err.message
              : "Unable to load vitals."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [router]
    );

  /* =========================================================
     LOAD SUMMARY
     ========================================================= */

  const loadSummary =
    useCallback(
      async () => {
        try {
          setSummaryLoading(
            true
          );

          const response =
            await fetch(
              "/api/vitals/summary",
              {
                method:
                  "GET",

                credentials:
                  "include",

                cache:
                  "no-store",
              }
            );

          const result =
            await response
              .json()
              .catch(
                () =>
                  null
              );

          if (
            !response.ok ||
            !result?.success
          ) {
            throw new Error(
              result?.error ||
                "Unable to calculate health summary."
            );
          }

          setSummary(
            result.summary
          );
        } catch (err) {
          console.error(
            "Summary loading failed:",
            err
          );
        } finally {
          setSummaryLoading(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    void loadVitals();
  }, [loadVitals]);

  useEffect(() => {
    if (!loading) {
      void loadSummary();
    }
  }, [
    loading,
    loadSummary,
    vitals.length,
  ]);

  /* =========================================================
     SELECTED DEFINITION
     ========================================================= */

  const selectedDefinition =
    useMemo(
      () =>
        getVitalDefinition(
          selectedType
        ),
      [selectedType]
    );

  /* =========================================================
     LATEST BY TYPE
     ========================================================= */

  const latestByType =
    useMemo(() => {
      const map =
        new Map<
          VitalType,
          VitalMeasurement
        >();

      for (
        const vital of vitals
      ) {
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

      return map;
    }, [vitals]);

  /* =========================================================
     FILTERED HISTORY
     ========================================================= */

  const filteredVitals =
    useMemo(
      () =>
        vitals.filter(
          (vital) =>
            (
              filter ===
                "ALL" ||
              vital.vitalType ===
                filter
            ) &&
            (
              sourceFilter ===
                "ALL" ||
              vital.source ===
                sourceFilter
            )
        ),
      [
        vitals,
        filter,
        sourceFilter,
      ]
    );

  /* =========================================================
     TODAY
     ========================================================= */

  const todayCount =
    useMemo(() => {
      const today =
        new Date();

      return vitals.filter(
        (vital) => {
          const date =
            new Date(
              vital.recordedAt
            );

          return (
            date.getFullYear() ===
              today.getFullYear() &&
            date.getMonth() ===
              today.getMonth() &&
            date.getDate() ===
              today.getDate()
          );
        }
      ).length;
    }, [vitals]);

  /* =========================================================
     MANUAL COUNT
     ========================================================= */

  const manualCount =
    useMemo(
      () =>
        vitals.filter(
          (vital) =>
            vital.source ===
            "MANUAL"
        ).length,
      [vitals]
    );

  /* =========================================================
     CURRENT INTERPRETATION
     ========================================================= */

  const latestInterpretation =
    useMemo(() => {
      const latest =
        vitals[0];

      return latest
        ? {
            vital:
              latest,

            result:
              interpretVital(
                latest,
                t
              ),
          }
        : null;
    }, [vitals, t]);

  /* =========================================================
     MANUAL SUBMIT
     ========================================================= */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(
      true
    );

    setError("");

    setSuccess("");

    try {
      const primary =
        Number(
          primaryValue
        );

      if (
        !Number.isFinite(
          primary
        )
      ) {
        throw new Error(
          t("vitals.errors.invalidMeasurement")
        );
      }

      const payload: {
        vitalType: VitalType;

        value: number;

        secondaryValue?: number;

        unit: string;

        recordedAt: string;

        source: VitalSource;

        notes?: string;
      } = {
        vitalType:
          selectedType,

        value:
          primary,

        unit:
          selectedDefinition?.unit ||
          "",

        recordedAt:
          new Date(
            recordedAt
          ).toISOString(),

        source:
          "MANUAL",
      };

      if (
        selectedType ===
        "BLOOD_PRESSURE"
      ) {
        const secondary =
          Number(
            secondaryValue
          );

        if (
          !Number.isFinite(
            secondary
          )
        ) {
          throw new Error(
            t("vitals.errors.invalidDiastolic")
          );
        }

        payload.secondaryValue =
          secondary;
      }

      if (
        notes.trim()
      ) {
        payload.notes =
          notes.trim();
      }

      const response =
        await fetch(
          "/api/vitals",
          {
            method:
              "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const result =
        await response
          .json()
          .catch(
            () =>
              null
          );

      if (
        !response.ok ||
        !result?.success
      ) {
        throw new Error(
          result?.error ||
            "Unable to save vital."
        );
      }

      setSuccess(
        t("vitals.success.saved")
      );

      setPrimaryValue("");

      setSecondaryValue("");

      setNotes("");

      await loadVitals();

      await loadSummary();
    } catch (err) {
      console.error(
        "Saving vital failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save vital."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =========================================================
     GENERATE AI REPORT
     ========================================================= */

  async function generateAIReport() {
    try {
      setReportLoading(
        true
      );

      setReportError(
        ""
      );

      const response =
        await fetch(
          "/api/vitals/ai-report",
          {
            method:
              "POST",

            credentials:
              "include",

            headers: {
              "Accept-Language":
                document.documentElement.lang || "en",
            },
          }
        );

      const result =
        await response
          .json()
          .catch(
            () =>
              null
          );

      if (
        !response.ok ||
        !result?.success
      ) {
        throw new Error(
          result?.error ||
            "Unable to generate AI report."
        );
      }

      setAIReport(
        result.report
      );

      setSummary(
        result.summary
      );
    } catch (err) {
      console.error(
        "AI report failed:",
        err
      );

      setReportError(
        err instanceof Error
          ? err.message
          : "Unable to generate AI report."
      );
    } finally {
      setReportLoading(
        false
      );
    }
  }

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <main className="app-shell">

        <div className="flex min-h-screen items-center justify-center">

          <div className="flex items-center gap-3 text-slate-500">

            <RefreshCw
              size={20}
              className="animate-spin"
            />

            {t("vitals.loading")}

          </div>

        </div>

      </main>
    );
  }

  return (
    <main className="app-shell">

      {/* ===================================================
          SIDEBAR
          =================================================== */}

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-icon">

            <Link2
              size={30}
            />

          </div>

          <div>

            <h1>
              JeevanLink
            </h1>

            <p>
              {t("app.tagline")}
            </p>

          </div>

        </div>

        <div className="sidebar-label">
          {t("app.continuityCentre")}
        </div>

        <nav className="nav-menu">

          {navItems.map(
            (item) => {
              const Icon =
                item.icon;

              return (
                <button
                  key={
                    item.label
                  }
                  type="button"
                  onClick={() => {
                    if (
                      item.href
                    ) {
                      router.push(
                        item.href
                      );
                    }
                  }}
                  disabled={
                    !item.href
                  }
                  className={`nav-item ${
                    item.active
                      ? "active"
                      : ""
                  } ${
                    !item.href
                      ? "cursor-default opacity-60"
                      : ""
                  }`}
                >

                  <Icon
                    size={21}
                    strokeWidth={
                      1.8
                    }
                  />

                  <span>
                    {t(navLabelKeys[item.label] || item.label)}
                  </span>

                </button>
              );
            }
          )}

        </nav>

        <div className="sidebar-bottom">

          <div className="workspace-card">

            <ShieldCheck
              size={28}
            />

            <div>

              <strong>
                {t("vitals.patientControlledData")}
              </strong>

              <p>
                {t("vitals.patientControlledDescription")}
              </p>

            </div>

          </div>

        </div>

      </aside>

      {/* ===================================================
          MAIN
          =================================================== */}

      <section className="main-content">

        <header className="topbar">

          <div className="breadcrumb">

            <span className="menu-lines">
              ☰
            </span>

            <Link href="/dashboard">
              JeevanLink
            </Link>

            <span className="chevron">
              ›
            </span>

            <strong>
              {t("nav.vitals")}
            </strong>

          </div>

          <div className="top-actions">

            <LanguageSwitcher />

            <button
              type="button"
              className="circle-button voice-top"
            >

              <Mic
                size={20}
              />

            </button>

            <button
              type="button"
              className="notification-button"
              onClick={() =>
                router.push(
                  "/records"
                )
              }
            >

              <Bell
                size={20}
              />

            </button>

            <div className="profile">

              <div className="avatar">

                {user?.name
                  ? user.name
                      .charAt(
                        0
                      )
                      .toUpperCase()
                  : "P"}

              </div>

              <span>
                {
                  user?.name ||
                  "Patient"
                }
              </span>

              <ChevronDown
                size={16}
              />

            </div>

            <LogoutButton />

          </div>

        </header>

        <div className="dashboard">

          {/* =================================================
              HEADER
              ================================================= */}

          <section className="hero !min-h-0">

            <div className="hero-content">

              <div className="eyebrow">

                <span />

                {t("vitals.eyebrow")}

              </div>

              <h2>

                {t("vitals.heroLine1")}

                <br />

                <span>
                  {t("vitals.heroLine2")}
                </span>

              </h2>

              <p>
                JeevanLink combines manually entered measurements
                with future connected-health data, then turns the
                available measurements into trends, an explainable
                wellness signal, and an AI-generated health summary.
              </p>

              <div className="hero-features">

                <span>

                  <User
                    size={18}
                  />

                  {t("vitals.feature.patientControlled")}

                </span>

                <span>

                  <ShieldCheck
                    size={18}
                  />

                  {t("vitals.feature.sourceAware")}

                </span>

                <span>

                  <BrainCircuit
                    size={18}
                  />

                  {t("vitals.feature.aiAssisted")}

                </span>

              </div>

            </div>

          </section>

          {/* =================================================
              STATS
              ================================================= */}

          <section className="stats-area">

            <StatCard
              icon={
                <Activity />
              }
              title={t("vitals.stats.totalReadings")}
              value={String(
                vitals.length
              )}
              text={t("vitals.stats.totalReadingsDescription")}
              variant="purple"
            />

            <StatCard
              icon={
                <Clock />
              }
              title={t("vitals.stats.today")}
              value={String(
                todayCount
              )}
              text={t("vitals.stats.todayDescription")}
              variant="green"
            />

            <StatCard
              icon={
                <User />
              }
              title={t("vitals.stats.manual")}
              value={String(
                manualCount
              )}
              text={t("vitals.stats.manualDescription")}
              variant="orange"
            />

            <StatCard
              icon={
                <BrainCircuit />
              }
              title={t("vitals.stats.healthScore")}
              value={
                summary
                  ? `${summary.healthScore}`
                  : "—"
              }
              text={
                summary
                  ? t("vitals.stats.scoreDescription")
                  : t("vitals.stats.addReadings")
              }
              variant="blue"
            />

          </section>

          {/* =================================================
              LATEST INTERPRETATION
              ================================================= */}

          <section className="bottom-grid">

            <div className="bottom-card">

              <div className="mb-5 flex items-start justify-between gap-4">

                <div>

                  <h3>
                    {t("vitals.latestInterpretation.title")}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {t("vitals.latestInterpretation.description")}
                  </p>

                </div>

                <BrainCircuit
                  size={22}
                />

              </div>

              {latestInterpretation ? (

                <div
                  className={`rounded-2xl border p-5 ${
                    latestInterpretation.result.status ===
                    "good"
                      ? "border-emerald-200 bg-emerald-50"
                      : latestInterpretation.result.status ===
                        "attention"
                      ? "border-amber-200 bg-amber-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >

                  <div className="flex items-start gap-3">

                    {latestInterpretation.result.status ===
                    "good" ? (
                      <CheckCircle2
                        size={20}
                        className="mt-0.5 shrink-0"
                      />
                    ) : latestInterpretation.result.status ===
                      "attention" ? (
                      <AlertCircle
                        size={20}
                        className="mt-0.5 shrink-0"
                      />
                    ) : (
                      <Activity
                        size={20}
                        className="mt-0.5 shrink-0"
                      />
                    )}

                    <div>

                      <h4 className="font-semibold text-slate-800">
                        {
                          latestInterpretation.result.title
                        }
                      </h4>

                      <p className="mt-2 text-sm font-medium text-slate-700">
                        {
                          latestInterpretation.result.summary
                        }
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {
                          latestInterpretation.result.details
                        }
                      </p>

                      <p className="mt-3 text-xs text-slate-500">

                        {t("vitals.recorded")}{" "}

                        {
                          formatDateTime(
                            latestInterpretation.vital.recordedAt,
                            t("vitals.unknownTime")
                          )
                        }

                        {" · "}

                        {t("vitals.sourceLabel")}{" "}

                        {
                          formatSource(
                            latestInterpretation.vital.source,
                            t
                          )
                        }

                      </p>

                    </div>

                  </div>

                </div>

              ) : (

                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">

                  <BrainCircuit
                    size={36}
                    className="mx-auto mb-3 text-slate-300"
                  />

                  <h4 className="text-sm font-semibold text-slate-700">
                    {t("vitals.latestInterpretation.noneTitle")}
                  </h4>

                  <p className="mt-1 text-sm text-slate-500">
                    {t("vitals.latestInterpretation.noneDescription")}
                  </p>

                </div>

              )}

            </div>

            {/* SCORE */}

            <div className="score-card">

              <p>
                {t("vitals.healthScore.title")}
              </p>

              <div className="score">

                {summary
                  ? summary.healthScore
                  : "—"}

                {summary && (
                  <span>
                    /100
                  </span>
                )}

              </div>

              <div className="ai-tag">
                {t("vitals.healthScore.badge")}
              </div>

              <span className="score-description">
                {t("vitals.healthScore.description")}
              </span>

              {summary &&
                summary.components.length >
                  0 && (

                  <div className="mt-5 space-y-2">

                    {summary.components
                      .slice(
                        0,
                        5
                      )
                      .map(
                        (
                          component
                        ) => (

                          <div
                            key={
                              component.vitalType
                            }
                            className="flex items-center justify-between text-xs"
                          >

                            <span className="text-slate-500">
                              {
                                component.label
                              }
                            </span>

                            <strong className="text-slate-700">
                              {
                                component.score
                              }
                              /100
                            </strong>

                          </div>

                        )
                      )}

                  </div>

                )}

              <div className="trend-line">

                <span />
                <span />
                <span />
                <span />
                <span />

              </div>

            </div>

          </section>

          {/* =================================================
              TRENDS
              ================================================= */}

          <section className="bottom-card">

            <div className="mb-5 flex items-start justify-between gap-4">

              <div>

                <h3>
                  {t("vitals.trends.title")}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {t("vitals.trends.description")}
                </p>

              </div>

              <BarChart3
                size={22}
              />

            </div>

            {summaryLoading ? (

              <div className="flex items-center gap-2 py-8 text-sm text-slate-500">

                <RefreshCw
                  size={17}
                  className="animate-spin"
                />

                {t("vitals.trends.calculating")}

              </div>

            ) : summary &&
              summary.trends.length >
                0 ? (

              <div className="grid gap-3 md:grid-cols-2">

                {summary.trends.map(
                  (
                    trend
                  ) => (

                    <div
                      key={
                        trend.vitalType
                      }
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                    >

                      <div className="flex items-center justify-between gap-3">

                        <strong className="text-sm text-slate-800">
                          {
                            trend.label
                          }
                        </strong>

                        <span className="text-xs font-semibold text-slate-500">

                          {
                            trend.direction ===
                            "UP"
                              ? t("vitals.trends.increasing")
                              : trend.direction ===
                                "DOWN"
                              ? t("vitals.trends.decreasing")
                              : trend.direction ===
                                "STABLE"
                              ? t("vitals.trends.stable")
                              : t("vitals.trends.moreData")
                          }

                        </span>

                      </div>

                      <div className="mt-3 flex items-end justify-between gap-3">

                        <div>

                          <span className="block text-xs text-slate-400">
                            Latest
                          </span>

                          <strong className="text-xl text-slate-900">

                            {
                              trend.vitalType ===
                              "BLOOD_PRESSURE"
                                ? `${trend.latestValue ?? "—"}/${trend.latestSecondaryValue ?? "—"}`
                                : trend.latestValue ??
                                  "—"
                            }

                          </strong>

                          <span className="ml-1 text-xs text-slate-400">
                            {
                              trend.unit
                            }
                          </span>

                        </div>

                        <div className="text-right">

                          {trend.changePercent !==
                            null && (

                            <strong className="text-sm text-slate-700">

                              {
                                trend.changePercent >
                                0
                                  ? "+"
                                  : ""
                              }

                              {
                                trend.changePercent
                              }%

                            </strong>

                          )}

                          <span className="block text-xs text-slate-400">
                            {
                              trend.count
                            }{" "}
                            reading
                            {
                              trend.count ===
                              1
                                ? ""
                                : "s"
                            }
                          </span>

                        </div>

                      </div>

                    </div>

                  )
                )}

              </div>

            ) : (

              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">

                <BarChart3
                  size={36}
                  className="mx-auto mb-3 text-slate-300"
                />

                <h4 className="text-sm font-semibold text-slate-700">
                  {t("vitals.trends.noneTitle")}
                </h4>

                <p className="mt-1 text-sm text-slate-500">
                  Repeated measurements will allow JeevanLink to identify changes {t("vitals.heroLine2")}
                </p>

              </div>

            )}

          </section>

          {/* =================================================
              MANUAL ENTRY + CONNECTED SOURCES
              ================================================= */}

          <section className="bottom-grid">

            {/* MANUAL ENTRY */}

            <div className="bottom-card">

              <div className="mb-5">

                <h3>
                  {t("vitals.manual.title")}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {t("vitals.manual.description")}
                </p>

              </div>

              {error && (

                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>

              )}

              {success && (

                <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">

                  <CheckCircle2
                    size={17}
                  />

                  {success}

                </div>

              )}

              <form
                onSubmit={
                  handleSubmit
                }
                className="space-y-4"
              >

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t("vitals.manual.vitalType")}
                  </label>

                  <select
                    value={
                      selectedType
                    }
                    onChange={(event) => {
                      setSelectedType(
                        event.target.value as VitalType
                      );

                      setPrimaryValue(
                        ""
                      );

                      setSecondaryValue(
                        ""
                      );
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                  >

                    {vitalDefinitions.map(
                      (
                        definition
                      ) => (

                        <option
                          key={
                            definition.type
                          }
                          value={
                            definition.type
                          }
                        >
                          {
                            definition.label
                          }
                        </option>

                      )
                    )}

                  </select>

                </div>

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {
                      selectedDefinition?.label
                    }
                  </label>

                  <div className="space-y-3">

                    <div className="relative">

                      <input
                        type="number"
                        value={
                          primaryValue
                        }
                        onChange={(
                          event
                        ) =>
                          setPrimaryValue(
                            event.target.value
                          )
                        }
                        placeholder={
                          selectedType ===
                          "BLOOD_PRESSURE"
                            ? t("vitals.manual.systolic")
                            : t("vitals.manual.enterValue")
                        }
                        step="any"
                        inputMode="decimal"
                        required
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-20 text-sm outline-none focus:border-teal-500"
                      />

                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                        {selectedType ===
                        "BLOOD_PRESSURE"
                          ? "SYS"
                          : selectedDefinition?.unit}
                      </span>

                    </div>

                    {selectedType ===
                      "BLOOD_PRESSURE" && (

                      <div className="relative">

                        <input
                          type="number"
                          value={
                            secondaryValue
                          }
                          onChange={(
                            event
                          ) =>
                            setSecondaryValue(
                              event.target.value
                            )
                          }
                          placeholder={t("vitals.manual.diastolic")}
                          step="any"
                          inputMode="decimal"
                          required
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-20 text-sm outline-none focus:border-teal-500"
                        />

                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                          DIA
                        </span>

                      </div>

                    )}

                  </div>

                </div>

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    {t("vitals.manual.recordedAt")}
                  </label>

                  <input
                    type="datetime-local"
                    value={
                      recordedAt
                    }
                    onChange={(
                      event
                    ) =>
                      setRecordedAt(
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                  />

                </div>

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Note{" "}
                    <span className="font-normal text-slate-400">
                      {t("vitals.manual.optional")}
                    </span>
                  </label>

                  <textarea
                    value={
                      notes
                    }
                    onChange={(
                      event
                    ) =>
                      setNotes(
                        event.target.value
                      )
                    }
                    rows={3}
                    placeholder={t("vitals.manual.notePlaceholder")}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                  />

                </div>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="primary-button w-full justify-center disabled:opacity-50"
                >

                  {saving ? (
                    <>
                      <RefreshCw
                        size={17}
                        className="animate-spin"
                      />

                      {t("vitals.manual.saving")}

                    </>
                  ) : (
                    <>
                      <Upload
                        size={17}
                      />

                      {t("vitals.manual.save")}

                    </>
                  )}

                </button>

              </form>

            </div>

            {/* SOURCES */}

            <div className="bottom-card">

              <div className="mb-5 flex items-start justify-between gap-4">

                <div>

                  <h3>
                    {t("vitals.sources.title")}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {t("vitals.sources.description")}
                  </p>

                </div>

                <ShieldCheck
                  size={22}
                />

              </div>

              <div className="space-y-3">

                <SourceCard
                  name={t("vitals.sources.healthConnect")}
                  description={t("vitals.sources.healthConnectDescription")}
                  source="GOOGLE_HEALTH_CONNECT"
                  vitals={vitals}
                  dataFoundLabel={t("vitals.sources.dataFound")}
                  notConnectedLabel={t("vitals.sources.notConnected")}
                />

                <SourceCard
                  name={t("vitals.sources.samsungHealth")}
                  description={t("vitals.sources.samsungHealthDescription")}
                  source="SAMSUNG_HEALTH"
                  vitals={vitals}
                  dataFoundLabel={t("vitals.sources.dataFound")}
                  notConnectedLabel={t("vitals.sources.notConnected")}
                />

                <SourceCard
                  name={t("vitals.sources.wearables")}
                  description={t("vitals.sources.wearablesDescription")}
                  source="WEARABLE"
                  vitals={vitals}
                  dataFoundLabel={t("vitals.sources.dataFound")}
                  notConnectedLabel={t("vitals.sources.notConnected")}
                />

              </div>

              <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">

                <p className="text-xs leading-5 text-slate-500">
                  {t("vitals.sources.futureNote")}
                </p>

              </div>

            </div>

          </section>

          {/* =================================================
              AI REPORT
              ================================================= */}

          <section className="bottom-card">

            <div className="flex flex-wrap items-start justify-between gap-4">

              <div>

                <div className="flex items-center gap-2">

                  <Bot
                    size={22}
                  />

                  <h3>
                    {t("vitals.ai.title")}
                  </h3>

                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {t("vitals.ai.description")}
                </p>

              </div>

              <button
                type="button"
                onClick={
                  generateAIReport
                }
                disabled={
                  reportLoading ||
                  vitals.length ===
                    0
                }
                className="primary-button disabled:cursor-not-allowed disabled:opacity-50"
              >

                {reportLoading ? (
                  <>
                    <RefreshCw
                      size={17}
                      className="animate-spin"
                    />

                    {t("vitals.ai.generating")}

                  </>
                ) : (
                  <>
                    <BrainCircuit
                      size={17}
                    />

                    {t("vitals.ai.generate")}

                  </>
                )}

              </button>

            </div>

            {reportError && (

              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {
                  reportError
                }
              </div>

            )}

            {!aiReport && !reportLoading ? (

              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">

                <Bot
                  size={40}
                  className="mx-auto mb-3 text-slate-300"
                />

                <h4 className="text-sm font-semibold text-slate-700">
                  {t("vitals.ai.noneTitle")}
                </h4>

                <p className="mt-1 text-sm text-slate-500">
                  {t("vitals.ai.noneDescription")}
                </p>

              </div>

            ) : aiReport ? (

              <div className="mt-6 space-y-5">

                <div className="rounded-2xl bg-slate-50 p-5">

                  <h4 className="text-base font-semibold text-slate-800">
                    {
                      aiReport.title
                    }
                  </h4>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {
                      aiReport.overview
                    }
                  </p>

                </div>

                <AIReportSection
                  title={t("vitals.ai.observedTrends")}
                  items={
                    aiReport.observedTrends
                  }
                />

                <AIReportSection
                  title={t("vitals.ai.whatChanged")}
                  items={
                    aiReport.whatChanged
                  }
                />

                <AIReportSection
                  title={t("vitals.ai.positiveSignals")}
                  items={
                    aiReport.positiveSignals
                  }
                />

                <AIReportSection
                  title={t("vitals.ai.areasToMonitor")}
                  items={
                    aiReport.areasToMonitor
                  }
                />

                <AIReportSection
                  title={t("vitals.ai.dataGaps")}
                  items={
                    aiReport.dataGaps
                  }
                />

                <AIReportSection
                  title={t("vitals.ai.nextSteps")}
                  items={
                    aiReport.nextSteps
                  }
                />

                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-4">

                  <strong className="text-xs uppercase tracking-wide text-amber-800">
                    {t("vitals.ai.important")}
                  </strong>

                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    {
                      aiReport.safetyNote
                    }
                  </p>

                </div>

              </div>

            ) : null}

          </section>

          {/* =================================================
              HISTORY
              ================================================= */}

          <section className="bottom-card">

            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">

              <div>

                <h3>
                  {t("vitals.history.title")}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {t("vitals.history.description")}
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  void loadVitals();
                  void loadSummary();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
              >

                <RefreshCw
                  size={15}
                />

                Refresh

              </button>

            </div>

            <div className="mb-4 flex flex-wrap gap-2">

              <FilterButton
                active={
                  filter ===
                  "ALL"
                }
                onClick={() =>
                  setFilter(
                    "ALL"
                  )
                }
              >
                All
              </FilterButton>

              {vitalDefinitions.map(
                (
                  definition
                ) => (

                  <FilterButton
                    key={
                      definition.type
                    }
                    active={
                      filter ===
                      definition.type
                    }
                    onClick={() =>
                      setFilter(
                        definition.type
                      )
                    }
                  >
                    {
                      definition.shortLabel
                    }
                  </FilterButton>

                )
              )}

            </div>

            <div className="mb-5 flex flex-wrap gap-2">

              <FilterButton
                active={
                  sourceFilter ===
                  "ALL"
                }
                onClick={() =>
                  setSourceFilter(
                    "ALL"
                  )
                }
              >
                {t("vitals.filters.allSources")}
              </FilterButton>

              <FilterButton
                active={
                  sourceFilter ===
                  "MANUAL"
                }
                onClick={() =>
                  setSourceFilter(
                    "MANUAL"
                  )
                }
              >
                {t("vitals.source.manual")}
              </FilterButton>

              <FilterButton
                active={
                  sourceFilter ===
                  "GOOGLE_HEALTH_CONNECT"
                }
                onClick={() =>
                  setSourceFilter(
                    "GOOGLE_HEALTH_CONNECT"
                  )
                }
              >
                {t("vitals.source.healthConnect")}
              </FilterButton>

              <FilterButton
                active={
                  sourceFilter ===
                  "SAMSUNG_HEALTH"
                }
                onClick={() =>
                  setSourceFilter(
                    "SAMSUNG_HEALTH"
                  )
                }
              >
                {t("vitals.source.samsungShort")}
              </FilterButton>

              <FilterButton
                active={
                  sourceFilter ===
                  "WEARABLE"
                }
                onClick={() =>
                  setSourceFilter(
                    "WEARABLE"
                  )
                }
              >
                {t("vitals.source.wearable")}
              </FilterButton>

            </div>

            {filteredVitals.length ===
            0 ? (

              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">

                <HeartPulse
                  size={40}
                  className="mx-auto mb-3 text-slate-300"
                />

                <h4 className="text-sm font-semibold text-slate-700">
                  {t("vitals.history.noneTitle")}
                </h4>

                <p className="mt-1 text-sm text-slate-500">
                  {t("vitals.history.noneDescription")}
                </p>

              </div>

            ) : (

              <div className="space-y-3">

                {filteredVitals.map(
                  (
                    vital
                  ) => {

                    const definition =
                      getVitalDefinition(
                        vital.vitalType
                      );

                    const Icon =
                      definition?.icon ||
                      Activity;

                    const itemInterpretation =
                      interpretVital(
                        vital,
                        t
                      );

                    return (
                      <div
                        key={
                          vital.id
                        }
                        className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm"
                      >

                        <div className="flex flex-wrap items-center gap-4">

                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50">

                            <Icon
                              size={21}
                            />

                          </div>

                          <div className="min-w-[180px] flex-1">

                            <div className="flex flex-wrap items-center gap-2">

                              <strong className="text-sm text-slate-800">
                                {
                                  getVitalLabel(
                                    vital.vitalType,
                                    t
                                  )
                                }
                              </strong>

                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                {
                                  formatSource(
                                    vital.source,
                                    t
                                  )
                                }
                              </span>

                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              {
                                formatDateTime(
                                  vital.recordedAt,
                                  t("vitals.unknownTime")
                                )
                              }
                            </p>

                            {vital.deviceName && (

                              <p className="mt-1 text-xs text-slate-400">
                                Device:{" "}
                                {
                                  vital.deviceName
                                }
                              </p>

                            )}

                            {vital.notes && (

                              <p className="mt-2 text-xs text-slate-500">
                                {
                                  vital.notes
                                }
                              </p>

                            )}

                          </div>

                          <div className="text-right">

                            <strong className="block text-lg text-slate-900">
                              {
                                formatVitalValue(
                                  vital
                                )
                              }
                            </strong>

                            <span className="text-xs text-slate-400">
                              {
                                vital.unit
                              }
                            </span>

                          </div>

                        </div>

                        <div className="mt-3 border-t border-slate-100 pt-3">

                          <div className="flex items-start gap-2">

                            {itemInterpretation.status ===
                            "good" ? (
                              <CheckCircle2
                                size={16}
                              />
                            ) : itemInterpretation.status ===
                              "attention" ? (
                              <AlertCircle
                                size={16}
                              />
                            ) : (
                              <BrainCircuit
                                size={16}
                              />
                            )}

                            <div>

                              <strong className="text-xs text-slate-700">
                                {
                                  itemInterpretation.title
                                }
                              </strong>

                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {
                                  itemInterpretation.summary
                                }
                              </p>

                            </div>

                          </div>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>

            )}

          </section>

          {/* =================================================
              DATA NOTICE
              ================================================= */}

          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800">

            <div className="flex items-start gap-3">

              <ShieldCheck
                size={20}
                className="mt-0.5 shrink-0"
              />

              <div>

                <strong>
                  {t("vitals.notice.title")}
                </strong>

                <p className="mt-1 leading-6">
                  {t("vitals.notice.description")}
                </p>

              </div>

            </div>

          </div>

        </div>

      </section>

    </main>
  );
}

/* ===========================================================
   AI REPORT SECTION
   =========================================================== */

function AIReportSection({
  title,
  items,
}: {
  title: string;

  items: string[];
}) {
  if (
    items.length ===
    0
  ) {
    return null;
  }

  return (
    <div>

      <h4 className="mb-2 text-sm font-semibold text-slate-800">
        {title}
      </h4>

      <div className="space-y-2">

        {items.map(
          (item) => (

            <div
              key={
                item
              }
              className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm leading-6 text-slate-600"
            >
              {item}
            </div>

          )
        )}

      </div>

    </div>
  );
}

/* ===========================================================
   FILTER BUTTON
   =========================================================== */

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;

  onClick: () => void;

  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
        active
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

/* ===========================================================
   SOURCE CARD
   =========================================================== */

function SourceCard({
  name,
  description,
  source,
  vitals,
  dataFoundLabel,
  notConnectedLabel,
}: {
  name: string;

  description: string;

  source: VitalSource;

  vitals: VitalMeasurement[];

  dataFoundLabel: string;

  notConnectedLabel: string;
}) {
  const hasData =
    vitals.some(
      (vital) =>
        vital.source ===
        source
    );

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">

      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">

        <Activity
          size={20}
        />

      </div>

      <div className="min-w-0 flex-1">

        <strong className="block text-sm text-slate-800">
          {name}
        </strong>

        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>

      </div>

      <span
        className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
          hasData
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-200 text-slate-500"
        }`}
      >
        {hasData
          ? dataFoundLabel
          : notConnectedLabel}
      </span>

    </div>
  );
}

/* ===========================================================
   STAT CARD
   =========================================================== */

function StatCard({
  icon,
  title,
  value,
  text,
  variant,
}: {
  icon: React.ReactNode;

  title: string;

  value: string;

  text: string;

  variant: string;
}) {
  return (
    <div className="stat-card">

      <div
        className={`stat-icon ${variant}`}
      >
        {icon}
      </div>

      <div>

        <h4>
          {title}
        </h4>

        <strong>
          {value}
        </strong>

        <p>
          {text}
        </p>

      </div>

    </div>
  );
}