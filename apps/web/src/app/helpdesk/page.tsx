"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  Inbox,
  LifeBuoy,
  Lock,
  PhoneCall,
  RefreshCw,
  Send,
  UserPlus,
  UsersRound,
} from "lucide-react";

import LogoutButton from "@/components/LogoutButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";

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
  category: string;
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

const STATUS_FILTERS: Array<TicketStatus | "ALL"> = [
  "ALL",
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
];

const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: "bg-amber-50 text-amber-700",
  ASSIGNED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700",
  WAITING: "bg-slate-100 text-slate-600",
  RESOLVED: "bg-teal-50 text-teal-700",
  CLOSED: "bg-slate-200 text-slate-500",
};

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  LOW: "bg-slate-100 text-slate-500",
  NORMAL: "bg-slate-100 text-slate-600",
  HIGH: "bg-amber-50 text-amber-700",
  URGENT: "bg-rose-50 text-rose-700",
};

/* =========================================================
   PAGE
   ========================================================= */

export default function HelpdeskPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL");

  const [replyText, setReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [replying, setReplying] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function loadTickets(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
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

      if (session.user.role !== "HELPDESK") {
        router.replace(session.user.role === "CLINICIAN" ? "/clinician" : "/dashboard");
        return;
      }

      const response = await fetch("/api/tickets", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || t("helpdesk.errors.loadTicketsFailed"));
      }

      setTickets(result.tickets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("helpdesk.errors.loadTicketsFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        throw new Error(result?.error || t("helpdesk.errors.loadTicketFailed"));
      }

      setSelectedTicket(result.ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("helpdesk.errors.loadTicketFailed"));
    }
  }

  async function updateTicket(patch: Record<string, unknown>) {
    if (!selectedTicket) return;

    setUpdating(true);
    setError("");

    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || t("helpdesk.errors.updateFailed"));
      }

      await openTicket(selectedTicket.id);
      await loadTickets(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("helpdesk.errors.updateFailed"));
    } finally {
      setUpdating(false);
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
        body: JSON.stringify({ message: replyText, isInternalNote }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || t("helpdesk.errors.sendFailed"));
      }

      setReplyText("");
      setIsInternalNote(false);
      await openTicket(selectedTicket.id);
      await loadTickets(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("helpdesk.errors.sendFailed"));
    } finally {
      setReplying(false);
    }
  }

  const counts = useMemo(() => {
    const open = tickets.filter((t) => t.status === "OPEN").length;
    const active = tickets.filter(
      (t) => t.status === "ASSIGNED" || t.status === "IN_PROGRESS",
    ).length;
    const waiting = tickets.filter((t) => t.status === "WAITING").length;
    const resolved = tickets.filter(
      (t) => t.status === "RESOLVED" || t.status === "CLOSED",
    ).length;

    return { open, active, waiting, resolved };
  }, [tickets]);

  const filteredTickets = useMemo(
    () =>
      statusFilter === "ALL"
        ? tickets
        : tickets.filter((ticket) => ticket.status === statusFilter),
    [tickets, statusFilter],
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
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6f7]">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw size={20} className="animate-spin" />
          {t("helpdesk.loading")}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f6f7] text-slate-900">
      <div className="mx-auto max-w-[1800px] px-5 py-7 lg:px-7">
        <header className="mb-7">
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-teal-700 p-3 text-white shadow-sm">
                <LifeBuoy size={25} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
                  {t("helpdesk.eyebrow")}
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight lg:text-4xl">
                  {t("helpdesk.title")}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <LanguageSwitcher />

              <button
                type="button"
                onClick={() => void loadTickets(true)}
                disabled={refreshing}
                className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
                {t("helpdesk.refresh")}
              </button>

              <LogoutButton />
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                <Inbox size={21} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("helpdesk.stat.open")}
              </span>
            </div>
            <p className="mt-5 text-3xl font-semibold">{counts.open}</p>
            <p className="mt-1 text-sm text-slate-500">{t("helpdesk.stat.openSub")}</p>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700">
                <Clock3 size={21} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("helpdesk.stat.active")}
              </span>
            </div>
            <p className="mt-5 text-3xl font-semibold">{counts.active}</p>
            <p className="mt-1 text-sm text-slate-500">{t("helpdesk.stat.activeSub")}</p>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
                <UsersRound size={21} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("helpdesk.stat.waiting")}
              </span>
            </div>
            <p className="mt-5 text-3xl font-semibold">{counts.waiting}</p>
            <p className="mt-1 text-sm text-slate-500">{t("helpdesk.stat.waitingSub")}</p>
          </div>

          <div className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                <CheckCircle2 size={21} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("helpdesk.stat.resolved")}
              </span>
            </div>
            <p className="mt-5 text-3xl font-semibold">{counts.resolved}</p>
            <p className="mt-1 text-sm text-slate-500">{t("helpdesk.stat.resolvedSub")}</p>
          </div>
        </section>

        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                statusFilter === status
                  ? "border-teal-500 bg-teal-50 text-teal-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {status === "ALL" ? t("helpdesk.filterAll") : status.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-2">
            {filteredTickets.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-slate-400">
                {t("helpdesk.noTicketsInView")}
              </p>
            ) : (
              filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => void openTicket(ticket.id)}
                  className={`w-full rounded-2xl border bg-white p-4 text-left transition ${
                    selectedTicket?.id === ticket.id
                      ? "border-teal-500 bg-teal-50"
                      : "hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-400">
                      {ticket.ticketNumber}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLES[ticket.priority]}`}
                      >
                        {ticket.priority}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[ticket.status]}`}
                      >
                        {ticket.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1.5 font-medium text-slate-800">{ticket.subject}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {ticket.requester.name} ({ticket.requester.role}) · {formatDate(ticket.updatedAt)}
                  </p>
                  {ticket.assignedTo && (
                    <p className="mt-1 text-[11px] text-teal-700">
                      {t("helpdesk.assignedToPrefix")} {ticket.assignedTo.name}
                    </p>
                  )}
                  {ticket.callbackRequested && (
                    <p
                      className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        ticket.callbackCompletedAt
                          ? "bg-slate-100 text-slate-500"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      <PhoneCall size={11} />
                      {ticket.callbackCompletedAt
                        ? t("helpdesk.callbackDone")
                        : `${t("helpdesk.callRequested")} · ${ticket.callbackPhone}`}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>

          <div>
            {!selectedTicket ? (
              <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-dashed bg-white text-sm text-slate-400">
                {t("helpdesk.selectTicketHint")}
              </div>
            ) : (
              <div className="rounded-2xl border bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">
                      {selectedTicket.ticketNumber} · {selectedTicket.requester.name} (
                      {selectedTicket.requester.role})
                    </p>
                    <h3 className="mt-0.5 font-semibold text-slate-800">
                      {selectedTicket.subject}
                    </h3>
                    {selectedTicket.callbackRequested && (
                      <p
                        className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          selectedTicket.callbackCompletedAt
                            ? "bg-slate-100 text-slate-500"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        <PhoneCall size={13} />
                        {t("helpdesk.callPrefix")} {selectedTicket.callbackPhone}
                        {selectedTicket.callbackCompletedAt ? ` · ${t("helpdesk.done")}` : ` · ${t("helpdesk.pending")}`}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedTicket.callbackRequested && !selectedTicket.callbackCompletedAt && (
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() => void updateTicket({ markCallbackDone: true })}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        <PhoneCall size={13} />
                        {t("helpdesk.markAsCalled")}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={updating || Boolean(selectedTicket.assignedTo)}
                      onClick={() => void updateTicket({ assignToSelf: true })}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <UserPlus size={13} />
                      {selectedTicket.assignedTo
                        ? `${t("helpdesk.assignedToPrefix")} ${selectedTicket.assignedTo.name}`
                        : t("helpdesk.assignToMe")}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    {t("helpdesk.statusLabel")}
                    <select
                      value={selectedTicket.status}
                      disabled={updating}
                      onChange={(event) => void updateTicket({ status: event.target.value })}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-teal-500"
                    >
                      {(["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"] as TicketStatus[]).map(
                        (status) => (
                          <option key={status} value={status}>
                            {status.replace("_", " ")}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    {t("helpdesk.priorityLabel")}
                    <select
                      value={selectedTicket.priority}
                      disabled={updating}
                      onChange={(event) => void updateTicket({ priority: event.target.value })}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-teal-500"
                    >
                      {(["LOW", "NORMAL", "HIGH", "URGENT"] as TicketPriority[]).map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 max-h-[340px] space-y-3 overflow-y-auto pr-1">
                  {(selectedTicket.messages || []).map((message) => {
                    const isHelpdeskReply = message.author.role === "HELPDESK";

                    return (
                      <div
                        key={message.id}
                        className={`rounded-xl p-3 text-sm ${
                          message.isInternalNote
                            ? "border border-dashed border-amber-300 bg-amber-50 text-amber-900"
                            : isHelpdeskReply
                              ? "bg-teal-50 text-teal-900"
                              : "bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-400">
                          <span className="flex items-center gap-1">
                            {message.isInternalNote && <Lock size={11} />}
                            {message.author.name}
                            {isHelpdeskReply ? ` · ${t("helpdesk.helpdeskSuffix")}` : ""}
                            {message.isInternalNote ? ` · ${t("helpdesk.internalNoteSuffix")}` : ""}
                          </span>
                          <span>{formatDate(message.createdAt)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap leading-6">{message.body}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    rows={2}
                    placeholder={t("helpdesk.replyPlaceholder")}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(event) => setIsInternalNote(event.target.checked)}
                      />
                      {t("helpdesk.internalNoteCheckbox")}
                    </label>

                    <button
                      type="button"
                      disabled={replying || !replyText.trim()}
                      onClick={() => void sendReply()}
                      className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                    >
                      {replying ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                      {t("helpdesk.send")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
