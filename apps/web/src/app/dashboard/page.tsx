"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  Bell,
  Bot,
  BrainCircuit,
  Building2,
  FileText,
  ClipboardList,
  HeartPulse,
  LifeBuoy,
  Link2,
  LogOut,
  Mic,
  Pill,
  ShieldCheck,
  Upload,
  UserCheck,
  Workflow,
  Clock,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
} from "lucide-react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";

type MedicalRecord = {
  id: string;

  patientName?: string;

  documentName?: string;

  documentType?: string;

  interpretation?: string | null;

  status?: string;

  clinicianDecision?: string;

  createdAt?: string;

  submittedAt?: string;

  verifiedAt?: string | null;

  rejectionReason?: string | null;

  medications?: Array<{
    name?: string;
    dosage?: string | null;
    frequency?: string | null;
    duration?: string | null;
  }>;
};

type MedicationLog = {
  id: string;

  scheduledAt: string;

  actionAt?: string | null;

  status:
    | "TAKEN"
    | "SKIPPED"
    | "SNOOZED";

  snoozedUntil?: string | null;
};

type MedicationReminder = {
  id: string;

  hour: number;

  minute: number;

  status:
    | "ACTIVE"
    | "DISABLED";

  logs: MedicationLog[];
};

type Medication = {
  id: string;

  name: string;

  dosage?: string | null;

  reminders: MedicationReminder[];
};

type SessionUser = {
  id: string;

  name: string;

  email: string;

  role:
    | "PATIENT"
    | "CLINICIAN";
};

type DashboardStats = {
  totalRecords: number;

  verifiedRecords: number;

  pendingRecords: number;

  attentionRecords: number;

  medicationCount: number;

  activeReminderCount: number;

  takenTodayCount: number;

  skippedTodayCount: number;

  snoozedTodayCount: number;

  pendingDoseCount: number;
};

type ActivityItem = {
  id: string;

  titleKey: string;

  description: string;

  date: string;

  type:
    | "verified"
    | "pending"
    | "attention";
};

/* =========================================================
   STATUS
   ========================================================= */

function getRecordStatus(
  record: MedicalRecord
) {
  const status = String(
    record.status ||
      record.clinicianDecision ||
      "PENDING"
  )
    .trim()
    .toLowerCase();

  if (
    status === "verified" ||
    status === "approved"
  ) {
    return "verified" as const;
  }

  if (
    status === "rejected" ||
    status === "needs correction" ||
    status === "needs_correction"
  ) {
    return "attention" as const;
  }

  return "pending" as const;
}

/* =========================================================
   DATE
   ========================================================= */

function formatDate(
  value?: string | null,
  recentlyLabel = "Recently"
) {
  if (!value) {
    return recentlyLabel;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return recentlyLabel;
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
    }
  );
}

/* =========================================================
   NAVIGATION
   ========================================================= */

const navItems = [
  {
    label: "Dashboard",
    icon: Activity,
    active: true,
    href: "/dashboard",
  },

  {
    label: "Clinical Intake",
    icon: ClipboardList,
    href: "/clinical-intake",
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
    label: "Vitals",
    icon: HeartPulse,
     href: "/vitals",
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

function getNavLabel(
  label: string,
  t: (key: string) => string
) {
  const labels: Record<string, string> = {
    "Dashboard": t("nav.dashboard"),
    "Clinical Intake": t("nav.clinicalIntake"),
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

/* =========================================================
   WORKFLOW
   ========================================================= */

const workflow = [
  {
    number: "1",
    titleKey: "workflow.upload.title",
    textKey: "workflow.upload.text",
    icon: Upload,
    color: "mint",
  },

  {
    number: "2",
    titleKey: "workflow.extract.title",
    textKey: "workflow.extract.text",
    icon: Bot,
    color: "purple",
  },

  {
    number: "3",
    titleKey: "workflow.verify.title",
    textKey: "workflow.verify.text",
    icon: UserCheck,
    color: "orange",
  },

  {
    number: "4",
    titleKey: "workflow.reminder.title",
    textKey: "workflow.reminder.text",
    icon: Bell,
    color: "blue",
  },

  {
    number: "5",
    titleKey: "workflow.trend.title",
    textKey: "workflow.trend.text",
    icon: Activity,
    color: "green",
  },
];

/* =========================================================
   PAGE
   ========================================================= */

export default function Home() {
  const router =
    useRouter();

  const { t } = useLanguage();

  function tx(
    key: string,
    values?: Record<string, string | number>
  ) {
    let value = t(key);
    for (const [name, replacement] of Object.entries(values || {})) {
      value = value.replace(
        new RegExp(`\\{\\{${name}\\}\\}`, "g"),
        String(replacement)
      );
    }
    return value;
  }

  const [user, setUser] =
    useState<SessionUser | null>(
      null
    );

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [records, setRecords] =
    useState<MedicalRecord[]>(
      []
    );

  const [medications, setMedications] =
    useState<Medication[]>(
      []
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /* =======================================================
     LOAD DASHBOARD DATA
     ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        /*
         * ================================================
         * SESSION
         * ================================================
         */

        const sessionResponse =
          await fetch(
            "/api/auth/session",
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            }
          );

        let sessionResult: any =
          null;

        try {
          sessionResult =
            await sessionResponse.json();
        } catch {
          sessionResult = null;
        }

        if (
          cancelled
        ) {
          return;
        }

        if (
          !sessionResponse.ok ||
          !sessionResult?.authenticated ||
          !sessionResult?.user
        ) {
          router.replace(
            "/login"
          );

          return;
        }

        /*
         * Dashboard is currently
         * patient-facing.
         */

        if (
          sessionResult.user.role !==
          "PATIENT"
        ) {
          router.replace(
            "/clinician"
          );

          return;
        }

        setUser(
          sessionResult.user as SessionUser
        );

        /*
         * ================================================
         * MEDICAL RECORDS
         * ================================================
         */

        const recordsResponse =
          await fetch(
            "/api/medical-records",
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            }
          );

        let recordsResult: any =
          null;

        try {
          recordsResult =
            await recordsResponse.json();
        } catch {
          recordsResult = null;
        }

        if (
          !recordsResponse.ok ||
          !recordsResult?.success
        ) {
          throw new Error(
            recordsResult?.error ||
              t("errors.loadHealthRecords")
          );
        }

        const incomingRecords =
          Array.isArray(
            recordsResult.records
          )
            ? recordsResult.records
            : [];

        if (!cancelled) {
          setRecords(
            incomingRecords
          );
        }

        /*
         * ================================================
         * VERIFIED MEDICATIONS + REMINDERS
         * ================================================
         */

        const medicationsResponse =
          await fetch(
            "/api/medications",
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            }
          );

        let medicationsResult: any =
          null;

        try {
          medicationsResult =
            await medicationsResponse.json();
        } catch {
          medicationsResult = null;
        }

        if (
          !medicationsResponse.ok ||
          !medicationsResult?.success
        ) {
          throw new Error(
            medicationsResult?.error ||
              t("errors.loadMedicationReminders")
          );
        }

        const incomingMedications =
          Array.isArray(
            medicationsResult.medications
          )
            ? medicationsResult.medications
            : [];

        if (!cancelled) {
          setMedications(
            incomingMedications
          );
        }
      } catch (err) {
        console.error(
          "Dashboard loading failed:",
          err
        );

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : t("errors.loadDashboard")
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [router]);

  /* =======================================================
     STATS
     ======================================================= */

  const stats =
    useMemo<DashboardStats>(() => {
      let verified = 0;
      let pending = 0;
      let attention = 0;
      let medicationCount = 0;

      let activeReminderCount = 0;

      let takenTodayCount = 0;

      let skippedTodayCount = 0;

      let snoozedTodayCount = 0;

      let pendingDoseCount = 0;

      const today = new Date();

      for (
        const record of records
      ) {
        const status =
          getRecordStatus(
            record
          );

        if (
          status ===
          "verified"
        ) {
          verified += 1;
        }

        if (
          status ===
          "pending"
        ) {
          pending += 1;
        }

        if (
          status ===
          "attention"
        ) {
          attention += 1;
        }

        if (
          Array.isArray(
            record.medications
          )
        ) {
          medicationCount +=
            record.medications.length;
        }
      }

      /*
       * Calculate live reminder state
       * from the medication API.
       */

      for (
        const medication of medications
      ) {
        for (
          const reminder of
            medication.reminders || []
        ) {
          if (
            reminder.status ===
            "ACTIVE"
          ) {
            activeReminderCount += 1;
          }

          const todayLog =
            reminder.logs?.find(
              (log) => {
                const scheduled =
                  new Date(
                    log.scheduledAt
                  );

                return (
                  scheduled.getFullYear() ===
                    today.getFullYear() &&
                  scheduled.getMonth() ===
                    today.getMonth() &&
                  scheduled.getDate() ===
                    today.getDate()
                );
              }
            );

          if (
            reminder.status ===
              "ACTIVE" &&
            !todayLog
          ) {
            pendingDoseCount +=
              1;
          }

          if (
            todayLog?.status ===
            "TAKEN"
          ) {
            takenTodayCount +=
              1;
          }

          if (
            todayLog?.status ===
            "SKIPPED"
          ) {
            skippedTodayCount +=
              1;
          }

          if (
            todayLog?.status ===
            "SNOOZED"
          ) {
            snoozedTodayCount +=
              1;
          }
        }
      }

      return {
        totalRecords:
          records.length,

        verifiedRecords:
          verified,

        pendingRecords:
          pending,

        attentionRecords:
          attention,

        medicationCount,

        activeReminderCount,

        takenTodayCount,

        skippedTodayCount,

        snoozedTodayCount,

        pendingDoseCount,
      };
    }, [
      records,
      medications,
    ]);

  /* =======================================================
     RECENT ACTIVITY
     ======================================================= */

  const recentActivity =
    useMemo<ActivityItem[]>(() => {
      return records
        .slice()
        .sort(
          (a, b) =>
            new Date(
              b.submittedAt ||
                b.createdAt ||
                0
            ).getTime() -
            new Date(
              a.submittedAt ||
                a.createdAt ||
                0
            ).getTime()
        )
        .slice(0, 4)
        .map(
          (record) => {
            const status =
              getRecordStatus(
                record
              );

            if (
              status ===
              "verified"
            ) {
              return {
                id:
                  record.id,

                titleKey:
                  "activity.recordVerified",

                description:
                  record.documentName ||
                  t("common.medicalDocument"),

                date:
                  formatDate(
                    record.verifiedAt ||
                      record.createdAt,
                    t("common.recently")
                  ),

                type:
                  "verified",
              };
            }

            if (
              status ===
              "attention"
            ) {
              return {
                id:
                  record.id,

                titleKey:
                  "activity.correctionRequested",

                description:
                  record.documentName ||
                  t("common.medicalDocument"),

                date:
                  formatDate(
                    record.createdAt,
                    t("common.recently")
                  ),

                type:
                  "attention",
              };
            }

            return {
              id:
                record.id,

              titleKey:
                "activity.prescriptionSubmitted",

              description:
                record.documentName ||
                t("common.medicalDocument"),

              date:
                formatDate(
                  record.submittedAt ||
                    record.createdAt
                ),

              type:
                "pending",
            };
          }
        );
    }, [records, t]);

  /* =======================================================
     UPCOMING REMINDERS
     ======================================================= */

  const upcomingReminders =
    useMemo(() => {
      const now =
        new Date();

      const today =
        new Date();

      return medications
        .flatMap(
          (medication) =>
            (
              medication.reminders ||
              []
            )
              .filter(
                (reminder) =>
                  reminder.status ===
                  "ACTIVE"
              )
              .map(
                (reminder) => {
                  const scheduled =
                    new Date(
                      today
                    );

                  scheduled.setHours(
                    reminder.hour,
                    reminder.minute,
                    0,
                    0
                  );

                  const todayLog =
                    reminder.logs?.find(
                      (log) => {
                        const date =
                          new Date(
                            log.scheduledAt
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
                    );

                  /*
                   * Completed or skipped doses
                   * shouldn't appear as upcoming.
                   */

                  if (
                    todayLog?.status ===
                      "TAKEN" ||
                    todayLog?.status ===
                      "SKIPPED"
                  ) {
                    return null;
                  }

                  /*
                   * Show a future snoozed dose
                   * using its snoozed time.
                   */

                  if (
                    todayLog?.status ===
                      "SNOOZED" &&
                    todayLog.snoozedUntil
                  ) {
                    const snoozedUntil =
                      new Date(
                        todayLog.snoozedUntil
                      );

                    if (
                      snoozedUntil >
                      now
                    ) {
                      return {
                        medicationName:
                          medication.name,

                        dosage:
                          medication.dosage,

                        reminderId:
                          reminder.id,

                        scheduled,

                        snoozedUntil,
                      };
                    }
                  }

                  /*
                   * Past unhandled reminders are not
                   * displayed in the upcoming section.
                   */

                  if (
                    scheduled <
                    now
                  ) {
                    return null;
                  }

                  return {
                    medicationName:
                      medication.name,

                    dosage:
                      medication.dosage,

                    reminderId:
                      reminder.id,

                    scheduled,

                    snoozedUntil:
                      null as
                        | Date
                        | null,
                  };
                }
              )
        )
        .filter(
          (
            item
          ): item is NonNullable<
            typeof item
          > =>
            item !== null
        )
        .sort(
          (a, b) =>
            a.scheduled.getTime() -
            b.scheduled.getTime()
        )
        .slice(0, 3);
    }, [medications]);

  /* =======================================================
     GREETING
     ======================================================= */

  const displayName =
    user?.name
      ? user.name.split(
          " "
        )[0]
      : "there";

  /* =======================================================
     NAVIGATION
     ======================================================= */

  function handleNavClick(
    item: (typeof navItems)[number]
  ) {
    if (item.href) {
      router.push(
        item.href
      );
    }
  }

  /* =======================================================
     REFRESH
     ======================================================= */

  function refreshDashboard() {
    window.location.reload();
  }

  /* =======================================================
     LOGOUT
     ======================================================= */

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Logout failed with status ${response.status}`);
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      window.location.replace("/login");
    }
  }

  /* =======================================================
     LOADING
     ======================================================= */

  if (loading) {
    return (
      <main className="app-shell">

        <div className="flex min-h-screen items-center justify-center">

          <div className="flex items-center gap-3 text-slate-500">

            <RefreshCw
              size={20}
              className="animate-spin"
            />

            {t("dashboard.loading")}

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
                  onClick={() =>
                    handleNavClick(
                      item
                    )
                  }
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
                    {getNavLabel(item.label, t)}
                  </span>

                  {item.label ===
                    "Prescriptions" &&
                    stats.attentionRecords >
                      0 && (
                      <span className="nav-badge red">
                        {
                          stats.attentionRecords
                        }
                      </span>
                    )}

                  {item.label ===
                    "Medication & Reminders" &&
                    stats.activeReminderCount >
                      0 && (
                      <span className="nav-badge orange">
                        {
                          stats.activeReminderCount
                        }
                      </span>
                    )}

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
                {t("app.prototypeWorkspace")}
              </strong>

              <p>
                {t("app.aiDisclaimer")}
              </p>

            </div>

          </div>

        </div>

      </aside>

      {/* ===================================================
          MAIN
          =================================================== */}

      <section className="main-content">

        {/* =================================================
            TOP BAR
            ================================================= */}

        <header className="topbar">

          <div className="breadcrumb">

            <span className="menu-lines">
              ☰
            </span>

            <span>
              JeevanLink
            </span>

            <span className="chevron">
              ›
            </span>

            <strong>
              {t("nav.dashboard")}
            </strong>

          </div>

          <div className="top-actions">

            <LanguageSwitcher />

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

              {(stats.attentionRecords +
                stats.pendingRecords) >
                0 && (
                <span>
                  {
                    stats.attentionRecords +
                    stats.pendingRecords
                  }
                </span>
              )}

            </button>

            <div className="profile">

              <div className="avatar">

                {user?.name
                  ? user.name
                      .charAt(0)
                      .toUpperCase()
                  : "P"}

              </div>

              <span>
                {user?.name ||
                  "Patient"}
              </span>

              <ChevronDown
                size={16}
              />

            </div>

            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="ml-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut
                size={16}
              />
              {t("common.logout")}
            </button>

          </div>

        </header>

        {/* =================================================
            DASHBOARD
            ================================================= */}

        <div className="dashboard">

          {/* =================================================
              HERO
              ================================================= */}

          <section className="hero">

            <div className="hero-content">

              <div className="eyebrow">

                <span />

                {t("dashboard.eyebrow")}

              </div>

              <h2>

                {t("dashboard.heroLine1")},

                <br />

                <span>
                  {t("dashboard.connected")}
                </span>{" "}
                {t("dashboard.withCare")}

              </h2>

              <p>
                {t("dashboard.heroDescription")}
              </p>

              {error && (

                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>

              )}

              <div className="hero-buttons">

                <Link
                  href="/clinical-intake"
                  className="primary-button"
                >

                  {t("dashboard.beginDemo")}

                  <Upload
                    size={17}
                  />

                </Link>

                <Link
                  href="/records"
                  className="secondary-button"
                >

                  {t("dashboard.exploreRecords")} →

                </Link>

              </div>

              <div className="hero-features">

                <span>

                  <ShieldCheck
                    size={18}
                  />

                  {t("dashboard.featureAccess")}

                </span>

                <span>

                  <UserCheck
                    size={18}
                  />

                  {t("dashboard.featureVerification")}

                </span>

                <span>

                  <Workflow
                    size={18}
                  />

                  {t("dashboard.featureFhir")}

                </span>

              </div>

            </div>

            {/* =================================================
                HERO VISUAL
                ================================================= */}

            <div className="hero-visual">

              <div className="hero-orb orb-one" />

              <div className="hero-orb orb-two" />

              <div className="family-placeholder">

                <div className="family-icon">

                  <HeartPulse
                    size={95}
                    strokeWidth={1.2}
                  />

                </div>

                <p>
                  JeevanLink
                </p>

                <span>
                  {t("dashboard.oneConnectedJourney")}
                </span>

              </div>

              <div className="floating-card ai-card">

                <Bot />

                <div>

                  <span>
                    {t("dashboard.aiExtracted")}
                  </span>

                  <strong>
                    {stats.totalRecords >
                    0
                      ? t("dashboard.draftsAvailable")
                      : t("common.ready")}
                  </strong>

                </div>

              </div>

              <div className="floating-card clinician-card">

                <div className="status-icon success">
                  ✓
                </div>

                <div>

                  <span>
                    {t("dashboard.clinician")}
                  </span>

                  <strong>
                    {stats.verifiedRecords >
                    0
                      ? tx("dashboard.verifiedCount", { count: stats.verifiedRecords })
                      : t("dashboard.awaitingReview")}
                  </strong>

                </div>

              </div>

              <div className="floating-card continuity-card">

                <div className="status-icon heart">
                  ♥
                </div>

                <div>

                  <span>
                    {t("dashboard.continuity")}
                  </span>

                  <strong>
                    {stats.totalRecords >
                    0
                      ? t("dashboard.maintained")
                      : t("dashboard.readyToBegin")}
                  </strong>

                </div>

              </div>

            </div>

          </section>

          {/* =================================================
              WORKFLOW
              ================================================= */}

          <section className="workflow-section">

            {workflow.map(
              (item) => {
                const Icon =
                  item.icon;

                return (
                  <div
                    className="workflow-item"
                    key={
                      item.number
                    }
                  >

                    <div
                      className={`workflow-number ${item.color}`}
                    >
                      {
                        item.number
                      }
                    </div>

                    <div
                      className={`workflow-icon ${item.color}`}
                    >

                      <Icon
                        size={30}
                        strokeWidth={
                          1.7
                        }
                      />

                    </div>

                    <div className="workflow-text">

                      <strong>
                        {t(item.titleKey)}
                      </strong>

                      <p>
                        {t(item.textKey)}
                      </p>

                    </div>

                  </div>
                );
              }
            )}

          </section>

          {/* =================================================
              LOWER DASHBOARD
              ================================================= */}

          <section className="dashboard-grid">

            {/* =================================================
                PERSONALIZED GREETING
                ================================================= */}

            <div className="journey-card">

              <div className="journey-overlay" />

              <div className="journey-content">

                <p>
                  {t("dashboard.goodAfternoon")}
                </p>

                <h3>
                  {displayName}.
                </h3>

                <span>
                  {t("dashboard.greetingDescription")}
                </span>

                <button
                  type="button"
                  className="talk-button"
                >

                  <Mic
                    size={19}
                  />

                  {t("dashboard.talkToJeevanLink")}

                </button>

              </div>

              <div className="journey-illustration">

                <HeartPulse
                  size={100}
                  strokeWidth={1}
                />

              </div>

            </div>

            {/* =================================================
                WELLNESS SCORE
                ================================================= */}

            <div className="score-card">

              <p>
                {t("dashboard.wellnessScore")}
              </p>

              <div className="score">

                {stats.totalRecords > 0
                  ? "8.4"
                  : "—"}

                <span>
                  /10
                </span>

              </div>

              <div className="ai-tag">
                ✦ {t("dashboard.aiGenerated")}
              </div>

              <span className="score-description">
                {t("dashboard.wellnessDescription")}
              </span>

              <div className="trend-line">

                <span />
                <span />
                <span />
                <span />
                <span />

              </div>

            </div>

            {/* =================================================
                STAT CARDS
                ================================================= */}

            <div className="stats-area">

              <StatCard
                icon={
                  <HeartPulse />
                }
                title={t("stats.vitalsToday")}
                value="—"
                text={t("stats.vitalsConnecting")}
                variant="green"
              />

              <StatCard
                icon={
                  <FileText />
                }
                title={t("stats.healthRecords")}
                value={String(
                  stats.totalRecords
                )}
                text={
                  stats.totalRecords ===
                  0
                    ? t("stats.noMedicalRecords")
                    : tx("stats.recordsSummary", { verified: stats.verifiedRecords, pending: stats.pendingRecords })
                }
                variant="purple"
              />

              <StatCard
                icon={
                  <Bell />
                }
                title={t("stats.activeReminders")}
                value={String(
                  stats.activeReminderCount
                )}
                text={
                  stats.activeReminderCount ===
                  0
                    ? stats.medicationCount ===
                      0
                      ? t("stats.noVerifiedMeds")
                      : t("stats.noActiveReminders")
                    : tx("stats.reminderSummary", { pending: stats.pendingDoseCount, taken: stats.takenTodayCount })
                }
                variant="orange"
              />

              <StatCard
                icon={
                  <UserCheck />
                }
                title={t("stats.pendingReview")}
                value={String(
                  stats.pendingRecords
                )}
                text={
                  stats.pendingRecords ===
                  0
                    ? stats.attentionRecords >
                      0
                      ? tx("stats.attentionOne", { count: stats.attentionRecords })
                      : t("stats.nothingWaiting")
                    : t("stats.aiDraftsWaiting")
                }
                variant="blue"
              />

            </div>

          </section>

          {/* =================================================
              BOTTOM DASHBOARD
              ================================================= */}

          <section className="bottom-grid">

            {/* =================================================
                RECENT ACTIVITY
                ================================================= */}

            <div className="bottom-card">

              <div className="mb-4 flex items-center justify-between">

                <div>

                  <h3>
                    {t("activity.recent")}
                  </h3>

                  <Link
                    href="/health-timeline"
                    className="mt-1 inline-flex text-xs font-semibold text-teal-700 hover:text-teal-800"
                  >
                    {t("activity.viewTimeline")}
                  </Link>

                </div>

                <button
                  type="button"
                  onClick={
                    refreshDashboard
                  }
                  className="text-slate-400 transition hover:text-slate-700"
                  aria-label={t("activity.refreshDashboard")}
                >

                  <RefreshCw
                    size={17}
                  />

                </button>

              </div>

              {recentActivity.length ===
              0 ? (

                <div className="activity-row">

                  <div className="activity-dot purple" />

                  <span>
                    {t("activity.noneYet")}
                  </span>

                  <small>
                    {t("activity.startUpload")}
                  </small>

                </div>

              ) : (

                recentActivity.map(
                  (item) => (

                    <div
                      className="activity-row"
                      key={
                        item.id
                      }
                    >

                      <div
                        className={`activity-dot ${
                          item.type ===
                          "verified"
                            ? "green"
                            : item.type ===
                              "attention"
                            ? "orange"
                            : "purple"
                        }`}
                      />

                      <span>
                        {t(item.titleKey)}
                      </span>

                      <small>
                        {
                          item.date
                        }
                      </small>

                    </div>

                  )
                )

              )}

            </div>

            {/* =================================================
                UPCOMING REMINDERS
                ================================================= */}

            <div className="bottom-card">

              <div className="mb-4 flex items-center justify-between">

                <h3>
                  {t("reminders.upcoming")}
                </h3>

                <Link
                  href="/medications"
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800"
                >
                  {t("reminders.manage")}
                </Link>

              </div>

              {upcomingReminders.length >
              0 ? (

                <div className="space-y-2">

                  {upcomingReminders.map(
                    (
                      reminder
                    ) => (

                      <Link
                        href="/medications"
                        key={
                          reminder.reminderId
                        }
                        className="reminder-row"
                      >

                        <Pill
                          size={20}
                        />

                        <div className="min-w-0 flex-1">

                          <strong>
                            {
                              reminder.medicationName
                            }
                          </strong>

                          <p>

                            {reminder.snoozedUntil
                              ? tx("reminders.snoozedUntil", {
                                  time:
                                    reminder.snoozedUntil.toLocaleTimeString(
                                      undefined,
                                      {
                                        hour: "numeric",
                                        minute: "2-digit",
                                      }
                                    ),
                                })
                              : tx("reminders.nextDose", {
                                  time:
                                    reminder.scheduled.toLocaleTimeString(
                                      undefined,
                                      {
                                        hour: "numeric",
                                        minute: "2-digit",
                                      }
                                    ),
                                })}

                            {reminder.dosage
                              ? ` · ${reminder.dosage}`
                              : ""}

                          </p>

                        </div>

                        <Clock
                          size={17}
                        />

                      </Link>

                    )
                  )}

                </div>

              ) : stats.medicationCount >
                0 ? (

                <div className="reminder-row">

                  <CheckCircle2
                    size={20}
                  />

                  <div>

                    <strong>
                      {t("reminders.noUpcoming")}
                    </strong>

                    <p>
                      {t("reminders.completedHandled")}
                    </p>

                  </div>

                </div>

              ) : (

                <div className="reminder-row">

                  <Pill
                    size={20}
                  />

                  <div>

                    <strong>
                      {t("stats.noVerifiedMeds")}
                    </strong>

                    <p>
                      {t("reminders.verifiedMedsAppear")}
                    </p>

                  </div>

                </div>

              )}

              {stats.activeReminderCount >
                0 && (

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">

                  <div className="rounded-xl bg-emerald-50 px-2 py-3">

                    <strong className="block text-lg text-emerald-700">
                      {
                        stats.takenTodayCount
                      }
                    </strong>

                    <span className="text-xs text-emerald-700">
                      {t("reminders.taken")}
                    </span>

                  </div>

                  <div className="rounded-xl bg-red-50 px-2 py-3">

                    <strong className="block text-lg text-red-700">
                      {
                        stats.skippedTodayCount
                      }
                    </strong>

                    <span className="text-xs text-red-700">
                      {t("reminders.skipped")}
                    </span>

                  </div>

                  <div className="rounded-xl bg-amber-50 px-2 py-3">

                    <strong className="block text-lg text-amber-700">
                      {
                        stats.snoozedTodayCount
                      }
                    </strong>

                    <span className="text-xs text-amber-700">
                      {t("reminders.snoozed")}
                    </span>

                  </div>

                </div>

              )}

            </div>

            {/* =================================================
                INSIGHTS
                ================================================= */}

            <div className="bottom-card">

              <h3>
                {t("insights.title")}
              </h3>

              <p className="insight-text">

                {stats.totalRecords === 0
                  ? t("insights.empty")
                  : tx("insights.summary", {
                      count: stats.totalRecords,
                      verified: stats.verifiedRecords,
                      plural:
                        stats.totalRecords === 1 ? "" : "s",
                    })}

              </p>

              <div className="insight-chip">

                <BrainCircuit
                  size={17}
                />

                {t("insights.aiAssisted")}

              </div>

            </div>

          </section>

        </div>

      </section>

    </main>
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