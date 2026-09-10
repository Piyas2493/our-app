"use client";

import {
  Activity,
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileText,
  Pill,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import LogoutButton from "@/components/LogoutButton";
import { useLanguage } from "@/components/LanguageProvider";

type Vital = {
  id: string;
  vitalType: string;
  value: number | null;
  secondaryValue: number | null;
  unit: string;
  recordedAt: string;
  source: string;
  deviceName?: string | null;
  notes?: string | null;
};

type Medication = {
  id: string;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  reminders: Array<{
    id: string;
    hour: number;
    minute: number;
    status: "ACTIVE" | "DISABLED";
    logs: Array<{
      id: string;
      scheduledAt: string;
      actionAt?: string | null;
      status: "TAKEN" | "SKIPPED" | "SNOOZED";
      snoozedUntil?: string | null;
    }>;
  }>;
};

type RecordItem = {
  id: string;
  documentName: string;
  documentType: string;
  interpretation: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  createdAt: string;
  verifiedAt?: string | null;
  medications: Array<{
    id: string;
    name: string;
    dosage?: string | null;
    frequency?: string | null;
    duration?: string | null;
  }>;
};

type PersonalizedInsight = {
  title: string;
  text: string;
  kind: "positive" | "watch" | "neutral";
};

type PersonalizedResponse = {
  success: boolean;
  profile: {
    patientName: string;
    verifiedRecords: number;
    verifiedMedications: number;
    vitalMeasurements: number;
    dataSources: string[];
  };
  snapshot: {
    headline: string;
    supportingText: string;
    healthScore: number | null;
    coverage: number;
  };
  vitals: {
    latest: Array<{
      vitalType: string;
      value: number | null;
      secondaryValue: number | null;
      unit: string;
      recordedAt: string;
      source: string;
    }>;
    trends: Array<{
      vitalType: string;
      latestValue: number | null;
      previousValue: number | null;
      averageValue: number | null;
      count: number;
      changePercent: number | null;
      direction: "UP" | "DOWN" | "STABLE" | "INSUFFICIENT_DATA";
    }>;
  };
  medications: {
    items: Array<{
      id: string;
      name: string;
      dosage: string | null;
      frequency: string | null;
      activeReminders: number;
      taken: number;
      skipped: number;
      snoozed: number;
      adherencePercent: number | null;
    }>;
    overallAdherencePercent: number | null;
  };
  records: Array<{
    documentName: string;
    documentType: string;
    interpretation: string | null;
    createdAt: string;
  }>;
  insights: PersonalizedInsight[];
  dataGaps: string[];
  safetyNote: string;
};

function formatVitalLabel(type: string, t: (key: any) => string) {
  const keys: Record<string, string> = {
    BLOOD_PRESSURE: "vitals.type.bloodPressure",
    HEART_RATE: "vitals.type.heartRate",
    OXYGEN_SATURATION: "vitals.type.oxygenSaturation",
    TEMPERATURE: "vitals.type.temperature",
    WEIGHT: "vitals.type.weight",
    BLOOD_GLUCOSE: "vitals.type.bloodGlucose",
    STEPS: "vitals.type.steps",
    SLEEP_DURATION: "vitals.type.sleepDuration",
  };
  const key = keys[type];
  return key ? t(key) : type.replaceAll("_", " ");
}

function formatVitalValue(item: {
  value: number | null;
  secondaryValue: number | null;
  unit: string;
  vitalType: string;
}) {
  if (item.value === null) return "—";
  if (item.vitalType === "BLOOD_PRESSURE") {
    return `${item.value}/${item.secondaryValue ?? "—"}`;
  }
  return `${item.value} ${item.unit}`.trim();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function directionLabel(
  direction: PersonalizedResponse["vitals"]["trends"][number]["direction"],
  t: (key: any) => string
) {
  if (direction === "UP") return t("personalizedHealth.direction.up");
  if (direction === "DOWN") return t("personalizedHealth.direction.down");
  if (direction === "STABLE") return t("personalizedHealth.direction.stable");
  return t("personalizedHealth.direction.insufficient");
}

export default function PersonalizedHealthPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<PersonalizedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [aiMessage, setAiMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/personalized-health", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || t("personalizedHealth.errors.load"));
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("personalizedHealth.errors.load")
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function generateAI() {
    try {
      setGenerating(true);
      setAiMessage("");

      const response = await fetch("/api/personalized-health", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": document.documentElement.lang || "en",
        },
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || t("personalizedHealth.errors.generate"));
      }

      setData(result);
      setAiMessage(t("personalizedHealth.ai.updated"));
    } catch (err) {
      setAiMessage(
        err instanceof Error
          ? err.message
          : t("personalizedHealth.errors.generate")
      );
    } finally {
      setGenerating(false);
    }
  }

  const trendMap = useMemo(() => {
    const map = new Map<string, PersonalizedResponse["vitals"]["trends"][number]>();
    for (const trend of data?.vitals.trends || []) {
      map.set(trend.vitalType, trend);
    }
    return map;
  }, [data]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7f7] text-slate-900">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <RefreshCw size={20} className="animate-spin" />
            {t("personalizedHealth.loading")}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7f7] text-slate-900">
      <div className="mx-auto max-w-[1500px] px-6 py-8">
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft size={16} />
              {t("personalizedHealth.backDashboard")}
            </Link>

            <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
              {t("personalizedHealth.eyebrow")}
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              {t("personalizedHealth.title")}
            </h1>

            <p className="mt-2 max-w-3xl text-slate-500">
              {t("personalizedHealth.description")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
              {t("personalizedHealth.refresh")}
            </button>
            <LogoutButton />
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {data && (
          <>
            <section className="mb-8 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
              <div className="rounded-3xl border border-teal-100 bg-gradient-to-br from-white to-teal-50/70 p-7 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700">
                    <ShieldCheck size={14} />
                    {t("personalizedHealth.badge.verified")}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                    <BrainCircuit size={14} />
                    {t("personalizedHealth.badge.explainable")}
                  </span>
                </div>

                <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight">
                  {data.snapshot.headline}
                </h2>

                <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                  {data.snapshot.supportingText}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {data.profile.dataSources.map((source) => (
                    <span
                      key={source}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                    >
                      {source}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <Sparkles size={17} />
                  {t("personalizedHealth.healthSignal.title")}
                </div>

                <div className="mt-4 flex items-end gap-2">
                  <span className="text-6xl font-semibold tracking-tight text-teal-700">
                    {data.snapshot.healthScore ?? "—"}
                  </span>
                  {data.snapshot.healthScore !== null && (
                    <span className="mb-2 text-slate-400">/100</span>
                  )}
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {t("personalizedHealth.healthSignal.description")}
                </p>

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{t("personalizedHealth.healthSignal.coverage")}</span>
                    <span>{data.snapshot.coverage}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-teal-600"
                      style={{ width: `${Math.min(100, Math.max(0, data.snapshot.coverage))}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8 grid gap-5 md:grid-cols-4">
              <MetricCard
                icon={<FileText size={21} />}
                label={t("personalizedHealth.metrics.records.label")}
                value={String(data.profile.verifiedRecords)}
                description={t("personalizedHealth.metrics.records.description")}
              />
              <MetricCard
                icon={<Pill size={21} />}
                label={t("personalizedHealth.metrics.medications.label")}
                value={String(data.profile.verifiedMedications)}
                description={t("personalizedHealth.metrics.medications.description")}
              />
              <MetricCard
                icon={<Activity size={21} />}
                label={t("personalizedHealth.metrics.vitals.label")}
                value={String(data.profile.vitalMeasurements)}
                description={t("personalizedHealth.metrics.vitals.description")}
              />
              <MetricCard
                icon={<CheckCircle2 size={21} />}
                label={t("personalizedHealth.metrics.adherence.label")}
                value={
                  data.medications.overallAdherencePercent === null
                    ? "—"
                    : `${data.medications.overallAdherencePercent}%`
                }
                description={t("personalizedHealth.metrics.adherence.description")}
              />
            </section>

            <section className="mb-8 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">{t("personalizedHealth.trends.title")}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {t("personalizedHealth.trends.description")}
                    </p>
                  </div>
                  <TrendingUp size={21} className="text-teal-700" />
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {data.vitals.trends.length === 0 ? (
                    <EmptyBlock text={t("personalizedHealth.trends.empty")} />
                  ) : (
                    data.vitals.trends.map((trend) => {
                      const increasing = trend.direction === "UP";
                      const decreasing = trend.direction === "DOWN";

                      return (
                        <div
                          key={trend.vitalType}
                          className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-slate-800">
                              {formatVitalLabel(trend.vitalType, t)}
                            </span>
                            {increasing ? (
                              <TrendingUp size={16} className="text-amber-600" />
                            ) : decreasing ? (
                              <TrendingDown size={16} className="text-blue-600" />
                            ) : (
                              <Clock3 size={16} className="text-slate-400" />
                            )}
                          </div>

                          <div className="mt-3 text-sm text-slate-600">
                            <strong>{directionLabel(trend.direction, t)}</strong>
                            {trend.changePercent !== null && (
                              <> · {Math.abs(trend.changePercent)}%</>
                            )}
                          </div>

                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            {trend.count}{" "}
                            {trend.count === 1
                              ? t("personalizedHealth.trends.reading")
                              : t("personalizedHealth.trends.readings")}{" "}
                            {t("personalizedHealth.trends.available")}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-xl font-semibold">{t("personalizedHealth.latest.title")}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t("personalizedHealth.latest.description")}
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  {data.vitals.latest.length === 0 ? (
                    <EmptyBlock text={t("personalizedHealth.latest.empty")} />
                  ) : (
                    data.vitals.latest.map((item) => (
                      <div
                        key={item.vitalType}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">
                            {formatVitalLabel(item.vitalType, t)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(item.recordedAt)} · {item.source}
                          </p>
                        </div>
                        <p className="text-lg font-semibold text-slate-900">
                          {formatVitalValue(item)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{t("personalizedHealth.metrics.adherence.label")}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t("personalizedHealth.medicationSection.description")}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.medications.items.length === 0 ? (
                  <EmptyBlock text={t("personalizedHealth.medicationSection.empty")} />
                ) : (
                  data.medications.items.map((medication) => (
                    <div
                      key={medication.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {medication.name}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {medication.dosage || t("personalizedHealth.medicationSection.doseNotSpecified")}
                            {medication.frequency ? ` · ${medication.frequency}` : ""}
                          </p>
                        </div>
                        <Pill size={18} className="text-teal-700" />
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                        <AdherenceStat label={t("personalizedHealth.adherenceStat.taken")} value={medication.taken} />
                        <AdherenceStat label={t("personalizedHealth.adherenceStat.skipped")} value={medication.skipped} />
                        <AdherenceStat label={t("personalizedHealth.adherenceStat.snoozed")} value={medication.snoozed} />
                      </div>

                      <div className="mt-5 flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          {medication.activeReminders}{" "}
                          {medication.activeReminders === 1
                            ? t("personalizedHealth.medicationSection.activeReminder")
                            : t("personalizedHealth.medicationSection.activeReminders")}
                        </span>
                        <strong className="text-teal-700">
                          {medication.adherencePercent === null
                            ? "—"
                            : `${medication.adherencePercent}% ${t("personalizedHealth.medicationSection.adherenceSuffix")}`}
                        </strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="mb-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <BrainCircuit size={21} />
                  <h2 className="text-xl font-semibold">{t("personalizedHealth.insights.title")}</h2>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {t("personalizedHealth.insights.description")}
                </p>

                <div className="mt-6 space-y-3">
                  {data.insights.map((insight, index) => (
                    <div
                      key={`${insight.title}-${index}`}
                      className={`rounded-2xl border p-4 ${
                        insight.kind === "positive"
                          ? "border-emerald-100 bg-emerald-50/50"
                          : insight.kind === "watch"
                          ? "border-amber-100 bg-amber-50/50"
                          : "border-slate-100 bg-slate-50/60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {insight.kind === "watch" ? (
                          <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-700" />
                        ) : (
                          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-teal-700" />
                        )}
                        <div>
                          <h3 className="font-semibold text-slate-800">
                            {insight.title}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {insight.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-teal-100 bg-teal-50/50 p-6">
                <h2 className="text-xl font-semibold text-teal-950">
                  {t("personalizedHealth.ai.title")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-teal-900/80">
                  {t("personalizedHealth.ai.description")}
                </p>

                <button
                  type="button"
                  onClick={() => void generateAI()}
                  disabled={generating}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {generating ? (
                    <RefreshCw size={17} className="animate-spin" />
                  ) : (
                    <Sparkles size={17} />
                  )}
                  {generating ? t("personalizedHealth.ai.generating") : t("personalizedHealth.ai.generate")}
                </button>

                {aiMessage && (
                  <p className="mt-4 text-sm text-teal-900">{aiMessage}</p>
                )}

                <div className="mt-8 rounded-2xl border border-teal-100 bg-white/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">
                    {t("personalizedHealth.ai.safetyTitle")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t("personalizedHealth.ai.safetyDescription")}
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText size={21} />
                <h2 className="text-xl font-semibold">{t("personalizedHealth.recordsSection.title")}</h2>
              </div>

              <div className="mt-5 space-y-3">
                {data.records.length === 0 ? (
                  <EmptyBlock text={t("personalizedHealth.recordsSection.empty")} />
                ) : (
                  data.records.slice(0, 6).map((record) => (
                    <div
                      key={`${record.documentName}-${record.createdAt}`}
                      className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-800">
                            {record.documentName}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {record.documentType} · {formatDate(record.createdAt)}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {t("personalizedHealth.recordsSection.verifiedBadge")}
                        </span>
                      </div>
                      {record.interpretation && (
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {record.interpretation}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck size={20} className="mt-0.5 shrink-0 text-amber-700" />
                <div>
                  <h2 className="font-semibold text-amber-900">{t("personalizedHealth.dataGaps.title")}</h2>
                  <ul className="mt-2 space-y-2 text-sm leading-6 text-amber-800">
                    {data.dataGaps.map((gap, index) => (
                      <li key={`${gap}-${index}`}>• {gap}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm leading-6 text-amber-800">
                    {data.safetyNote}
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-teal-50 p-3 text-teal-700">{icon}</div>
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
        </div>
      </div>
    </div>
  );
}

function AdherenceStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-2.5">
      <p className="font-semibold text-slate-800">{value}</p>
      <p className="mt-1 text-slate-400">{label}</p>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
      {text}
    </div>
  );
}
