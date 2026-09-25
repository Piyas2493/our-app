"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pill, RefreshCw } from "lucide-react";

import LogoutButton from "@/components/LogoutButton";

type Hospital = { id: string; name: string; city: string | null };

type StockEntry = {
  id: string;
  medicineName: string;
  status: "AVAILABLE" | "LOW" | "OUT";
  updatedAt: string;
  facility: Hospital;
};

const STATUS_STYLE: Record<StockEntry["status"], string> = {
  AVAILABLE: "bg-teal-100 text-teal-700",
  LOW: "bg-amber-100 text-amber-700",
  OUT: "bg-rose-100 text-rose-700",
};

export default function AdminMedicineStockPage() {
  const router = useRouter();

  const [stock, setStock] = useState<StockEntry[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [facilityId, setFacilityId] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [status, setStatus] = useState<StockEntry["status"]>("AVAILABLE");

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
      if (session.user.role !== "ADMIN") {
        router.replace("/dashboard");
        return;
      }

      const response = await fetch("/api/medicine-stock", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to load medicine stock.");
      }

      setStock(result.stock || []);
      setHospitals(result.hospitals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load medicine stock.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function saveEntry(event: React.FormEvent) {
    event.preventDefault();
    if (!facilityId || !medicineName.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/medicine-stock", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, medicineName: medicineName.trim(), status }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to save medicine stock entry.");
      }

      setMedicineName("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save medicine stock entry.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6f7]">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw size={20} className="animate-spin" />
          Loading medicine stock…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f6f7] text-slate-900">
      <div className="mx-auto max-w-[1100px] px-5 py-7 lg:px-7">
        <header className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft size={16} />
              Back to admin overview
            </Link>
            <div className="mt-3 flex items-center gap-3">
              <div className="rounded-2xl bg-teal-700 p-3 text-white shadow-sm">
                <Pill size={25} />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Medicine availability</h1>
            </div>
          </div>
          <LogoutButton />
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={saveEntry} className="mb-8 rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Set medicine availability</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Medicine name *
              </label>
              <input
                type="text"
                value={medicineName}
                onChange={(event) => setMedicineName(event.target.value)}
                required
                placeholder="e.g. Paracetamol 500mg"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as StockEntry["status"])}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="AVAILABLE">Available</option>
                <option value="LOW">Low</option>
                <option value="OUT">Out of stock</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !facilityId || !medicineName.trim()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <RefreshCw size={15} className="animate-spin" /> : <Pill size={15} />}
            Save
          </button>
          <p className="mt-2 text-xs text-slate-400">
            Saving an existing facility + medicine combination updates its status instead of
            creating a duplicate entry.
          </p>
        </form>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
            Current stock
          </h3>
          {stock.length === 0 ? (
            <p className="text-sm text-slate-400">No medicine availability recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {stock.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{entry.medicineName}</p>
                    <p className="text-xs text-slate-400">
                      {entry.facility.name}
                      {entry.facility.city ? ` — ${entry.facility.city}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[entry.status]}`}
                  >
                    {entry.status === "OUT" ? "Out of stock" : entry.status.charAt(0) + entry.status.slice(1).toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
