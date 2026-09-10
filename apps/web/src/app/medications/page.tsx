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
  Bell,
  CheckCircle2,
  Clock,
  Ban,
  Loader2,
  Pill,
  Plus,
  RefreshCw,
  ShieldCheck,
  SkipForward,
  Sparkles,
} from "lucide-react";

import LogoutButton from "@/components/LogoutButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";

/* =========================================================
   TYPES
   ========================================================= */

type MedicationLogStatus =
  | "TAKEN"
  | "SKIPPED"
  | "SNOOZED";

type ReminderStatus =
  | "ACTIVE"
  | "DISABLED";

type MedicationLog = {
  id: string;
  scheduledAt: string;
  actionAt?: string | null;
  status: MedicationLogStatus;
  snoozedUntil?: string | null;
};

type MedicationReminder = {
  id: string;
  hour: number;
  minute: number;
  status: ReminderStatus;
  logs: MedicationLog[];
};

type Medication = {
  id: string;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  startDate?: string | null;
  endDate?: string | null;

  medicalRecord?: {
    id: string;
    documentName: string;
    documentType: string;
    verifiedAt?: string | null;
    status: string;
  };

  reminders: MedicationReminder[];
};

/* =========================================================
   HELPERS
   ========================================================= */

function formatTime(
  hour: number,
  minute: number,
  locale?: string
) {
  const date = new Date();

  date.setHours(hour, minute, 0, 0);

  return date.toLocaleTimeString(
    locale || undefined,
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function formatDate(
  value?: string | null,
  locale?: string
) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    locale || undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function todayAt(
  hour: number,
  minute: number
) {
  const date = new Date();

  date.setHours(hour, minute, 0, 0);

  return date;
}

function getTodayLog(
  reminder: MedicationReminder
) {
  const today = new Date();

  const logs = reminder.logs || [];

  return (
    logs.find((log) => {
      const scheduled =
        new Date(log.scheduledAt);

      return (
        scheduled.getFullYear() ===
          today.getFullYear() &&
        scheduled.getMonth() ===
          today.getMonth() &&
        scheduled.getDate() ===
          today.getDate()
      );
    }) || null
  );
}

function sortReminders(
  reminders: MedicationReminder[]
) {
  return [...reminders].sort(
    (a, b) => {
      const aMinutes =
        a.hour * 60 + a.minute;

      const bMinutes =
        b.hour * 60 + b.minute;

      return (
        aMinutes - bMinutes
      );
    }
  );
}

/* =========================================================
   PAGE
   ========================================================= */

export default function MedicationsPage() {
  const { t } = useLanguage();
  const [
    medications,
    setMedications,
  ] = useState<Medication[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    workingReminder,
    setWorkingReminder,
  ] = useState<string | null>(null);

  const [
    snoozeMenu,
    setSnoozeMenu,
  ] = useState<string | null>(null);

  const [
    showAddReminder,
    setShowAddReminder,
  ] = useState<string | null>(null);

  const [
    reminderHour,
    setReminderHour,
  ] = useState("08");

  const [
    reminderMinute,
    setReminderMinute,
  ] = useState("00");

  /* =========================================================
     LOAD MEDICATIONS
     ========================================================= */

  const loadMedications =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            "/api/medications",
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
            t("medications.errors.invalidResponse")
          );
        }

        if (
          !response.ok ||
          !result?.success
        ) {
          throw new Error(
            result?.error ||
              "Unable to load medications."
          );
        }

        setMedications(
          Array.isArray(
            result.medications
          )
            ? result.medications
            : []
        );
      } catch (err) {
        console.error(
          "Unable to load medications:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : t("medications.errors.load")
        );

        setMedications([]);
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadMedications();
  }, [loadMedications]);

  /* =========================================================
     COUNTS
     ========================================================= */

  const activeReminders =
    useMemo(() => {
      return medications.reduce(
        (total, medication) =>
          total +
          medication.reminders.filter(
            (reminder) =>
              reminder.status ===
              "ACTIVE"
          ).length,
        0
      );
    }, [medications]);

  const disabledReminders =
    useMemo(() => {
      return medications.reduce(
        (total, medication) =>
          total +
          medication.reminders.filter(
            (reminder) =>
              reminder.status ===
              "DISABLED"
          ).length,
        0
      );
    }, [medications]);

  /* =========================================================
     REMINDER ACTION
     ========================================================= */

  async function reminderAction(
    reminderId: string,
    action:
      | "TAKEN"
      | "SKIPPED"
      | "SNOOZE"
      | "DISABLE"
      | "ENABLE",
    snoozeMinutes?: number
  ) {
    if (
      workingReminder ===
      reminderId
    ) {
      return;
    }

    setWorkingReminder(reminderId);
    setError("");
    setSnoozeMenu(null);

    try {
      const reminder =
        medications
          .flatMap(
            (medication) =>
              medication.reminders
          )
          .find(
            (item) =>
              item.id === reminderId
          );

      if (!reminder) {
        throw new Error(
          t("medications.errors.reminderNotFound")
        );
      }

      /*
       * The scheduled occurrence is based
       * on today's reminder time.
       */
      const scheduledAt =
        todayAt(
          reminder.hour,
          reminder.minute
        ).toISOString();

      const response =
        await fetch(
          "/api/medications",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            cache: "no-store",

            body: JSON.stringify({
              reminderId,
              action,
              scheduledAt,
              snoozeMinutes,
            }),
          }
        );

      let result: Record<string, unknown> | null = null;

      try {
        result =
          await response.json();
      } catch {
        throw new Error(
          t("medications.errors.invalidResponse")
        );
      }

      if (
        !response.ok ||
        !result?.success
      ) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : t("medications.errors.update")
        );
      }

      await loadMedications();
    } catch (err) {
      console.error(
        "Medication reminder action failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update reminder."
      );
    } finally {
      setWorkingReminder(null);
    }
  }

  /* =========================================================
     ADD REMINDER
     ========================================================= */

  async function createReminder(
    medicationId: string
  ) {
    const hour =
      Number(reminderHour);

    const minute =
      Number(reminderMinute);

    if (
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23 ||
      !Number.isInteger(minute) ||
      minute < 0 ||
      minute > 59
    ) {
      setError(
        t("medications.errors.invalidTime")
      );

      return;
    }

    setWorkingReminder(
      medicationId
    );
    setError("");

    try {
      const response =
        await fetch(
          "/api/medications",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            cache: "no-store",

            body: JSON.stringify({
              medicationId,
              hour,
              minute,
            }),
          }
        );

      let result: Record<string, unknown> | null = null;

      try {
        result =
          await response.json();
      } catch {
        throw new Error(
          t("medications.errors.invalidResponse")
        );
      }

      if (
        !response.ok ||
        !result?.success
      ) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : t("medications.errors.create")
        );
      }

      setShowAddReminder(null);

      setReminderHour("08");
      setReminderMinute("00");

      await loadMedications();
    } catch (err) {
      console.error(
        "Unable to create reminder:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create reminder."
      );
    } finally {
      setWorkingReminder(null);
    }
  }

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7f7]">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <Loader2
              size={22}
              className="animate-spin"
            />

            Loading medications...
          </div>
        </div>
      </main>
    );
  }

  /* =========================================================
     PAGE
     ========================================================= */

  return (
    <main className="min-h-screen bg-[#f5f7f7] text-slate-900">
      <div className="mx-auto max-w-[1500px] px-6 py-8">

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

              {t("medications.backDashboard")}
            </Link>

            <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
              {t("medications.eyebrow")}
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              {t("medications.title")}
            </h1>

            <p className="mt-2 max-w-2xl text-slate-500">
              {t("medications.description")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() =>
                void loadMedications()
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm hover:bg-slate-50"
            >
              <RefreshCw
                size={17}
              />

              {t("refresh")}
            </button>

            <LogoutButton />
          </div>
        </div>

        {/* =================================================
            ERROR
            ================================================= */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* =================================================
            SAFETY NOTICE
            ================================================= */}

        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-teal-100 bg-teal-50/60 p-5">
          <ShieldCheck
            size={22}
            className="mt-0.5 shrink-0 text-teal-700"
          />

          <div>
            <h2 className="font-semibold text-teal-900">
              {t("medications.safety.title")}
            </h2>

            <p className="mt-1 text-sm leading-6 text-teal-800">
              {t("medications.safety.description")}
            </p>
          </div>
        </div>

        {/* =================================================
            SUMMARY
            ================================================= */}

        <div className="mb-8 grid gap-5 md:grid-cols-3">

          <SummaryCard
            icon={
              <Pill size={21} />
            }
            title={t("medications.summary.verified")}
            value={String(
              medications.length
            )}
            description={t("medications.summary.verifiedDescription")}
          />

          <SummaryCard
            icon={
              <Bell size={21} />
            }
            title={t("medications.summary.active")}
            value={String(
              activeReminders
            )}
            description={t("medications.summary.activeDescription")}
          />

          <SummaryCard
            icon={
              <Clock size={21} />
            }
            title={t("medications.summary.disabled")}
            value={String(
              disabledReminders
            )}
            description={t("medications.summary.disabledDescription")}
          />

        </div>

        {/* =================================================
            EMPTY STATE
            ================================================= */}

        {medications.length ===
        0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center shadow-sm">

            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <Pill
                size={32}
              />
            </div>

            <h2 className="text-xl font-semibold text-slate-800">
              {t("medications.empty.title")}
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              {t("medications.empty.description")}
            </p>

            <Link
              href="/prescriptions"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <Plus
                size={17}
              />

              {t("medications.empty.upload")}
            </Link>

          </div>
        ) : (
          <div className="space-y-6">

            {medications.map(
              (medication) => {

                const sortedReminders =
                  sortReminders(
                    medication.reminders
                  );

                return (
                  <section
                    key={
                      medication.id
                    }
                    className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                  >

                    {/* MEDICATION HEADER */}

                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                      <div className="flex items-start gap-4">

                        <div className="rounded-2xl bg-teal-50 p-4 text-teal-700">
                          <Pill
                            size={27}
                          />
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">

                            <h2 className="text-2xl font-semibold text-slate-900">
                              {
                                medication.name
                              }
                            </h2>

                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2
                                size={13}
                              />
                              {t("medications.verified")}
                            </span>

                          </div>

                          <p className="mt-2 text-sm text-slate-500">
                            {
                              medication.dosage ||
                              t("medications.dosageUnknown")
                            }

                            {" · "}

                            {
                              medication.frequency ||
                              t("medications.frequencyUnknown")
                            }

                            {medication.duration && (
                              <>
                                {" · "}
                                {
                                  medication.duration
                                }
                              </>
                            )}
                          </p>

                          {medication.medicalRecord && (
                            <p className="mt-2 text-xs text-slate-400">
                              {t("medications.source")}:{" "}
                              {
                                medication
                                  .medicalRecord
                                  .documentName
                              }

                              {medication
                                .medicalRecord
                                .verifiedAt && (
                                <>
                                  {" · Verified "}
                                  {formatDate(
                                    medication
                                      .medicalRecord
                                      .verifiedAt
                                  )}
                                </>
                              )}
                            </p>
                          )}
                        </div>

                      </div>

                      <div className="flex flex-wrap gap-2">

                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                          {
                            sortedReminders.length
                          }{" "}
                          reminder
                          {sortedReminders.length ===
                          1
                            ? ""
                            : "s"}
                        </span>

                      </div>

                    </div>

                    {/* REMINDERS */}

                    <div className="mt-7 border-t border-slate-100 pt-6">

                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                        <div>
                          <h3 className="font-semibold text-slate-800">
                            {t("medications.schedule.title")}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            {t("medications.schedule.description")}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setShowAddReminder(
                              medication.id
                            );
                            setError("");
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-100"
                        >
                          <Plus
                            size={16}
                          />

                          Add reminder
                        </button>

                      </div>

                      {/* ADD REMINDER */}

                      {showAddReminder ===
                        medication.id && (
                        <div className="mb-5 rounded-2xl border border-teal-100 bg-teal-50/50 p-5">

                          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">

                            <label className="flex-1">
                              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {t("medications.schedule.hour")}
                              </span>

                              <select
                                value={
                                  reminderHour
                                }
                                onChange={(
                                  event
                                ) =>
                                  setReminderHour(
                                    event.target
                                      .value
                                  )
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                              >
                                {Array.from(
                                  {
                                    length: 24,
                                  },
                                  (
                                    _,
                                    hour
                                  ) => (
                                    <option
                                      key={
                                        hour
                                      }
                                      value={String(
                                        hour
                                      ).padStart(
                                        2,
                                        "0"
                                      )}
                                    >
                                      {String(
                                        hour
                                      ).padStart(
                                        2,
                                        "0"
                                      )}
                                    </option>
                                  )
                                )}
                              </select>
                            </label>

                            <label className="flex-1">
                              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {t("medications.schedule.minute")}
                              </span>

                              <select
                                value={
                                  reminderMinute
                                }
                                onChange={(
                                  event
                                ) =>
                                  setReminderMinute(
                                    event.target
                                      .value
                                  )
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                              >
                                {[
                                  "00",
                                  "05",
                                  "10",
                                  "15",
                                  "20",
                                  "25",
                                  "30",
                                  "35",
                                  "40",
                                  "45",
                                  "50",
                                  "55",
                                ].map(
                                  (
                                    minute
                                  ) => (
                                    <option
                                      key={
                                        minute
                                      }
                                      value={
                                        minute
                                      }
                                    >
                                      {minute}
                                    </option>
                                  )
                                )}
                              </select>
                            </label>

                            <button
                              type="button"
                              onClick={() =>
                                void createReminder(
                                  medication.id
                                )
                              }
                              disabled={
                                workingReminder ===
                                medication.id
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                            >
                              {workingReminder ===
                              medication.id ? (
                                <Loader2
                                  size={16}
                                  className="animate-spin"
                                />
                              ) : (
                                <CheckCircle2
                                  size={16}
                                />
                              )}

                              Save reminder
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setShowAddReminder(
                                  null
                                )
                              }
                              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>

                          </div>
                        </div>
                      )}

                      {/* REMINDER LIST */}

                      {sortedReminders.length ===
                      0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">

                          <Bell
                            size={30}
                            className="mx-auto mb-3 text-slate-300"
                          />

                          <p className="font-medium text-slate-600">
                            No reminders yet
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            Add a reminder time for this medication.
                          </p>

                        </div>
                      ) : (
                        <div className="space-y-4">

                          {sortedReminders.map(
                            (reminder) => {

                              const todayLog =
                                getTodayLog(
                                  reminder
                                );

                              const disabled =
                                reminder.status ===
                                "DISABLED";

                              return (
                                <div
                                  key={
                                    reminder.id
                                  }
                                  className={`rounded-2xl border p-5 ${
                                    disabled
                                      ? "border-slate-200 bg-slate-50"
                                      : "border-slate-200 bg-white"
                                  }`}
                                >

                                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                                    {/* TIME */}

                                    <div className="flex items-center gap-4">

                                      <div className="rounded-2xl bg-slate-100 p-3">
                                        <Clock
                                          size={24}
                                          className="text-slate-600"
                                        />
                                      </div>

                                      <div>
                                        <p className="text-2xl font-semibold text-slate-900">
                                          {formatTime(
                                            reminder.hour,
                                            reminder.minute
                                          )}
                                        </p>

                                        <div className="mt-1 flex flex-wrap items-center gap-2">

                                          {disabled ? (
                                            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                              Disabled
                                            </span>
                                          ) : todayLog?.status ===
                                            "TAKEN" ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                              <CheckCircle2
                                                size={13}
                                              />
                                              Taken today
                                            </span>
                                          ) : todayLog?.status ===
                                            "SKIPPED" ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                                              <SkipForward
                                                size={13}
                                              />
                                              Skipped today
                                            </span>
                                          ) : todayLog?.status ===
                                            "SNOOZED" ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                              <Clock
                                                size={13}
                                              />
                                              Snoozed
                                              {todayLog.snoozedUntil
                                                ? ` until ${new Date(
                                                    todayLog.snoozedUntil
                                                  ).toLocaleTimeString(
                                                    undefined,
                                                    {
                                                      hour: "numeric",
                                                      minute:
                                                        "2-digit",
                                                    }
                                                  )}`
                                                : ""}
                                            </span>
                                          ) : (
                                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                              Awaiting action
                                            </span>
                                          )}

                                        </div>
                                      </div>

                                    </div>

                                    {/* ACTIONS */}

                                    {!disabled && (
                                      <div className="flex flex-wrap gap-2">

                                        <button
                                          type="button"
                                          onClick={() =>
                                            void reminderAction(
                                              reminder.id,
                                              "TAKEN"
                                            )
                                          }
                                          disabled={
                                            workingReminder ===
                                            reminder.id
                                          }
                                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                          <CheckCircle2
                                            size={16}
                                          />

                                          {t("medications.action.taken")}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            void reminderAction(
                                              reminder.id,
                                              "SKIPPED"
                                            )
                                          }
                                          disabled={
                                            workingReminder ===
                                            reminder.id
                                          }
                                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                                        >
                                          <SkipForward
                                            size={16}
                                          />

                                          {t("medications.action.skip")}
                                        </button>

                                        <div className="relative">

                                          <button
                                            type="button"
                                            onClick={() =>
                                              setSnoozeMenu(
                                                snoozeMenu ===
                                                reminder.id
                                                  ? null
                                                  : reminder.id
                                              )
                                            }
                                            disabled={
                                              workingReminder ===
                                              reminder.id
                                            }
                                            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                                          >
                                            <Clock
                                              size={16}
                                            />

                                            Snooze
                                          </button>

                                          {snoozeMenu ===
                                            reminder.id && (
                                            <div className="absolute right-0 top-full z-20 mt-2 min-w-[170px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">

                                              {[
                                                {
                                                  label:
                                                    "10 minutes",
                                                  minutes:
                                                    10,
                                                },
                                                {
                                                  label:
                                                    "30 minutes",
                                                  minutes:
                                                    30,
                                                },
                                                {
                                                  label:
                                                    "1 hour",
                                                  minutes:
                                                    60,
                                                },
                                              ].map(
                                                (
                                                  option
                                                ) => (
                                                  <button
                                                    key={
                                                      option.minutes
                                                    }
                                                    type="button"
                                                    onClick={() =>
                                                      void reminderAction(
                                                        reminder.id,
                                                        "SNOOZE",
                                                        option.minutes
                                                      )
                                                    }
                                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                                  >
                                                    Snooze for{" "}
                                                    {
                                                      option.label
                                                    }
                                                  </button>
                                                )
                                              )}

                                            </div>
                                          )}

                                        </div>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            void reminderAction(
                                              reminder.id,
                                              "DISABLE"
                                            )
                                          }
                                          disabled={
                                            workingReminder ===
                                            reminder.id
                                          }
                                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                        >
                                          <Ban
                                            size={16}
                                          />

                                          Disable
                                        </button>

                                      </div>
                                    )}

                                    {disabled && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void reminderAction(
                                            reminder.id,
                                            "ENABLE"
                                          )
                                        }
                                        disabled={
                                          workingReminder ===
                                          reminder.id
                                        }
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
                                      >
                                        <Bell
                                          size={16}
                                        />

                                        {t("medications.action.enable")}
                                      </button>
                                    )}

                                  </div>

                                  {/* RECENT HISTORY */}

                                  {reminder.logs?.length >
                                    0 && (
                                    <div className="mt-5 border-t border-slate-100 pt-4">

                                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                                        Recent adherence
                                      </p>

                                      <div className="flex flex-wrap gap-2">

                                        {reminder.logs
                                          .slice(
                                            0,
                                            7
                                          )
                                          .map(
                                            (
                                              log
                                            ) => (
                                              <span
                                                key={
                                                  log.id
                                                }
                                                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                                                  log.status ===
                                                  "TAKEN"
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : log.status ===
                                                      "SKIPPED"
                                                    ? "bg-red-50 text-red-700"
                                                    : "bg-amber-50 text-amber-700"
                                                }`}
                                              >
                                                {formatDate(
                                                  log.scheduledAt
                                                )}{" "}
                                                ·{" "}
                                                {
                                                  log.status
                                                }
                                              </span>
                                            )
                                          )}

                                      </div>
                                    </div>
                                  )}

                                </div>
                              );
                            }
                          )}

                        </div>
                      )}

                    </div>

                  </section>
                );
              }
            )}

          </div>
        )}

        {/* =================================================
            FOOTER NOTE
            ================================================= */}

        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
          <Sparkles
            size={18}
            className="mt-0.5 shrink-0 text-teal-600"
          />

          <p className="leading-6">
            {t("medications.footer")}
          </p>
        </div>

      </div>
    </main>
  );
}

/* =========================================================
   SUMMARY CARD
   ========================================================= */

function SummaryCard({
  icon,
  title,
  value,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-start gap-4">

        <div className="rounded-2xl bg-teal-50 p-3 text-teal-700">
          {icon}
        </div>

        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-1 text-3xl font-semibold text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            {description}
          </p>
        </div>

      </div>

    </div>
  );
}