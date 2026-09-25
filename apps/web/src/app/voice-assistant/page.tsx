"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import VoiceAssistant from "@/components/VoiceAssistant";
import MobileSidebarToggle from "@/components/MobileSidebarToggle";
import Sidebar from "@/components/Sidebar";

/* =========================================================
   PAGE
   ========================================================= */

export default function VoiceAssistantPage() {
  const router = useRouter();
  const { t, language } = useLanguage() as { t: (key: string) => string; language?: string };

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Patient");

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
          cache: "no-store",
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.authenticated || !result?.user) {
          router.replace("/login");
          return;
        }

        if (result.user.role !== "PATIENT") {
          router.replace(
            result.user.role === "CLINICIAN"
              ? "/clinician"
              : result.user.role === "HELPDESK"
                ? "/helpdesk"
                : result.user.role === "ADMIN"
                  ? "/admin"
                  : "/login",
          );
          return;
        }

        setUserName(result.user.name || "Patient");
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    void loadSession();
  }, [router]);

  if (loading) {
    return (
      <main className="app-shell">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-slate-500">
            <RefreshCw size={20} className="animate-spin" />
            Loading…
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
            <strong>{t("nav.voiceAssistant")}</strong>
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
            Voice Assistant
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Ask about your medications, records, vitals or reminders, jump to any
            part of the app, or log a new vital — all by voice or text. Assisted,
            voice-first support in your own language, available before you can
            reach a clinician in person or by call.
          </p>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
            <VoiceAssistant language={language} />
          </div>
        </div>
      </section>
    </main>
  );
}
