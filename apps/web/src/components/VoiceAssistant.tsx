"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  Volume2,
  X,
} from "lucide-react";

/* =========================================================
   TYPES
   ========================================================= */

type ActionDraft = {
  vitalType: string;
  value: number;
  secondaryValue?: number;
  unit: string;
};

type ResponseType = "answer" | "navigate" | "action_draft";

type ConversationTurn = {
  id: string;
  question: string;
  answer: string;
  responseType: ResponseType;
  outOfScope?: boolean;
  navigateTo?: string;
  actionDraft?: ActionDraft;
  actionStatus?: "pending" | "saving" | "confirmed" | "cancelled" | "error";
  actionError?: string;
};

const SUGGESTED_QUESTIONS = [
  "What medications am I currently on?",
  "Open my health records",
  "Log my heart rate as 72",
  "Do I have any pending health records?",
];

const VITAL_LABELS: Record<string, string> = {
  HEART_RATE: "Heart rate",
  BLOOD_PRESSURE: "Blood pressure",
  OXYGEN_SATURATION: "Oxygen saturation",
  TEMPERATURE: "Temperature",
  WEIGHT: "Weight",
  BLOOD_GLUCOSE: "Blood glucose",
  STEPS: "Steps",
  SLEEP_DURATION: "Sleep duration",
};

/* =========================================================
   COMPONENT
   ========================================================= */

export default function VoiceAssistant({
  language = "en",
  compact = false,
}: {
  language?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const lang = (language.split("-")[0] || "en").toLowerCase();

  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [textInput, setTextInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  const [voiceSupported] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia),
  );
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const turnIdRef = useRef(0);

  function updateTurn(id: string, patch: Partial<ConversationTurn>) {
    setConversation((current) =>
      current.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)),
    );
  }

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
      const id = `turn-${turnIdRef.current}`;

      const turn: ConversationTurn = {
        id,
        question: cleanQuestion,
        answer: result.answer,
        responseType: result.responseType || "answer",
        outOfScope: Boolean(result.outOfScope),
        navigateTo: result.navigateTo,
        actionDraft: result.actionDraft,
        actionStatus: result.responseType === "action_draft" ? "pending" : undefined,
      };

      setConversation((current) => [...current, turn]);
      setTextInput("");

      void speakAnswer(id, result.answer);

      if (turn.responseType === "navigate" && turn.navigateTo) {
        setTimeout(() => router.push(turn.navigateTo as string), 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to answer that right now.");
    } finally {
      setAsking(false);
    }
  }

  async function confirmAction(turn: ConversationTurn) {
    if (!turn.actionDraft) return;

    updateTurn(turn.id, { actionStatus: "saving" });

    try {
      const response = await fetch("/api/vitals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vitalType: turn.actionDraft.vitalType,
          value: turn.actionDraft.value,
          secondaryValue: turn.actionDraft.secondaryValue ?? null,
          unit: turn.actionDraft.unit,
          source: "MANUAL",
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to save this reading.");
      }

      updateTurn(turn.id, { actionStatus: "confirmed" });
    } catch (err) {
      updateTurn(turn.id, {
        actionStatus: "error",
        actionError: err instanceof Error ? err.message : "Unable to save this reading.",
      });
    }
  }

  function cancelAction(turn: ConversationTurn) {
    updateTurn(turn.id, { actionStatus: "cancelled" });
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

  return (
    <div>
      <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        <p>
          Answers only from your saved data. Logging a reading always needs your
          confirmation — nothing saves automatically.
        </p>
      </div>

      {error && (
        <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</div>
      )}

      <div className={`mt-3 space-y-4 overflow-y-auto pr-1 ${compact ? "max-h-72" : "max-h-[420px]"}`}>
        {conversation.length === 0 ? (
          <div>
            <p className="text-sm text-slate-400">Try asking, or use your own words:</p>
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
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-teal-700 px-4 py-2.5 text-sm text-white">
                {turn.question}
              </div>

              <div
                className={`max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm ${
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

              {turn.responseType === "action_draft" && turn.actionDraft && (
                <div className="max-w-[85%] rounded-2xl border border-teal-200 bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
                    {VITAL_LABELS[turn.actionDraft.vitalType] || turn.actionDraft.vitalType}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {turn.actionDraft.value}
                    {turn.actionDraft.secondaryValue !== undefined
                      ? `/${turn.actionDraft.secondaryValue}`
                      : ""}{" "}
                    {turn.actionDraft.unit}
                  </p>

                  {turn.actionStatus === "pending" && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void confirmAction(turn)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                      >
                        <Check size={13} />
                        Confirm & save
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelAction(turn)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        <X size={13} />
                        Cancel
                      </button>
                    </div>
                  )}

                  {turn.actionStatus === "saving" && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                      <RefreshCw size={12} className="animate-spin" />
                      Saving…
                    </p>
                  )}

                  {turn.actionStatus === "confirmed" && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-teal-700">
                      <Check size={13} />
                      Saved to your vitals.
                    </p>
                  )}

                  {turn.actionStatus === "cancelled" && (
                    <p className="mt-2 text-xs text-slate-400">Discarded.</p>
                  )}

                  {turn.actionStatus === "error" && (
                    <p className="mt-2 text-xs text-rose-600">{turn.actionError}</p>
                  )}
                </div>
              )}
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
          placeholder="Type or ask by voice…"
          disabled={asking || listening || transcribing}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:opacity-60"
        />

        {voiceSupported && (
          <button
            type="button"
            onClick={() => (listening ? stopVoice() : void startVoice())}
            disabled={asking || transcribing}
            className={`inline-flex items-center justify-center rounded-xl p-2.5 transition disabled:opacity-50 ${
              listening ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
  );
}
