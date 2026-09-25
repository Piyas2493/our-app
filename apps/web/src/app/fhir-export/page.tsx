"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, RefreshCw, Workflow } from "lucide-react";

import LogoutButton from "@/components/LogoutButton";
import { useLanguage } from "@/components/LanguageProvider";
import Sidebar from "@/components/Sidebar";
import MobileSidebarToggle from "@/components/MobileSidebarToggle";

export default function FhirExportPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [bundle, setBundle] = useState<Record<string, unknown> | null>(null);
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

        const response = await fetch("/api/fhir-export", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const result = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(result?.issue?.[0]?.diagnostics || "Unable to build the FHIR export.");
        }

        setBundle(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to build the FHIR export.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [router]);

  function downloadBundle() {
    if (!bundle) return;
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/fhir+json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "jeevanlink-fhir-bundle.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  const entryCount = Array.isArray(bundle?.entry) ? (bundle!.entry as unknown[]).length : 0;

  if (loading) {
    return (
      <main className="app-shell">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <RefreshCw size={20} className="animate-spin" />
            Building your FHIR export…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="main-content min-h-screen bg-[#f5f7f7] text-slate-900">
        <div className="mx-auto max-w-[1000px] px-6 py-8">
          <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <MobileSidebarToggle />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
                {t("nav.fhir")}
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">FHIR-shaped export</h1>
              <p className="mt-2 max-w-2xl text-slate-500">
                A Patient + DocumentReference bundle built from your JeevanLink records, shaped
                the way FHIR expects. It is a starting point for interoperability, not a
                certified ABDM integration — that needs sandbox credentials and a conformance
                review beyond this prototype.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <LogoutButton />
            </div>
          </header>

          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>
              This export is illustrative only. It has not been validated against the ABDM/FHIR
              conformance profiles required for real-world exchange with another health system.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {bundle && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <Workflow size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">FHIR Bundle</p>
                    <p className="text-xs text-slate-400">
                      {entryCount} resource{entryCount === 1 ? "" : "s"} (1 Patient +{" "}
                      {Math.max(entryCount - 1, 0)} DocumentReference)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={downloadBundle}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
                >
                  <Download size={15} />
                  Download JSON
                </button>
              </div>

              <pre className="mt-5 max-h-[420px] overflow-auto rounded-2xl bg-slate-900 p-4 text-xs leading-5 text-slate-100">
                {JSON.stringify(bundle, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
