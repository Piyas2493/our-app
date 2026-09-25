"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Ban,
  Building2,
  CheckCheck,
  Hourglass,
  RefreshCw,
} from "lucide-react";

import LogoutButton from "@/components/LogoutButton";
import { useLanguage } from "@/components/LanguageProvider";
import Sidebar from "@/components/Sidebar";
import MobileSidebarToggle from "@/components/MobileSidebarToggle";

type Hospital = { id: string; name: string; city: string | null };

type Appointment = {
  id: string;
  reason: string;
  status: "REQUESTED" | "QUEUED" | "SEEN" | "CANCELLED";
  createdAt: string;
  preferredAt: string | null;
  facility: Hospital;
};

const STATUS_STYLE: Record<Appointment["status"], string> = {
  REQUESTED: "bg-amber-100 text-amber-700",
  QUEUED: "bg-blue-100 text-blue-700",
  SEEN: "bg-teal-100 text-teal-700",
  CANCELLED: "bg-slate-200 text-slate-500",
};

export default function AppointmentsPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [facilityId, setFacilityId] = useState("");
  const [reason, setReason] = useState("");
  const [preferredAt, setPreferredAt] = useState("");

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

      const response = await fetch("/api/appointments", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to load appointments.");
      }

      setAppointments(result.appointments || []);
      setHospitals(result.hospitals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load appointments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function createAppointment(event: React.FormEvent) {
    event.preventDefault();
    if (!facilityId || !reason.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId,
          reason: reason.trim(),
          preferredAt: preferredAt || undefined,
        }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to create appointment.");
      }

      setReason("");
      setFacilityId("");
      setPreferredAt("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create appointment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: string, status: "QUEUED" | "SEEN" | "CANCELLED") {
    setUpdatingId(id);
    setError("");

    try {
      const response = await fetch("/api/appointments", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to update appointment.");
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update appointment.");
    } finally {
      setUpdatingId(null);
    }
  }

  function formatDate(value: string | null) {
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

  if (loading) {
    return (
      <main className="app-shell">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <RefreshCw size={20} className="animate-spin" />
            Loading appointments…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="main-content min-h-screen bg-[#f5f7f7] text-slate-900">
        <div className="mx-auto max-w-[1200px] px-6 py-8">
          <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <MobileSidebarToggle />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
                {t("nav.appointments")}
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">Appointments &amp; queue</h1>
              <p className="mt-2 max-w-2xl text-slate-500">
                Request a visit at a facility and track where it stands — requested, queued, or
                seen — instead of waiting in the dark.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <LogoutButton />
            </div>
          </header>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <form
            onSubmit={createAppointment}
            className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-slate-800">Request an appointment</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Facility *
                </label>
                <select
                  value={facilityId}
                  onChange={(event) => setFacilityId(event.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Select a facility</option>
                  {hospitals.map((hospital) => (
                    <option key={hospital.id} value={hospital.id}>
                      {hospital.name}
                      {hospital.city ? ` — ${hospital.city}` : ""}
                    </option>
                  ))}
                </select>
                {hospitals.length === 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    No facilities yet — add one from Hospitals &amp; Labs first.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Preferred date/time (optional)
                </label>
                <input
                  type="datetime-local"
                  value={preferredAt}
                  onChange={(event) => setPreferredAt(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reason for visit *
              </label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                rows={2}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                placeholder="e.g. Follow-up for blood pressure medication"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !facilityId || !reason.trim()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <RefreshCw size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              Request appointment
            </button>
          </form>

          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
            Your appointments
          </h2>

          {appointments.length === 0 ? (
            <p className="text-sm text-slate-400">No appointments requested yet.</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{appointment.facility.name}</p>
                        <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
                          {appointment.reason}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          Requested {formatDate(appointment.createdAt)}
                          {appointment.preferredAt
                            ? ` · Preferred ${formatDate(appointment.preferredAt)}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[appointment.status]}`}
                      >
                        {appointment.status === "REQUESTED" && <Hourglass size={13} />}
                        {appointment.status === "QUEUED" && <Hourglass size={13} />}
                        {appointment.status === "SEEN" && <CheckCheck size={13} />}
                        {appointment.status === "CANCELLED" && <Ban size={13} />}
                        {appointment.status.charAt(0) + appointment.status.slice(1).toLowerCase()}
                      </span>

                      {appointment.status === "REQUESTED" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={updatingId === appointment.id}
                            onClick={() => void updateStatus(appointment.id, "QUEUED")}
                            className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                          >
                            Mark queued
                          </button>
                          <button
                            type="button"
                            disabled={updatingId === appointment.id}
                            onClick={() => void updateStatus(appointment.id, "CANCELLED")}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {appointment.status === "QUEUED" && (
                        <button
                          type="button"
                          disabled={updatingId === appointment.id}
                          onClick={() => void updateStatus(appointment.id, "SEEN")}
                          className="rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                        >
                          Mark seen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
