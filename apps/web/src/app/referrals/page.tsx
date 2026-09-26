"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCheck,
  Clock,
  RefreshCw,
  X,
} from "lucide-react";

import LogoutButton from "@/components/LogoutButton";
import { useLanguage } from "@/components/LanguageProvider";
import Sidebar from "@/components/Sidebar";
import MobileSidebarToggle from "@/components/MobileSidebarToggle";

type Hospital = { id: string; name: string; city: string | null };

type Referral = {
  id: string;
  reason: string;
  status: "PENDING" | "ACCEPTED" | "COMPLETED" | "DECLINED";
  createdAt: string;
  fromFacility: Hospital | null;
  toFacility: Hospital;
};

const STATUS_STYLE: Record<Referral["status"], string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-teal-100 text-teal-700",
  DECLINED: "bg-rose-100 text-rose-700",
};

const STATUS_LABEL_KEY: Record<Referral["status"], "referrals.status.pending" | "referrals.status.accepted" | "referrals.status.completed" | "referrals.status.declined"> = {
  PENDING: "referrals.status.pending",
  ACCEPTED: "referrals.status.accepted",
  COMPLETED: "referrals.status.completed",
  DECLINED: "referrals.status.declined",
};

export default function ReferralsPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Patient");

  const [fromFacilityId, setFromFacilityId] = useState("");
  const [toFacilityId, setToFacilityId] = useState("");
  const [reason, setReason] = useState("");

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

      const response = await fetch("/api/referrals", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || t("referrals.errors.load"));
      }

      setReferrals(result.referrals || []);
      setHospitals(result.hospitals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("referrals.errors.load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function createReferral(event: React.FormEvent) {
    event.preventDefault();
    if (!toFacilityId || !reason.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/referrals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toFacilityId,
          fromFacilityId: fromFacilityId || undefined,
          reason: reason.trim(),
        }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || t("referrals.errors.create"));
      }

      setReason("");
      setFromFacilityId("");
      setToFacilityId("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("referrals.errors.create"));
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: string, status: "ACCEPTED" | "COMPLETED" | "DECLINED") {
    setUpdatingId(id);
    setError("");

    try {
      const response = await fetch("/api/referrals", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || t("referrals.errors.update"));
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("referrals.errors.update"));
    } finally {
      setUpdatingId(null);
    }
  }

  function formatDate(value: string) {
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
            {t("referrals.loading")}
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
                {t("nav.referrals")}
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">{t("referrals.pageTitle")}</h1>
              <p className="mt-2 max-w-2xl text-slate-500">
                {t("referrals.pageSubtitle")}
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
            onSubmit={createReferral}
            className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-slate-800">{t("referrals.formTitle")}</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("referrals.fromFacilityLabel")}
                </label>
                <select
                  value={fromFacilityId}
                  onChange={(event) => setFromFacilityId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">{t("referrals.notApplicable")}</option>
                  {hospitals.map((hospital) => (
                    <option key={hospital.id} value={hospital.id}>
                      {hospital.name}
                      {hospital.city ? ` — ${hospital.city}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("referrals.toFacilityLabel")}
                </label>
                <select
                  value={toFacilityId}
                  onChange={(event) => setToFacilityId(event.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">{t("referrals.selectFacility")}</option>
                  {hospitals.map((hospital) => (
                    <option key={hospital.id} value={hospital.id}>
                      {hospital.name}
                      {hospital.city ? ` — ${hospital.city}` : ""}
                    </option>
                  ))}
                </select>
                {hospitals.length === 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    {t("referrals.noFacilitiesHint")}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("referrals.reasonLabel")}
              </label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                rows={2}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                placeholder={t("referrals.reasonPlaceholder")}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !toFacilityId || !reason.trim()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <RefreshCw size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              {t("referrals.createButton")}
            </button>
          </form>

          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
            {t("referrals.yourReferrals")}
          </h2>

          {referrals.length === 0 ? (
            <p className="text-sm text-slate-400">{t("referrals.empty")}</p>
          ) : (
            <div className="space-y-3">
              {referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">
                          {referral.fromFacility ? `${referral.fromFacility.name} → ` : ""}
                          {referral.toFacility.name}
                        </p>
                        <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
                          {referral.reason}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          {t("referrals.createdLabel")} {formatDate(referral.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[referral.status]}`}
                      >
                        {referral.status === "PENDING" && <Clock size={13} />}
                        {referral.status === "ACCEPTED" && <Check size={13} />}
                        {referral.status === "COMPLETED" && <CheckCheck size={13} />}
                        {referral.status === "DECLINED" && <X size={13} />}
                        {t(STATUS_LABEL_KEY[referral.status])}
                      </span>

                      {referral.status === "PENDING" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={updatingId === referral.id}
                            onClick={() => void updateStatus(referral.id, "ACCEPTED")}
                            className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                          >
                            {t("referrals.accept")}
                          </button>
                          <button
                            type="button"
                            disabled={updatingId === referral.id}
                            onClick={() => void updateStatus(referral.id, "DECLINED")}
                            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            {t("referrals.decline")}
                          </button>
                        </div>
                      )}

                      {referral.status === "ACCEPTED" && (
                        <button
                          type="button"
                          disabled={updatingId === referral.id}
                          onClick={() => void updateStatus(referral.id, "COMPLETED")}
                          className="rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                        >
                          {t("referrals.markCompleted")}
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
