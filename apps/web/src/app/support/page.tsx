"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  BrainCircuit,
  Building2,
  CheckCircle2,
  FileText,
  HeartPulse,
  LifeBuoy,
  Link2,
  Mic,
  PhoneCall,
  Pill,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import MobileSidebarToggle from "@/components/MobileSidebarToggle";

/* =========================================================
   TYPES
   ========================================================= */

type TicketStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING"
  | "RESOLVED"
  | "CLOSED";

type TicketCategory =
  | "ACCOUNT"
  | "APPOINTMENT"
  | "TECHNICAL"
  | "RECORD_CORRECTION"
  | "BILLING"
  | "OTHER";

type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

type TicketMessage = {
  id: string;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
  author: { id: string; name: string; role: string };
};

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  requester: { id: string; name: string; role: string };
  assignedTo: { id: string; name: string } | null;
  callbackRequested: boolean;
  callbackPhone: string | null;
  callbackCompletedAt: string | null;
  messages?: TicketMessage[];
  _count?: { messages: number };
};

const CATEGORY_OPTIONS: TicketCategory[] = [
  "ACCOUNT",
  "APPOINTMENT",
  "TECHNICAL",
  "RECORD_CORRECTION",
  "BILLING",
  "OTHER",
];

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ACCOUNT: "Account",
  APPOINTMENT: "Appointment",
  TECHNICAL: "Technical issue",
  RECORD_CORRECTION: "Record correction",
  BILLING: "Billing",
  OTHER: "Other",
};

const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: "bg-amber-50 text-amber-700",
  ASSIGNED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700",
  WAITING: "bg-slate-100 text-slate-600",
  RESOLVED: "bg-teal-50 text-teal-700",
  CLOSED: "bg-slate-200 text-slate-500",
};

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
  { label: "FHIR / ABDM", icon: Workflow },
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

export default function SupportPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("Patient");

  const [showNewTicket, setShowNewTicket] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TicketCategory>("OTHER");
  const [priority, setPriority] = useState<TicketPriority>("NORMAL");
  const [callbackRequested, setCallbackRequested] = useState(false);
  const [callbackPhone, setCallbackPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  async function loadTickets() {
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

      if (session.user.role === "HELPDESK") {
        router.replace("/helpdesk");
        return;
      }

      setUserName(session.user.name || "Patient");

      const response = await fetch("/api/tickets", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to load tickets.");
      }

      setTickets(result.tickets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tickets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
  }, []);

  async function openTicket(id: string) {
    setError("");

    try {
      const response = await fetch(`/api/tickets/${id}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to load ticket.");
      }

      setSelectedTicket(result.ticket);
      setShowNewTicket(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load ticket.");
    }
  }

  async function submitTicket() {
    if (!subject.trim() || !description.trim()) {
      setError("Subject and description are required.");
      return;
    }

    if (callbackRequested && !callbackPhone.trim()) {
      setError("A phone number is required to request a callback.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          description,
          category,
          priority,
          callbackRequested,
          callbackPhone: callbackRequested ? callbackPhone : undefined,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to submit ticket.");
      }

      setSubject("");
      setDescription("");
      setCategory("OTHER");
      setPriority("NORMAL");
      setCallbackRequested(false);
      setCallbackPhone("");
      setShowNewTicket(false);

      await loadTickets();
      await openTicket(result.ticket.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply() {
    if (!selectedTicket || !replyText.trim()) return;

    setReplying(true);
    setError("");

    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to send message.");
      }

      setReplyText("");
      await openTicket(selectedTicket.id);
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.");
    } finally {
      setReplying(false);
    }
  }

  const openCount = useMemo(
    () =>
      tickets.filter((ticket) => ticket.status !== "RESOLVED" && ticket.status !== "CLOSED")
        .length,
    [tickets],
  );

  function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
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
            Loading your support tickets…
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
                  item.label === "Help & Support" ? "active" : ""
                } ${!linked ? "cursor-default opacity-60" : ""}`}
              >
                <Icon size={21} strokeWidth={1.8} />
                <span>{getNavLabel(item.label, t)}</span>
                {item.label === "Help & Support" && openCount > 0 && (
                  <span className="nav-badge orange">{openCount}</span>
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

      <section className="main-content">
        <header className="topbar relative z-10">
          <div className="breadcrumb">
            <MobileSidebarToggle />
            <span>JeevanLink</span>
            <span className="chevron">›</span>
            <strong>{t("nav.support")}</strong>
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Help & Support
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Raise a ticket for account, appointment, technical, billing, or record-correction
                issues. A helpdesk agent will respond here.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowNewTicket((current) => !current);
                setSelectedTicket(null);
              }}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
            >
              <Plus size={16} />
              New ticket
            </button>
          </div>

          {error && (
            <div className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          )}

          {showNewTicket && (
            <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50/40 p-5">
              <h3 className="font-semibold text-slate-800">Raise a new ticket</h3>

              <div className="mt-4 grid gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Subject
                  </span>
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Short summary of the issue"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Description
                  </span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    placeholder="Describe what happened, and what you expected instead…"
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Category
                    </span>
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value as TicketCategory)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {CATEGORY_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Priority
                    </span>
                    <select
                      value={priority}
                      onChange={(event) => setPriority(event.target.value as TicketPriority)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    >
                      {PRIORITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option.charAt(0) + option.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={callbackRequested}
                      onChange={(event) => setCallbackRequested(event.target.checked)}
                    />
                    <PhoneCall size={15} className="text-teal-700" />
                    Request a callback instead of waiting for a reply here
                  </label>

                  {callbackRequested && (
                    <input
                      type="tel"
                      value={callbackPhone}
                      onChange={(event) => setCallbackPhone(event.target.value)}
                      placeholder="Phone number to call"
                      className="mt-3 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewTicket(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void submitTicket()}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="space-y-2">
              {tickets.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                  No support tickets yet.
                </p>
              ) : (
                tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => void openTicket(ticket.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedTicket?.id === ticket.id
                        ? "border-teal-500 bg-teal-50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-400">
                        {ticket.ticketNumber}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[ticket.status]}`}
                      >
                        {ticket.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1.5 font-medium text-slate-800">{ticket.subject}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{ticket.description}</p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      {CATEGORY_LABELS[ticket.category]} · {formatDate(ticket.updatedAt)}
                    </p>
                    {ticket.callbackRequested && (
                      <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                        <PhoneCall size={11} />
                        {ticket.callbackCompletedAt ? "Callback completed" : "Callback requested"}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>

            <div>
              {!selectedTicket ? (
                <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">
                  Select a ticket to view the conversation.
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-400">
                        {selectedTicket.ticketNumber}
                      </p>
                      <h3 className="font-semibold text-slate-800">{selectedTicket.subject}</h3>
                      {selectedTicket.callbackRequested && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                          <PhoneCall size={12} />
                          {selectedTicket.callbackPhone}
                          {selectedTicket.callbackCompletedAt ? " · Called" : " · Callback pending"}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[selectedTicket.status]}`}
                    >
                      {selectedTicket.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                    {(selectedTicket.messages || []).map((message) => {
                      const isHelpdeskReply = message.author.role === "HELPDESK";

                      return (
                        <div
                          key={message.id}
                          className={`rounded-xl p-3 text-sm ${
                            isHelpdeskReply ? "bg-teal-50 text-teal-900" : "bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-400">
                            <span>
                              {message.author.name}
                              {message.author.role === "HELPDESK" ? " · Helpdesk" : ""}
                            </span>
                            <span>{formatDate(message.createdAt)}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap leading-6">{message.body}</p>
                        </div>
                      );
                    })}
                  </div>

                  {selectedTicket.status !== "CLOSED" ? (
                    <div className="mt-4 flex items-end gap-2 border-t border-slate-100 pt-4">
                      <textarea
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        rows={2}
                        placeholder="Write a reply…"
                        className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      />
                      <button
                        type="button"
                        disabled={replying || !replyText.trim()}
                        onClick={() => void sendReply()}
                        className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                      >
                        {replying ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400">
                      <CheckCircle2 size={14} />
                      This ticket is closed.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
