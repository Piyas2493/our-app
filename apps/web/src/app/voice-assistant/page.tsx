"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  BrainCircuit,
  Building2,
  FileText,
  HeartPulse,
  LifeBuoy,
  Link2,
  Mic,
  Pill,
  RefreshCw,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import VoiceAssistant from "@/components/VoiceAssistant";
import MobileSidebarToggle from "@/components/MobileSidebarToggle";

/* =========================================================
   NAVIGATION (mirrors the shared patient sidebar)
   ========================================================= */

const navItems = [
  { label: "Dashboard", icon: Activity, href: "/dashboard" },
  { label: "Health Records", icon: FileText, href: "/records" },
  { label: "Health Timeline", icon: Activity, href: "/health-timeline" },
  { label: "Prescriptions", icon: Pill, href: "/prescriptions" },
  { label: "Vitals", icon: HeartPulse, href: "/vitals" },
  { label: "Medication & Reminders", icon: Bell, href: "/medications" },
  { label: "Personalized Health", icon: BrainCircuit, href: "/personalized-health" },
  { label: "Hospitals & Labs", icon: Building2, href: "/hospitals-labs" },
  { label: "Voice Assistant", icon: Mic, href: "/voice-assistant" },
  { label: "FHIR / ABDM", icon: Workflow, href: "/fhir-export" },
  { label: "Consent & Privacy", icon: ShieldCheck, href: "/consent" },
  { label: "Help & Support", icon: LifeBuoy, href: "/support" },
];

function getNavLabel(label: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    "Dashboard": t("nav.dashboard"),
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
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Link2 size={30} />
          </div>
          <div>
            <h1>JeevanLink</h1>
            <p>{t("app.tagline")}</p>
          </div>
        </div>

        <div className="sidebar-label">{t("app.continuityCentre")}</div>

        <nav className="nav-menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            const linked = Boolean(item.href);

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (item.href) router.push(item.href);
                }}
                disabled={!linked}
                className={`nav-item ${
                  item.label === "Voice Assistant" ? "active" : ""
                } ${!linked ? "cursor-default opacity-60" : ""}`}
              >
                <Icon size={21} strokeWidth={1.8} />
                <span>{getNavLabel(item.label, t)}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="workspace-card">
            <ShieldCheck size={28} />
            <div>
              <strong>{t("app.prototypeWorkspace")}</strong>
              <p>{t("app.aiDisclaimer")}</p>
            </div>
          </div>
        </div>
      </aside>

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
