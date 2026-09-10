"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Bell,
  BrainCircuit,
  Building2,
  FileText,
  HeartPulse,
  LifeBuoy,
  Link2,
  Mic,
  MicOff,
  Pill,
  RefreshCw,
  Send,
  ShieldCheck,
  UserCheck,
  Volume2,
  Workflow,
} from "lucide-react";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";

/* =========================================================
   TYPES
   ========================================================= */

type ConversationTurn = {
  id: string;
  question: string;
  answer: string;
  outOfScope: boolean;
};

const SUGGESTED_QUESTIONS = [
  "What medications am I currently on?",
  "What was my most recent vital reading?",
  "Do I have any pending health records?",
  "When is my next medication reminder?",
];

/* =========================================================
   NAVIGATION (mirrors the shared patient sidebar)
   ========================================================= */

const navItems = [
  { label: "Dashboard", icon: Activity, href: "/dashboard" },
  { label: "Health Records", icon: FileText, href: "/records" },
  { label: "Health Timeline", icon: Activity, href: "/health-timeline" },
  { label: "Prescriptions", icon: Pill, href: "/prescriptions" },
  { label: "AI Medical Scribe", icon: RefreshCw },
  { label: "Vitals", icon: HeartPulse, href: "/vitals" },
  { label: "Medication & Reminders", icon: Bell, href: "/medications" },
  { label: "Personalized Health", icon: BrainCircuit, href: "/personalized-health" },
  { label: "Hospitals & Labs", icon: Building2, href: "/hospitals-labs" },
  { label: "Voice Assistant", icon: Mic, href: "/voice-assistant" },
  { label: "Clinician Verification", icon: UserCheck },
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
    "AI Medical Scribe": t("nav.aiScribe"),
    "Vitals": t("nav.vitals"),
    "Medication & Reminders": t("nav.medications"),
    "Personalized Health": t("nav.personalizedHealth"),
    "Hospitals & Labs": t("nav.hospitalsLabs"),
    "Voice Assistant": t("nav.voiceAssistant"),
    "Clinician Verification": t("nav.clinician"),
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

  const lang = (typeof language === "string" ? language.split("-")[0] : "en") || "en";

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Patient");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [textInput, setTextInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const turnIdRef = useRef(0);

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

    setVoiceSupported(
      typeof window !== "undefined" &&
        typeof MediaRecorder !== "undefined" &&
        typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia),
    );

    return () => {
      mediaRecorderRef.current?.stop();
      audioPlaybackRef.current?.pause();
      audioPlaybackRef.current = null;
    };
  }, [router]);

  async function askQuestion(question: string) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || asking) return;

    setAsking(true);
    setError("");

    try {
      const response = await fetch("/api/voice-assistant/ask", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: cleanQuestion, language: lang }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to answer that right now.");
      }

      turnIdRef.current += 1;

      const turn: ConversationTurn = {
        id: `turn-${turnIdRef.current}`,
        question: cleanQuestion,
        answer: result.answer,
        outOfScope: Boolean(result.outOfScope),
      };

      setConversation((current) => [...current, turn]);
      setTextInput("");

      void speakAnswer(turn.id, result.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to answer that right now.");
    } finally {
      setAsking(false);
    }
  }

  async function speakAnswer(id: string, text: string) {
    try {
      audioPlaybackRef.current?.pause();
      setSpeakingId(id);

      const response = await fetch("/api/clinical-intake/speak", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: lang }),
      });

      if (!response.ok) {
        setSpeakingId(null);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioPlaybackRef.current = audio;

      audio.onended = () => setSpeakingId(null);
      audio.onerror = () => setSpeakingId(null);

      await audio.play();
    } catch {
      setSpeakingId(null);
    }
  }

  async function startVoice() {
    setError("");

    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Voice input is not available in this browser. Please type instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let mimeType = "";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        setListening(false);
        setError("Voice capture failed. Please try again or type your question.");
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        setListening(false);

        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];

        if (!chunks.length) {
          setError("No speech was captured. Please try again.");
          return;
        }

        const blobType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: blobType });

        if (blob.size === 0) {
          setError("No speech was captured. Please try again.");
          return;
        }

        setTranscribing(true);

        try {
          const extension = blobType.includes("mp4") ? "mp4" : "webm";
          const formData = new FormData();
          formData.append("audio", new File([blob], `question-${Date.now()}.${extension}`, { type: blobType }));
          formData.append("language", lang);

          const response = await fetch("/api/clinical-intake/transcribe", {
            method: "POST",
            body: formData,
            credentials: "include",
          });

          const result = await response.json().catch(() => null);

          if (!response.ok || !result?.success || !result?.transcript) {
            throw new Error(result?.error || "Unable to transcribe your question.");
          }

          await askQuestion(result.transcript);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to transcribe your question.");
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setListening(true);
    } catch {
      setListening(false);
      setError("Microphone access was denied. Please type your question instead.");
    }
  }

  function stopVoice() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

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
            <span className="menu-lines">☰</span>
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
            Ask about your own medications, records, vitals or reminders by voice or text.
            This reads back what is on file — it does not give medical advice or diagnose
            anything. For clinical questions, please contact your clinician.
          </p>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>
              JeevanLink&apos;s voice assistant answers only from your own saved health data
              and will not interpret results or suggest treatment.
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          )}

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
            <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
              {conversation.length === 0 ? (
                <div>
                  <p className="text-sm text-slate-400">
                    Try asking one of these, or use your own words:
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SUGGESTED_QUESTIONS.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => void askQuestion(question)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                conversation.map((turn) => (
                  <div key={turn.id} className="space-y-2">
                    <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-teal-700 px-4 py-2.5 text-sm text-white">
                      {turn.question}
                    </div>
                    <div
                      className={`max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm ${
                        turn.outOfScope
                          ? "border border-amber-200 bg-amber-50 text-amber-900"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="leading-6">{turn.answer}</p>
                        <button
                          type="button"
                          onClick={() => void speakAnswer(turn.id, turn.answer)}
                          className="mt-0.5 shrink-0 text-slate-400 hover:text-teal-700"
                          aria-label="Play answer"
                        >
                          <Volume2
                            size={15}
                            className={speakingId === turn.id ? "animate-pulse text-teal-700" : ""}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {(asking || transcribing) && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <RefreshCw size={13} className="animate-spin" />
                  {transcribing ? "Transcribing…" : "Thinking…"}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-end gap-2 border-t border-slate-100 pt-4">
              <input
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !asking) {
                    void askQuestion(textInput);
                  }
                }}
                placeholder="Type your question…"
                disabled={asking || listening || transcribing}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:opacity-60"
              />

              {voiceSupported && (
                <button
                  type="button"
                  onClick={() => (listening ? stopVoice() : void startVoice())}
                  disabled={asking || transcribing}
                  className={`inline-flex items-center justify-center rounded-xl p-2.5 transition disabled:opacity-50 ${
                    listening
                      ? "bg-rose-50 text-rose-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  aria-label={listening ? "Stop recording" : "Ask by voice"}
                >
                  {listening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}

              <button
                type="button"
                disabled={asking || !textInput.trim()}
                onClick={() => void askQuestion(textInput)}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {asking ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
