"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Mic,
  MicOff,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  User,
} from "lucide-react";

import LogoutButton from "@/components/LogoutButton";

/* =========================================================
   TYPES
   ========================================================= */

type Patient = { id: string; name: string; email: string };

type Soap = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

const EMPTY_SOAP: Soap = { subjective: "", objective: "", assessment: "", plan: "" };

/* =========================================================
   PAGE
   ========================================================= */

export default function AiMedicalScribePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [patientQuery, setPatientQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searching, setSearching] = useState(false);

  const [rawNotes, setRawNotes] = useState("");
  const [soap, setSoap] = useState<Soap>(EMPTY_SOAP);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

        if (result.user.role !== "CLINICIAN") {
          router.replace(
            result.user.role === "HELPDESK"
              ? "/helpdesk"
              : result.user.role === "ADMIN"
                ? "/admin"
                : "/dashboard",
          );
          return;
        }
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
    };
  }, [router]);

  async function searchPatients(query: string) {
    setSearching(true);

    try {
      const response = await fetch(
        `/api/clinician/patients${query ? `?q=${encodeURIComponent(query)}` : ""}`,
        { credentials: "include", cache: "no-store" },
      );
      const result = await response.json().catch(() => null);

      if (response.ok && result?.success) {
        setPatients(result.patients || []);
      }
    } catch {
      // Non-fatal; the search list just stays as-is.
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      void searchPatients(patientQuery);
    }, 300);

    return () => clearTimeout(handle);
  }, [patientQuery]);

  async function generateSoap() {
    if (!rawNotes.trim()) {
      setError("Add encounter notes before generating a structured draft.");
      return;
    }

    setGenerating(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/scribe/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawNotes }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to structure these notes.");
      }

      setSoap(result.soap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to structure these notes.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveNote() {
    if (!selectedPatient) {
      setError("Select a patient before saving.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/scribe/notes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: selectedPatient.id, rawNotes, soap }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to save this note.");
      }

      setSuccess(`Note saved to ${selectedPatient.name}'s record.`);
      setRawNotes("");
      setSoap(EMPTY_SOAP);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save this note.");
    } finally {
      setSaving(false);
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
        setError("Voice capture failed. Please try again or type your notes.");
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        setListening(false);

        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];

        if (!chunks.length) return;

        const blobType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: blobType });

        if (blob.size === 0) return;

        setTranscribing(true);

        try {
          const extension = blobType.includes("mp4") ? "mp4" : "webm";
          const formData = new FormData();
          formData.append("audio", new File([blob], `encounter-${Date.now()}.${extension}`, { type: blobType }));
          formData.append("language", "en");

          const response = await fetch("/api/clinical-intake/transcribe", {
            method: "POST",
            body: formData,
            credentials: "include",
          });

          const result = await response.json().catch(() => null);

          if (!response.ok || !result?.success || !result?.transcript) {
            throw new Error(result?.error || "Unable to transcribe.");
          }

          setRawNotes((current) => (current ? `${current}\n${result.transcript}` : result.transcript));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to transcribe this recording.");
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setListening(true);
    } catch {
      setListening(false);
      setError("Microphone access was denied. Please type your notes instead.");
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
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6f7]">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw size={20} className="animate-spin" />
          Loading…
        </div>
      </main>
    );
  }

  const hasSoapContent =
    soap.subjective || soap.objective || soap.assessment || soap.plan;

  return (
    <main className="min-h-screen bg-[#f4f6f7] text-slate-900">
      <div className="mx-auto max-w-5xl px-5 py-7 lg:px-7">
        <header className="mb-7">
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
            <div>
              <Link
                href="/clinician"
                className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft size={16} />
                Back to clinician workspace
              </Link>

              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-teal-700 p-3 text-white shadow-sm">
                  <Bot size={25} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
                    AI Medical Scribe
                  </p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight lg:text-4xl">
                    Structure a consultation note
                  </h1>
                </div>
              </div>

              <p className="mt-3 max-w-2xl text-slate-500">
                Dictate or type your encounter notes. AI organizes them into a
                SOAP-format draft for you to review and edit — nothing is saved
                to the patient&apos;s record until you approve it.
              </p>
            </div>

            <LogoutButton />
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-5 py-4 text-sm text-teal-800">
            <CheckCircle2 size={16} />
            {success}
          </div>
        )}

        {/* PATIENT SELECTOR */}
        <div className="mb-5 rounded-3xl border bg-white p-5 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-slate-700">Patient</p>

          {selectedPatient ? (
            <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <User size={16} className="text-teal-700" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{selectedPatient.name}</p>
                  <p className="text-xs text-slate-500">{selectedPatient.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="text-xs font-semibold text-teal-700 hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={patientQuery}
                  onChange={(event) => setPatientQuery(event.target.value)}
                  placeholder="Search patients by name or email…"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {searching ? (
                  <p className="px-1 py-2 text-xs text-slate-400">Searching…</p>
                ) : patients.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-slate-400">No patients found.</p>
                ) : (
                  patients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setSelectedPatient(patient)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-700">{patient.name}</span>
                      <span className="text-xs text-slate-400">{patient.email}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* RAW NOTES */}
        <div className="mb-5 rounded-3xl border bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Encounter notes</p>
            {voiceSupported && (
              <button
                type="button"
                onClick={() => (listening ? stopVoice() : void startVoice())}
                disabled={transcribing}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  listening ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {listening ? <MicOff size={13} /> : <Mic size={13} />}
                {listening ? "Stop" : transcribing ? "Transcribing…" : "Dictate"}
              </button>
            )}
          </div>

          <textarea
            value={rawNotes}
            onChange={(event) => setRawNotes(event.target.value)}
            rows={6}
            placeholder="e.g. Patient reports three days of dry cough and mild fever, worse at night. No shortness of breath. Chest clear on auscultation, temp 99.8F. Likely viral URI. Advised rest, fluids, paracetamol as needed, review in 5 days if not improving."
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
          />

          <button
            type="button"
            disabled={generating || !rawNotes.trim()}
            onClick={() => void generateSoap()}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {generating ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Generate structured note
          </button>
        </div>

        {/* SOAP DRAFT */}
        {hasSoapContent && (
          <div className="mb-5 rounded-3xl border border-teal-100 bg-teal-50/30 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={17} className="text-teal-700" />
              <p className="text-sm font-semibold text-slate-800">
                AI-structured draft — review and edit before saving
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SoapField
                label="Subjective"
                value={soap.subjective}
                onChange={(value) => setSoap((current) => ({ ...current, subjective: value }))}
              />
              <SoapField
                label="Objective"
                value={soap.objective}
                onChange={(value) => setSoap((current) => ({ ...current, objective: value }))}
              />
              <SoapField
                label="Assessment"
                value={soap.assessment}
                onChange={(value) => setSoap((current) => ({ ...current, assessment: value }))}
              />
              <SoapField
                label="Plan"
                value={soap.plan}
                onChange={(value) => setSoap((current) => ({ ...current, plan: value }))}
              />
            </div>

            <button
              type="button"
              disabled={saving || !selectedPatient}
              onClick={() => void saveNote()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              title={!selectedPatient ? "Select a patient first" : undefined}
            >
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              Save to patient record
            </button>
          </div>
        )}

        <p className="flex items-center gap-2 text-xs text-slate-400">
          <Check size={13} />
          Saved notes are attributed to you and stored as verified — no separate
          clinician review step, since you authored and reviewed it yourself.
        </p>
      </div>
    </main>
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

function SoapField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-teal-700">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}
