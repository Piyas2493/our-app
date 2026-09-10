"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Clock3,
  FileText,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Users,
} from "lucide-react";

import LogoutButton from "@/components/LogoutButton";

/* =========================================================
   TYPES
   ========================================================= */

type Overview = {
  users: {
    total: number;
    patients: number;
    clinicians: number;
    helpdesk: number;
    admins: number;
  };
  records: {
    total: number;
    pending: number;
    verified: number;
    rejected: number;
  };
  tickets: {
    total: number;
    open: number;
    active: number;
    waiting: number;
    resolved: number;
    closed: number;
    pendingCallbacks: number;
  };
  consent: {
    totalEvents: number;
  };
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
  }>;
  recentRecords: Array<{
    id: string;
    patientName: string;
    documentType: string;
    status: string;
    createdAt: string;
  }>;
  recentTickets: Array<{
    id: string;
    ticketNumber: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
    requester: { name: string; role: string };
  }>;
};

const ROLE_STYLES: Record<string, string> = {
  PATIENT: "bg-teal-50 text-teal-700",
  CLINICIAN: "bg-violet-50 text-violet-700",
  HELPDESK: "bg-amber-50 text-amber-700",
  ADMIN: "bg-slate-100 text-slate-600",
};

const RECORD_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  VERIFIED: "bg-teal-50 text-teal-700",
  REJECTED: "bg-rose-50 text-rose-700",
};

const TICKET_STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700",
  ASSIGNED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700",
  WAITING: "bg-slate-100 text-slate-600",
  RESOLVED: "bg-teal-50 text-teal-700",
  CLOSED: "bg-slate-200 text-slate-500",
};

/* =========================================================
   PAGE
   ========================================================= */

export default function AdminPage() {
  const router = useRouter();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadOverview(showRefresh = false) {
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

      if (session.user.role !== "ADMIN") {
        const fallback =
          session.user.role === "CLINICIAN"
            ? "/clinician"
            : session.user.role === "HELPDESK"
              ? "/helpdesk"
              : "/dashboard";
        router.replace(fallback);
        return;
      }

      const response = await fetch("/api/admin/overview", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to load the admin overview.");
      }

      setOverview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the admin overview.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

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

  if (loading || !overview) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6f7]">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw size={20} className="animate-spin" />
          Loading the admin overview…
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
                <LayoutDashboard size={25} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
                  Admin Workspace
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight lg:text-4xl">
                  Operational overview
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void loadOverview(true)}
                disabled={refreshing}
                className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
                Refresh
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

        {/* USER COUNTS */}
        <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Users size={21} />}
            iconClass="bg-teal-50 text-teal-700"
            label="Patients"
            value={overview.users.patients}
          />
          <StatCard
            icon={<Stethoscope size={21} />}
            iconClass="bg-violet-50 text-violet-700"
            label="Clinicians"
            value={overview.users.clinicians}
          />
          <StatCard
            icon={<LifeBuoy size={21} />}
            iconClass="bg-amber-50 text-amber-700"
            label="Helpdesk staff"
            value={overview.users.helpdesk}
          />
          <StatCard
            icon={<ShieldCheck size={21} />}
            iconClass="bg-slate-100 text-slate-600"
            label="Total users"
            value={overview.users.total}
          />
        </section>

        {/* RECORDS + TICKETS */}
        <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<FileText size={21} />}
            iconClass="bg-sky-50 text-sky-700"
            label="Total health records"
            value={overview.records.total}
            sublabel={`${overview.records.pending} pending · ${overview.records.verified} verified`}
          />
          <StatCard
            icon={<UserCheck size={21} />}
            iconClass="bg-rose-50 text-rose-700"
            label="Rejected / correction"
            value={overview.records.rejected}
          />
          <StatCard
            icon={<Inbox size={21} />}
            iconClass="bg-indigo-50 text-indigo-700"
            label="Open + active tickets"
            value={overview.tickets.open + overview.tickets.active}
            sublabel={`${overview.tickets.waiting} waiting on requester`}
          />
          <StatCard
            icon={<PhoneCall size={21} />}
            iconClass="bg-amber-50 text-amber-700"
            label="Callbacks pending"
            value={overview.tickets.pendingCallbacks}
          />
        </section>

        {/* RECENT ACTIVITY */}
        <div className="grid gap-5 xl:grid-cols-3">
          <ActivityCard title="Recent signups" icon={<Users size={18} />}>
            {overview.recentUsers.length === 0 ? (
              <EmptyRow />
            ) : (
              overview.recentUsers.map((item) => (
                <div key={item.id} className="border-b border-slate-100 py-3 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_STYLES[item.role] || "bg-slate-100 text-slate-500"}`}
                    >
                      {item.role}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {item.email} · {formatDate(item.createdAt)}
                  </p>
                </div>
              ))
            )}
          </ActivityCard>

          <ActivityCard title="Recent health records" icon={<FileText size={18} />}>
            {overview.recentRecords.length === 0 ? (
              <EmptyRow />
            ) : (
              overview.recentRecords.map((item) => (
                <div key={item.id} className="border-b border-slate-100 py-3 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {item.patientName}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${RECORD_STATUS_STYLES[item.status] || "bg-slate-100 text-slate-500"}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {item.documentType} · {formatDate(item.createdAt)}
                  </p>
                </div>
              ))
            )}
          </ActivityCard>

          <ActivityCard title="Recent tickets" icon={<LifeBuoy size={18} />}>
            {overview.recentTickets.length === 0 ? (
              <EmptyRow />
            ) : (
              overview.recentTickets.map((item) => (
                <div key={item.id} className="border-b border-slate-100 py-3 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">{item.subject}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TICKET_STATUS_STYLES[item.status] || "bg-slate-100 text-slate-500"}`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {item.ticketNumber} · {item.requester.name} · {formatDate(item.createdAt)}
                  </p>
                </div>
              ))
            )}
          </ActivityCard>
        </div>

        <p className="mt-7 flex items-center gap-2 text-xs text-slate-400">
          <Ban size={13} />
          Read-only monitoring. Account and record actions are handled from the
          patient, clinician and helpdesk workspaces themselves.
        </p>
      </div>
    </main>
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

function StatCard({
  icon,
  iconClass,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: number;
  sublabel?: string;
}) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className={`inline-flex rounded-2xl p-3 ${iconClass}`}>{icon}</div>
      <p className="mt-5 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
      {sublabel && <p className="mt-1 text-xs text-slate-400">{sublabel}</p>}
    </div>
  );
}

function ActivityCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <div className="rounded-xl bg-slate-50 p-2 text-slate-600">{icon}</div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function EmptyRow() {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
      <Clock3 size={15} />
      No activity yet.
    </div>
  );
}
