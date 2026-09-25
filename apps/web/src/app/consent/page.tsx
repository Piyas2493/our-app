"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  Clock,
  FileText,
  FlaskConical,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  X,
} from "lucide-react";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import MobileSidebarToggle from "@/components/MobileSidebarToggle";
import Sidebar from "@/components/Sidebar";

/* =========================================================
   TYPES
   ========================================================= */

type ConsentCategory =
  | "CLINICAL_HISTORY"
  | "DOCUMENT_PROCESSING"
  | "CLINICIAN_SHARING"
  | "RESEARCH_DATA_SHARING"
  | "REMINDERS_NOTIFICATIONS";

type ConsentStatus = {
  category: ConsentCategory;
  granted: boolean;
  updatedAt: string | null;
  source: string | null;
};

type ConsentHistoryEvent = {
  id: string;
  category: ConsentCategory;
  granted: boolean;
  source: string;
  notes: string | null;
  createdAt: string;
};

/* =========================================================
   CATEGORY METADATA
   ========================================================= */

const CATEGORY_META: Array<{
  category: ConsentCategory;
  icon: typeof ShieldCheck;
  required: boolean;
  titleKey: string;
  descriptionKey: string;
}> = [
  {
    category: "CLINICAL_HISTORY",
    icon: Stethoscope,
    required: true,
    titleKey: "consent.clinicalHistory.title",
    descriptionKey: "consent.clinicalHistory.description",
  },
  {
    category: "DOCUMENT_PROCESSING",
    icon: FileText,
    required: true,
    titleKey: "consent.documentProcessing.title",
    descriptionKey: "consent.documentProcessing.description",
  },
  {
    category: "CLINICIAN_SHARING",
    icon: UserCheck,
    required: true,
    titleKey: "consent.clinicianSharing.title",
    descriptionKey: "consent.clinicianSharing.description",
  },
  {
    category: "RESEARCH_DATA_SHARING",
    icon: FlaskConical,
    required: false,
    titleKey: "consent.researchDataSharing.title",
    descriptionKey: "consent.researchDataSharing.description",
  },
  {
    category: "REMINDERS_NOTIFICATIONS",
    icon: Bell,
    required: false,
    titleKey: "consent.remindersNotifications.title",
    descriptionKey: "consent.remindersNotifications.description",
  },
];

/* =========================================================
   PAGE
   ========================================================= */

export default function ConsentPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [statuses, setStatuses] = useState<ConsentStatus[]>([]);
  const [history, setHistory] = useState<ConsentHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingCategory, setUpdatingCategory] = useState<ConsentCategory | null>(null);
  const [userName, setUserName] = useState("Patient");

  async function loadData() {
    setError("");

    try {
      const sessionResponse = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const session = await sessionResponse.json().catch(() => null);

      if (!sessionResponse.ok || !session?.authenticated || !session?.user) {
        router.replace("/login");
        return;
      }

      if (session.user.role !== "PATIENT") {
        router.replace("/clinician");
        return;
      }

      setUserName(session.user.name || "Patient");

      const response = await fetch("/api/consent", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to load consent records.");
      }

      setStatuses(result.statuses || []);
      setHistory(result.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load consent records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function toggleConsent(category: ConsentCategory, nextGranted: boolean) {
    setUpdatingCategory(category);
    setError("");

    try {
      const response = await fetch("/api/consent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, granted: nextGranted }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to update consent.");
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update consent.");
    } finally {
      setUpdatingCategory(null);
    }
  }

  const statusByCategory = useMemo(() => {
    const map = new Map<ConsentCategory, ConsentStatus>();
    for (const status of statuses) {
      map.set(status.category, status);
    }
    return map;
  }, [statuses]);

  const activeCount = statuses.filter((status) => status.granted).length;

  function formatDate(value: string | null) {
    if (!value) return t("consent.neverUpdated");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("consent.neverUpdated");
    return date.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <main className="app-shell">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <RefreshCw size={20} className="animate-spin" />
            {t("consent.loading")}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="main-content">
        <header className="topbar relative z-10">
          <div className="breadcrumb">
            <MobileSidebarToggle />
            <span>JeevanLink</span>
            <span className="chevron">›</span>
            <strong>{t("nav.consent")}</strong>
          </div>

          <div className="top-actions">
            <LanguageSwitcher />

            <div className="profile" title={userName}>
              <div className="avatar">{userName.charAt(0).toUpperCase()}</div>
              <span>{userName}</span>
            </div>
          </div>
        </header>

        <div className="px-8 py-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("consent.pageTitle")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            {t("consent.pageSubtitle")}
          </p>

          {error && (
            <div className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="stat-card">
              <div className="stat-icon green">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h4>{t("consent.activeCount")}</h4>
                <strong>
                  {activeCount} / {CATEGORY_META.length}
                </strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon blue">
                <Clock size={22} />
              </div>
              <div>
                <h4>{t("consent.historyCount")}</h4>
                <strong>{history.length}</strong>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {CATEGORY_META.map((meta) => {
              const status = statusByCategory.get(meta.category);
              const granted = status?.granted ?? false;
              const Icon = meta.icon;
              const isUpdating = updatingCategory === meta.category;

              return (
                <div
                  key={meta.category}
                  className={`rounded-2xl border p-5 ${
                    granted ? "border-teal-200 bg-teal-50/40" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                          granted ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Icon size={20} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{t(meta.titleKey)}</p>
                        <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
                          {t(meta.descriptionKey)}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          {meta.required ? t("consent.requiredNote") : t("consent.optionalNote")}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                          granted ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {granted ? <Check size={13} /> : <X size={13} />}
                        {granted ? t("consent.granted") : t("consent.notGranted")}
                      </span>

                      <span className="text-[11px] text-slate-400">
                        {t("consent.updated")}: {formatDate(status?.updatedAt ?? null)}
                      </span>

                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => void toggleConsent(meta.category, !granted)}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          granted
                            ? "border border-rose-200 text-rose-700 hover:bg-rose-50"
                            : "bg-teal-700 text-white hover:bg-teal-800"
                        }`}
                      >
                        {isUpdating ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : granted ? (
                          <X size={14} />
                        ) : (
                          <Check size={14} />
                        )}
                        {granted ? t("consent.revoke") : t("consent.grant")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
              {t("consent.historyTitle")}
            </h3>

            {history.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">{t("consent.historyEmpty")}</p>
            ) : (
              <div className="mt-3 space-y-2">
                {history.map((event) => {
                  const meta = CATEGORY_META.find((item) => item.category === event.category);

                  return (
                    <div
                      key={event.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            event.granted ? "bg-teal-100 text-teal-700" : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {event.granted ? <Check size={13} /> : <X size={13} />}
                        </span>
                        <div>
                          <p className="font-medium text-slate-700">
                            {meta ? t(meta.titleKey) : event.category}
                          </p>
                          <p className="text-xs text-slate-400">
                            {event.source === "CLINICAL_INTAKE"
                              ? t("consent.sourceIntake")
                              : t("consent.sourceCenter")}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">
                        {formatDate(event.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
