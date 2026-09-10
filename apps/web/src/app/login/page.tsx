"use client";

import {
  FormEvent,
  ReactNode,
  useState,
} from "react";

import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  UsersRound,
} from "lucide-react";

import Link from "next/link";
import { useRouter } from "next/navigation";

type UserRole = "PATIENT" | "CLINICIAN" | "HELPDESK" | "ADMIN";

type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [selectedRole, setSelectedRole] =
    useState<UserRole>("PATIENT");

  const [showDemoAccounts, setShowDemoAccounts] =
    useState(false);

  /* =========================================================
     LOGIN
     ========================================================= */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      let result: any = null;

      try {
        result =
          await response.json();
      } catch {
        throw new Error(
          "The server returned an invalid response."
        );
      }

      if (
        !response.ok ||
        !result?.success
      ) {
        throw new Error(
          result?.error ||
            "Invalid email or password."
        );
      }

      const user =
        result.user as SessionUser;

      if (
        user.role === "CLINICIAN"
      ) {
        router.replace(
          "/clinician"
        );
      } else if (
        user.role === "HELPDESK"
      ) {
        router.replace(
          "/helpdesk"
        );
      } else if (
        user.role === "ADMIN"
      ) {
        router.replace(
          "/admin"
        );
      } else {
        router.replace(
          "/dashboard"
        );
      }

      router.refresh();
    } catch (loginError) {
      console.error(
        "Login failed:",
        loginError
      );

      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     DEMO ACCOUNT
     ========================================================= */

  function fillDemoAccount(
    role: UserRole
  ) {
    setSelectedRole(role);
    setError("");

    if (
      role === "PATIENT"
    ) {
      setEmail(
        "patient@jeevanlink.local"
      );
      setPassword(
        "Patient@123"
      );
    } else if (
      role === "CLINICIAN"
    ) {
      setEmail(
        "clinician@jeevanlink.local"
      );
      setPassword(
        "Clinician@123"
      );
    } else if (
      role === "HELPDESK"
    ) {
      setEmail(
        "helpdesk@jeevanlink.local"
      );
      setPassword(
        "Helpdesk@123"
      );
    } else {
      setEmail(
        "admin@jeevanlink.local"
      );
      setPassword(
        "Admin@123"
      );
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#eef8f6] text-slate-900">

      {/* =====================================================
          BACKGROUND
          ===================================================== */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">

        <div className="absolute -left-48 -top-48 h-[520px] w-[520px] rounded-full bg-teal-300/20 blur-3xl" />

        <div className="absolute -right-48 top-[20%] h-[600px] w-[600px] rounded-full bg-cyan-200/25 blur-3xl" />

        <div className="absolute bottom-[-250px] left-[30%] h-[600px] w-[600px] rounded-full bg-emerald-200/20 blur-3xl" />

        <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(15,118,110,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(15,118,110,0.18)_1px,transparent_1px)] [background-size:48px_48px]" />

      </div>

      {/* =====================================================
          HEADER
          ===================================================== */}

      <header className="relative z-30 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8">

        <Link
          href="/"
          className="group flex items-center gap-3"
        >

          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[#087f73] text-white shadow-lg shadow-teal-900/20 transition duration-300 group-hover:scale-105">

            <HeartPulse
              size={24}
              strokeWidth={2.4}
            />

            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#eef8f6]" />

          </div>

          <div>

            <div className="text-lg font-bold tracking-tight">
              JeevanLink
            </div>

            <div className="text-[10px] font-semibold uppercase tracking-[0.20em] text-slate-500">
              Connected Healthcare
            </div>

          </div>

        </Link>

        <div className="hidden items-center gap-2 rounded-full border border-white/90 bg-white/85 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm backdrop-blur md:flex">

          <ShieldCheck
            size={15}
            className="text-emerald-600"
          />

          Secure session

        </div>

      </header>

      {/* =====================================================
          CONTENT
          ===================================================== */}

      <div className="relative z-10 mx-auto max-w-7xl px-5 pb-8 md:px-8">

        <div className="grid items-stretch gap-7 lg:grid-cols-[1.04fr_0.96fr]">

          {/* =================================================
              HERO PANEL
              ================================================= */}

          <section className="relative hidden min-h-[760px] overflow-hidden rounded-[38px] border border-white/90 bg-gradient-to-br from-[#f8fffd] via-[#eefaf8] to-[#d8f0ed] shadow-2xl shadow-teal-950/5 lg:block">

            {/* ambient shapes */}

            <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-white/70 blur-3xl" />

            <div className="absolute -left-28 top-[40%] h-72 w-72 rounded-full bg-cyan-200/20 blur-3xl" />

            <div className="absolute right-6 top-24 grid grid-cols-5 gap-2 opacity-30">

              {Array.from({
                length: 25,
              }).map((_, index) => (
                <span
                  key={index}
                  className="h-1.5 w-1.5 rounded-full bg-teal-500"
                />
              ))}

            </div>

            {/* decorative pluses */}

            <PlusMark className="left-[63%] top-[16%]" />

            <PlusMark className="left-[52%] top-[48%]" />

            <PlusMark className="right-[20%] top-[29%]" />

            {/* =================================================
                TOP COPY
                ================================================= */}

            <div className="relative z-20 px-10 pt-10 xl:px-12 xl:pt-12">

              <div className="inline-flex items-center gap-2 rounded-full border border-white bg-white/90 px-4 py-2 text-xs font-bold text-teal-800 shadow-sm backdrop-blur">

                <Sparkles
                  size={14}
                />

                AI-powered healthcare

              </div>

              <h1 className="mt-7 max-w-[560px] text-[54px] font-semibold leading-[0.98] tracking-tight text-slate-900 xl:text-[64px]">

                Your health.

                <br />

                <span className="text-teal-700">
                  Our priority.
                </span>

              </h1>

              <p className="mt-6 max-w-[520px] text-[17px] leading-7 text-slate-600">

                AI-assisted platform that transforms
                medical documents into verified,
                trusted health records.

              </p>

            </div>

            {/* =================================================
                FEATURE CARDS
                ================================================= */}

            <div className="absolute right-8 top-[260px] z-30 w-[245px] space-y-4">

              <HeroFeatureCard
                icon={
                  <Sparkles
                    size={24}
                  />
                }
                iconClass="bg-violet-50 text-violet-600"
                title="AI Extraction"
                text="Smart document analysis"
              />

              <HeroFeatureCard
                icon={
                  <UserRound
                    size={24}
                  />
                }
                iconClass="bg-blue-50 text-blue-600"
                title="Human Verification"
                text="Clinician review before approval"
              />

              <HeroFeatureCard
                icon={
                  <ShieldCheck
                    size={24}
                  />
                }
                iconClass="bg-emerald-50 text-emerald-700"
                title="Trusted Records"
                text="Secure, accurate and accessible"
              />

            </div>

            {/* =================================================
                DOCTOR IMAGE
                ================================================= */}

            <div className="absolute bottom-0 left-0 z-10 h-[56%] w-[66%] overflow-hidden">

              <img
                src="/login-doctor.png"
                alt="Healthcare professional"
                className="h-full w-full object-cover object-center"
              />

            </div>

            {/* image fade */}

            <div className="absolute bottom-0 left-0 z-20 h-[190px] w-full bg-gradient-to-t from-[#d8f0ed] via-[#d8f0ed]/60 to-transparent" />

            {/* =================================================
                BOTTOM TRUST PANEL
                ================================================= */}

            <div className="absolute bottom-7 left-7 right-7 z-40 grid grid-cols-4 gap-2 rounded-3xl border border-white/90 bg-white/90 p-3 shadow-xl backdrop-blur-xl">

              <HeroTrust
                icon={
                  <ShieldCheck
                    size={20}
                  />
                }
                title="Secure"
                subtitle="Protected"
              />

              <HeroTrust
                icon={
                  <UserRound
                    size={20}
                  />
                }
                title="Verified"
                subtitle="Clinician"
              />

              <HeroTrust
                icon={
                  <Sparkles
                    size={20}
                  />
                }
                title="AI Powered"
                subtitle="Smart"
              />

              <HeroTrust
                icon={
                  <FileCheck2
                    size={20}
                  />
                }
                title="Connected"
                subtitle="Complete"
              />

            </div>

          </section>

          {/* =================================================
              LOGIN CARD
              ================================================= */}

          <section className="flex items-center">

            <div className="w-full rounded-[38px] border border-white/90 bg-white p-7 shadow-2xl shadow-slate-900/10 sm:p-9 lg:p-10 xl:p-11">

              {/* mobile header */}

              <div className="flex items-center justify-between lg:hidden">

                <Link
                  href="/"
                  className="flex items-center gap-2"
                >

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white">

                    <HeartPulse
                      size={20}
                    />

                  </div>

                  <span className="font-bold">
                    JeevanLink
                  </span>

                </Link>

                <span className="rounded-full bg-teal-50 px-3 py-1.5 text-[10px] font-semibold text-teal-700">
                  Secure
                </span>

              </div>

              {/* =================================================
                  LOGIN HEADING
                  ================================================= */}

              <div className="mt-7 text-center lg:mt-0">

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 shadow-sm">

                  <HeartPulse
                    size={27}
                  />

                </div>

                <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
                  Secure sign in
                </p>

                <h2 className="mt-3 text-[34px] font-semibold tracking-tight text-slate-900">

                  Welcome back

                  <span className="ml-1">
                    👋
                  </span>

                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Sign in to continue to your JeevanLink workspace.
                </p>

              </div>

              {/* =================================================
                  ROLE
                  ================================================= */}

              <div className="mt-7 grid grid-cols-2 gap-3">

                <RoleCard
                  active={
                    selectedRole ===
                    "PATIENT"
                  }
                  icon={
                    <UserRound
                      size={23}
                    />
                  }
                  title="Patient"
                  description="Access your health records"
                  onClick={() => {
                    setSelectedRole(
                      "PATIENT"
                    );
                    setError("");
                  }}
                />

                <RoleCard
                  active={
                    selectedRole ===
                    "CLINICIAN"
                  }
                  icon={
                    <Stethoscope
                      size={23}
                    />
                  }
                  title="Clinician"
                  description="Verify patient records"
                  onClick={() => {
                    setSelectedRole(
                      "CLINICIAN"
                    );
                    setError("");
                  }}
                />

                <RoleCard
                  active={
                    selectedRole ===
                    "HELPDESK"
                  }
                  icon={
                    <LifeBuoy
                      size={23}
                    />
                  }
                  title="Helpdesk"
                  description="Support ticket queue"
                  onClick={() => {
                    setSelectedRole(
                      "HELPDESK"
                    );
                    setError("");
                  }}
                />

                <RoleCard
                  active={
                    selectedRole ===
                    "ADMIN"
                  }
                  icon={
                    <LayoutDashboard
                      size={23}
                    />
                  }
                  title="Admin"
                  description="Operational overview"
                  onClick={() => {
                    setSelectedRole(
                      "ADMIN"
                    );
                    setError("");
                  }}
                />

              </div>

              {/* =================================================
                  ERROR
                  ================================================= */}

              {error && (

                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">

                  <p className="text-sm font-medium text-red-700">
                    {error}
                  </p>

                </div>

              )}

              {/* =================================================
                  FORM
                  ================================================= */}

              <form
                onSubmit={
                  handleSubmit
                }
                className="mt-6 space-y-5"
              >

                <div>

                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Email address
                  </label>

                  <div className="relative">

                    <Mail
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(
                          event.target.value
                        );
                        setError("");
                      }}
                      placeholder="you@example.com"
                      disabled={loading}
                      required
                      className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 text-sm outline-none transition duration-200 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-50 disabled:opacity-60"
                    />

                  </div>

                </div>

                <div>

                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Password
                  </label>

                  <div className="relative">

                    <LockKeyhole
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => {
                        setPassword(
                          event.target.value
                        );
                        setError("");
                      }}
                      placeholder="Enter your password"
                      disabled={loading}
                      required
                      className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-12 text-sm outline-none transition duration-200 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-50 disabled:opacity-60"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (current) =>
                            !current
                        )
                      }
                      disabled={loading}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >

                      {showPassword ? (
                        <EyeOff
                          size={18}
                        />
                      ) : (
                        <Eye
                          size={18}
                        />
                      )}

                    </button>

                  </div>

                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500">

                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                  />

                  Remember me

                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#087f73] font-semibold text-white shadow-lg shadow-teal-800/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#076e64] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                >

                  {loading ? (
                    <>
                      <Loader2
                        size={19}
                        className="animate-spin"
                      />

                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in securely

                      <ArrowRight
                        size={19}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </>
                  )}

                </button>

              </form>

              {/* =================================================
                  DEMO ACCOUNTS
                  ================================================= */}

              <div className="mt-6">

                <button
                  type="button"
                  onClick={() =>
                    setShowDemoAccounts(
                      (current) =>
                        !current
                    )
                  }
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-left transition hover:bg-slate-100"
                >

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm">

                      <UsersRound
                        size={18}
                      />

                    </div>

                    <div>

                      <p className="text-sm font-semibold text-slate-700">
                        Try demo accounts
                      </p>

                      <p className="text-xs text-slate-500">
                        Fill local test credentials automatically
                      </p>

                    </div>

                  </div>

                  <ArrowRight
                    size={17}
                    className={`text-slate-400 transition-transform ${
                      showDemoAccounts
                        ? "rotate-90"
                        : ""
                    }`}
                  />

                </button>

                {showDemoAccounts && (

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">

                    <button
                      type="button"
                      onClick={() =>
                        fillDemoAccount(
                          "PATIENT"
                        )
                      }
                      className={`rounded-2xl border p-4 text-left transition ${
                        selectedRole ===
                        "PATIENT"
                          ? "border-teal-200 bg-teal-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >

                      <div className="flex items-center gap-2">

                        <UserRound
                          size={17}
                          className="text-teal-700"
                        />

                        <span className="text-xs font-bold uppercase tracking-wide text-teal-700">
                          Patient Demo
                        </span>

                      </div>

                      <p className="mt-3 break-all text-xs font-medium text-slate-700">
                        patient@jeevanlink.local
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Password: Patient@123
                      </p>

                      <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-teal-700">
                        Use demo
                        <ArrowRight size={13} />
                      </p>

                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        fillDemoAccount(
                          "CLINICIAN"
                        )
                      }
                      className={`rounded-2xl border p-4 text-left transition ${
                        selectedRole ===
                        "CLINICIAN"
                          ? "border-violet-200 bg-violet-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >

                      <div className="flex items-center gap-2">

                        <Stethoscope
                          size={17}
                          className="text-violet-700"
                        />

                        <span className="text-xs font-bold uppercase tracking-wide text-violet-700">
                          Clinician Demo
                        </span>

                      </div>

                      <p className="mt-3 break-all text-xs font-medium text-slate-700">
                        clinician@jeevanlink.local
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Password: Clinician@123
                      </p>

                      <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-violet-700">
                        Use demo
                        <ArrowRight size={13} />
                      </p>

                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        fillDemoAccount(
                          "HELPDESK"
                        )
                      }
                      className={`rounded-2xl border p-4 text-left transition ${
                        selectedRole ===
                        "HELPDESK"
                          ? "border-amber-200 bg-amber-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >

                      <div className="flex items-center gap-2">

                        <LifeBuoy
                          size={17}
                          className="text-amber-700"
                        />

                        <span className="text-xs font-bold uppercase tracking-wide text-amber-700">
                          Helpdesk Demo
                        </span>

                      </div>

                      <p className="mt-3 break-all text-xs font-medium text-slate-700">
                        helpdesk@jeevanlink.local
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Password: Helpdesk@123
                      </p>

                      <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-amber-700">
                        Use demo
                        <ArrowRight size={13} />
                      </p>

                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        fillDemoAccount(
                          "ADMIN"
                        )
                      }
                      className={`rounded-2xl border p-4 text-left transition ${
                        selectedRole ===
                        "ADMIN"
                          ? "border-slate-300 bg-slate-100"
                          : "border-slate-200 bg-white"
                      }`}
                    >

                      <div className="flex items-center gap-2">

                        <LayoutDashboard
                          size={17}
                          className="text-slate-700"
                        />

                        <span className="text-xs font-bold uppercase tracking-wide text-slate-700">
                          Admin Demo
                        </span>

                      </div>

                      <p className="mt-3 break-all text-xs font-medium text-slate-700">
                        admin@jeevanlink.local
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Password: Admin@123
                      </p>

                      <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-700">
                        Use demo
                        <ArrowRight size={13} />
                      </p>

                    </button>

                  </div>

                )}

              </div>

              {/* =================================================
                  TRUST
                  ================================================= */}

              <div className="mt-7 grid grid-cols-3 gap-3 border-t border-slate-100 pt-6">

                <TrustItem
                  icon={
                    <ShieldCheck
                      size={17}
                    />
                  }
                  title="Protected"
                  text="Secure sessions"
                />

                <TrustItem
                  icon={
                    <Activity
                      size={17}
                    />
                  }
                  title="Connected"
                  text="Health workflow"
                />

                <TrustItem
                  icon={
                    <FileCheck2
                      size={17}
                    />
                  }
                  title="Verified"
                  text="Human review"
                />

              </div>

              <p className="mt-6 text-center text-[11px] leading-5 text-slate-400">

                Development environment only.

                <br />

                Demo credentials should never be used in production.

              </p>

            </div>

          </section>

        </div>

      </div>

      {/* =====================================================
          ANIMATION
          ===================================================== */}

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }

          50% {
            transform: translateY(-8px);
          }
        }
      `}</style>

    </main>
  );
}

/* ===========================================================
   PLUS MARK
   =========================================================== */

function PlusMark({
  className,
}: {
  className: string;
}) {
  return (
    <div
      className={`absolute z-10 text-5xl font-light text-teal-300/60 ${className}`}
    >
      +
    </div>
  );
}

/* ===========================================================
   HERO FEATURE
   =========================================================== */

function HeroFeatureCard({
  icon,
  iconClass,
  title,
  text,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  text: string;
}) {
  return (
    <div
      className="rounded-2xl border border-white/90 bg-white/90 p-4 shadow-xl backdrop-blur-md"
    >

      <div className="flex items-start gap-3">

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}
        >
          {icon}
        </div>

        <div className="min-w-0">

          <div className="flex items-center gap-2">

            <p className="text-sm font-bold text-slate-800">
              {title}
            </p>

            <CheckCircle2
              size={15}
              className="text-emerald-600"
            />

          </div>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {text}
          </p>

        </div>

      </div>

    </div>
  );
}

/* ===========================================================
   HERO TRUST
   =========================================================== */

function HeroTrust({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-white/80 p-2.5">

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">

        {icon}

      </div>

      <div className="min-w-0">

        <p className="truncate text-xs font-bold text-slate-800">
          {title}
        </p>

        <p className="truncate text-[10px] text-slate-400">
          {subtitle}
        </p>

      </div>

    </div>
  );
}

/* ===========================================================
   ROLE CARD
   =========================================================== */

function RoleCard({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border p-4 text-left transition-all duration-300 ${
        active
          ? "border-teal-400 bg-teal-50 shadow-md shadow-teal-900/5"
          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
      }`}
    >

      <div className="flex items-start justify-between">

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
            active
              ? "bg-teal-700 text-white"
              : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
          }`}
        >
          {icon}
        </div>

        {active && (
          <CheckCircle2
            size={18}
            className="text-teal-700"
          />
        )}

      </div>

      <p className="mt-4 text-sm font-bold text-slate-800">
        {title}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </p>

    </button>
  );
}

/* ===========================================================
   TRUST ITEM
   =========================================================== */

function TrustItem({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="text-center">

      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">

        {icon}

      </div>

      <p className="mt-2 text-[11px] font-bold text-slate-700">
        {title}
      </p>

      <p className="mt-0.5 text-[10px] text-slate-400">
        {text}
      </p>

    </div>
  );
}