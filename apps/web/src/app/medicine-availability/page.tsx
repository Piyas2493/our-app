"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Pill, RefreshCw } from "lucide-react";

import LogoutButton from "@/components/LogoutButton";
import { useLanguage } from "@/components/LanguageProvider";
import Sidebar from "@/components/Sidebar";
import MobileSidebarToggle from "@/components/MobileSidebarToggle";

type Hospital = { id: string; name: string; city: string | null };

type StockEntry = {
  id: string;
  medicineName: string;
  status: "AVAILABLE" | "LOW" | "OUT";
  facility: Hospital;
};

const STATUS_STYLE: Record<StockEntry["status"], string> = {
  AVAILABLE: "bg-teal-100 text-teal-700",
  LOW: "bg-amber-100 text-amber-700",
  OUT: "bg-rose-100 text-rose-700",
};

export default function MedicineAvailabilityPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [stock, setStock] = useState<StockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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

        const response = await fetch("/api/medicine-stock", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          throw new Error(result?.error || "Unable to load medicine availability.");
        }

        setStock(result.stock || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load medicine availability.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [router]);

  const byFacility = new Map<string, { facility: Hospital; entries: StockEntry[] }>();
  for (const entry of stock) {
    const group = byFacility.get(entry.facility.id) || { facility: entry.facility, entries: [] };
    group.entries.push(entry);
    byFacility.set(entry.facility.id, group);
  }

  if (loading) {
    return (
      <main className="app-shell">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <RefreshCw size={20} className="animate-spin" />
            Loading medicine availability…
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
                {t("nav.medicineAvailability")}
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">Medicine availability</h1>
              <p className="mt-2 max-w-2xl text-slate-500">
                Check what's in stock at nearby facilities before you travel for it.
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

          {byFacility.size === 0 ? (
            <p className="text-sm text-slate-400">No medicine availability recorded yet.</p>
          ) : (
            <div className="space-y-5">
              {Array.from(byFacility.values()).map(({ facility, entries }) => (
                <div key={facility.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{facility.name}</p>
                      {facility.city && <p className="text-xs text-slate-400">{facility.city}</p>}
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {entries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Pill size={15} className="text-slate-400" />
                          {entry.medicineName}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[entry.status]}`}
                        >
                          {entry.status === "OUT"
                            ? "Out of stock"
                            : entry.status.charAt(0) + entry.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                    ))}
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
