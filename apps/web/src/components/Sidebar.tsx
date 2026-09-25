"use client";

import {
  Activity,
  Bell,
  Building2,
  CalendarClock,
  ClipboardList,
  Clock,
  FileText,
  HeartPulse,
  LifeBuoy,
  Link2,
  Mic,
  Pill,
  BrainCircuit,
  PillBottle,
  Share2,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { useLanguage } from "@/components/LanguageProvider";

const NAV_ITEMS = [
  { key: "nav.dashboard", icon: Activity, href: "/dashboard" },
  { key: "nav.clinicalIntake", icon: ClipboardList, href: "/clinical-intake" },
  { key: "nav.records", icon: FileText, href: "/records" },
  { key: "nav.timeline", icon: Clock, href: "/health-timeline" },
  { key: "nav.prescriptions", icon: Pill, href: "/prescriptions", badge: "prescriptions" as const },
  { key: "nav.vitals", icon: HeartPulse, href: "/vitals" },
  { key: "nav.medications", icon: Bell, href: "/medications", badge: "medications" as const },
  { key: "nav.personalizedHealth", icon: BrainCircuit, href: "/personalized-health" },
  { key: "nav.hospitalsLabs", icon: Building2, href: "/hospitals-labs", badge: "hospitalsLabs" as const },
  { key: "nav.referrals", icon: Share2, href: "/referrals" },
  { key: "nav.appointments", icon: CalendarClock, href: "/appointments" },
  { key: "nav.medicineAvailability", icon: PillBottle, href: "/medicine-availability" },
  { key: "nav.voiceAssistant", icon: Mic, href: "/voice-assistant" },
  { key: "nav.fhir", icon: Workflow, href: "/fhir-export" },
  { key: "nav.consent", icon: ShieldCheck, href: "/consent" },
  { key: "nav.support", icon: LifeBuoy, href: "/support", badge: "support" as const },
];

/**
 * The persistent left-hand navigation, shared by every patient page.
 * Previously copy-pasted per page (with "active" hardcoded per copy,
 * easy to leave stale) -- now one component, active state derived from
 * the real current route. Badge counts are optional: pages that already
 * have the data (dashboard) can pass them; pages that don't just show
 * the nav item without a badge rather than duplicating dashboard's own
 * stats-fetching to get an exact count everywhere.
 */
export default function Sidebar({
  attentionRecordsCount,
  activeReminderCount,
  openTicketsCount,
  pendingLabReportsCount,
}: {
  attentionRecordsCount?: number;
  activeReminderCount?: number;
  openTicketsCount?: number;
  pendingLabReportsCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();

  return (
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
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.href === pathname;
          const badgeCount =
            item.badge === "prescriptions"
              ? attentionRecordsCount
              : item.badge === "medications"
                ? activeReminderCount
                : item.badge === "support"
                  ? openTicketsCount
                  : item.badge === "hospitalsLabs"
                    ? pendingLabReportsCount
                    : undefined;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => item.href && router.push(item.href)}
              disabled={!item.href}
              className={`nav-item ${active ? "active" : ""} ${!item.href ? "cursor-default opacity-60" : ""}`}
            >
              <Icon size={21} strokeWidth={1.8} />
              <span>{t(item.key)}</span>
              {!!badgeCount && badgeCount > 0 && (
                <span className={`nav-badge ${item.badge === "prescriptions" ? "red" : "orange"}`}>
                  {badgeCount}
                </span>
              )}
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
  );
}
