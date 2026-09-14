"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useLanguage } from "@/components/LanguageProvider";

/*
 * React only mounts the canvas and loads the vanilla-JS orb/mic modules
 * via plain <script> tags -- it never reaches into their internals.
 * This keeps orb.js/mic.js truly framework-agnostic (see public/jeeva/)
 * so the same files can later back the Rogi kiosk route without React.
 */

declare global {
  interface Window {
    JeevaOrb?: new (
      canvas: HTMLCanvasElement,
      opts?: { onStateChange?: (state: string) => void },
    ) => JeevaOrbInstance;
    JeevaMic?: new (opts: {
      onLevel?: (level: number) => void;
      onTurnEnd?: (blob: Blob) => void;
      onError?: (reason: string) => void;
      silenceMs?: number;
    }) => JeevaMicInstance;
    webkitAudioContext?: typeof AudioContext;
  }
}

type JeevaOrbInstance = {
  setState: (name: string) => void;
  wake: (nextState?: string) => void;
  setLevel: (v: number) => void;
  error: () => void;
  destroy: () => void;
};

type JeevaMicInstance = {
  start: () => Promise<void>;
  stop: () => void;
  setGated: (gated: boolean) => void;
  setSilenceMs: (ms: number) => void;
};

/** Shared with jeeva-dev/page.tsx so the two files don't drift on the
 * window.JeevaMic global's shape. */
export type JeevaMicHandle = JeevaMicInstance;

const loadedScripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const existing = loadedScripts.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });

  loadedScripts.set(src, promise);
  return promise;
}

export type JeevaOrbHandle = JeevaOrbInstance;

/*
 * Offline "golden consult" demo mode -- a fixed, rehearsed script that
 * runs with ZERO live network calls to Bhashini or Gemini, so a demo
 * doesn't depend on venue wifi (or Bhashini's own ~1-in-3 flakiness, or
 * Gemini's quota). The mic still opens and drives the orb's real level
 * animation for authenticity; only the ASR/reasoning/TTS content is
 * pre-baked, from `scripts/generate-jeeva-demo.ts`'s real, once-verified
 * output in public/jeeva/demo/. See that script for how to regenerate it.
 *
 * Toggled via a URL param so a presenter can turn it on once
 * (`?jeevaDemo=1`) and have it persist across normal in-app navigation;
 * `?jeevaDemo=0` turns it back off.
 */
type DemoTurn = {
  id: string;
  language: string;
  transcript: string;
  answer: string;
  navigateTo?: string;
  audioFile: string;
};

const DEMO_SCRIPT_URL = "/jeeva/demo/script.json";

function isDemoModeActive(): boolean {
  try {
    return window.localStorage.getItem("jeevaDemoMode") === "1";
  } catch {
    return false;
  }
}

function syncDemoModeFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("jeevaDemo")) return;
    window.localStorage.setItem("jeevaDemoMode", params.get("jeevaDemo") === "1" ? "1" : "0");
  } catch {
    // localStorage unavailable -- demo mode just won't persist, not fatal.
  }
}

let demoScriptPromise: Promise<DemoTurn[]> | null = null;

function loadDemoScript(): Promise<DemoTurn[]> {
  if (!demoScriptPromise) {
    demoScriptPromise = fetch(DEMO_SCRIPT_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load demo script (${response.status}).`);
        return response.json() as Promise<DemoTurn[]>;
      })
      .catch((error) => {
        demoScriptPromise = null; // allow retry on a later tap
        throw error;
      });
  }
  return demoScriptPromise;
}

const JEEVA_SERVICE_URL =
  process.env.NEXT_PUBLIC_JEEVA_SERVICE_URL || "http://localhost:8000";

// Bhashini calls can legitimately take minutes on a cold GPU model (see
// jeeva/app/bhashini.py) -- this must stay comfortably longer than that
// server-side retry budget, or the browser gives up before Bhashini's
// own retries do.
const CALL_TIMEOUT_MS = 10 * 60 * 1000;

// Sampling cadence for driving the orb's "speaking" level from the
// actual TTS playback -- setInterval, not requestAnimationFrame, same
// reasoning as mic.js: this reads audio state, it doesn't draw anything.
const LEVEL_SAMPLE_MS = 50;

export default function JeevaOrb({
  errorMessage,
  onReady,
}: {
  /** Rendered as visible on-screen text when state is "error". The orb
   * itself never draws text on the canvas. */
  errorMessage?: string;
  onReady?: (orb: JeevaOrbHandle) => void;
}) {
  const { language } = useLanguage();
  const router = useRouter();
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbRef = useRef<JeevaOrbInstance | null>(null);
  const micRef = useRef<JeevaMicInstance | null>(null);
  const sessionActiveRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const demoScriptRef = useRef<DemoTurn[] | null>(null);
  const demoTurnIndexRef = useRef(0);

  const [state, setState] = useState("dormant");
  const [internalMessage, setInternalMessage] = useState<string | null>(null);

  function endSession() {
    sessionActiveRef.current = false;
    micRef.current?.stop();
    micRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }

  /** Plays one TTS reply, driving the orb's "speaking" waves from the
   * audio's own level in real time (decoded via Web Audio, same RMS
   * approach mic.js uses for the mic) rather than leaving it to idle.
   *
   * Reuses the ONE AudioContext created synchronously in handleTap's
   * click handler (see there) instead of making a fresh one here.
   * Making a fresh AudioContext inside this function used to be the
   * bug: this runs from mic.js's onTurnEnd, which fires asynchronously
   * off a silence timer, not directly inside a click -- Chrome's
   * autoplay policy can silently start such a context "suspended," so
   * source.start() schedules playback that never actually produces
   * sound and no error is ever thrown. A context created directly in
   * the tap handler is reliably unlocked for the rest of the session. */
  function playReply(orb: JeevaOrbInstance, audioBytes: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const audioCtx = audioCtxRef.current;
      if (!audioCtx) {
        reject(new Error("Audio playback context missing -- session was not started via a tap."));
        return;
      }

      audioCtx
        .resume()
        .catch(() => {})
        .then(() => audioCtx.decodeAudioData(audioBytes))
        .then((audioBuffer) => {
          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;

          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 1024;
          source.connect(analyser);
          analyser.connect(audioCtx.destination);

          const buffer = new Uint8Array(analyser.fftSize);
          const interval = setInterval(() => {
            analyser.getByteTimeDomainData(buffer);
            let sumSquares = 0;
            for (let i = 0; i < buffer.length; i++) {
              const normalized = (buffer[i] - 128) / 128;
              sumSquares += normalized * normalized;
            }
            const rms = Math.sqrt(sumSquares / buffer.length);
            orb.setLevel(Math.min(1, rms * 4));
          }, LEVEL_SAMPLE_MS);

          source.onended = () => {
            clearInterval(interval);
            resolve();
          };
          source.start();
        })
        .catch(reject);
    });
  }

  /** Plays audio bytes already in hand (a live /speak response, or a
   * demo-mode local file) -- split out from speakText so both paths
   * share the exact same "speaking" state + level-driven playback. */
  async function playSpokenReply(orb: JeevaOrbInstance, audioBytes: ArrayBuffer) {
    orb.setState("speaking");
    // Gating for the whole turn is handleTurn's job (it starts as soon
    // as recording stops, covering /listen + askAssistant too, not just
    // this playback) -- see handleTurn's comment for why.
    await playReply(orb, audioBytes);
  }

  async function speakText(orb: JeevaOrbInstance, text: string, language: string) {
    const formData = new FormData();
    formData.set("text", text);
    formData.set("language", language);

    const response = await fetch(`${JEEVA_SERVICE_URL}/speak`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}) as { detail?: string; message?: string });
      throw new Error(body.detail || body.message || `Speech synthesis failed (${response.status}).`);
    }

    await playSpokenReply(orb, await response.arrayBuffer());
  }

  /** Asks JeevanLink's existing patient assistant brain (Gemini, grounded
   * in this patient's own records/vitals/medications -- see
   * api/voice-assistant/ask/route.ts) what to say back, instead of the
   * literal echo this used to do. That route already classifies a
   * request into a plain answer, an app-navigation, or a vital-logging
   * draft; it's same-origin so the browser's normal session cookie
   * authenticates it, no separate token plumbing needed.
   *
   * Deliberately reused as-is rather than rebuilt for Jeeva: it is the
   * "existing patient Q&A/vitals-logging behavior" the project decided
   * (2026-09-13) would be absorbed into Jeeva rather than duplicated.
   * PATIENT role only for now -- a CLINICIAN/HELPDESK/ADMIN tap will get
   * back that route's own honest 403 ("Only patients can use the voice
   * assistant") until Sahayak's separate clinician-facing tools
   * (open_patient, patient_history, summarise_consult -- build order
   * step 3) exist. */
  async function askAssistant(question: string, language: string): Promise<{ answer: string; navigateTo?: string }> {
    const response = await fetch("/api/voice-assistant/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, language }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });

    const body = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      answer?: string;
      error?: string;
      responseType?: string;
      navigateTo?: string;
    };

    if (!response.ok || !body.success || !body.answer) {
      throw new Error(body.error || "Unable to answer that right now.");
    }

    return {
      answer: body.answer,
      // action_draft answers are spoken as-is (the model already phrases
      // them as a confirmation question) but nothing is written yet --
      // there is no voice confirm/cancel turn wired up for that here.
      navigateTo: body.responseType === "navigate" ? body.navigateTo : undefined,
    };
  }

  /** One recorded turn -> transcript -> real assistant reply -> spoken
   * back. Replaces the old literal-echo placeholder now that the full
   * listen+speak round trip is verified working for all 12 languages.
   *
   * Gates the mic for this function's ENTIRE duration, not just around
   * TTS playback -- previously gating only wrapped speakText, so the mic
   * kept recording (ungated) through the whole /listen + askAssistant
   * network round trip. Anything picked up during that "thinking" window
   * (an impatient re-prompt, background noise crossing the silence
   * floor) could complete its own turn and fire a SECOND, fully
   * independent handleTurn concurrently -- two replies generated and
   * spoken around the same time, heard as overlapping/colliding voices.
   * Gating from the start closes that window entirely. */
  async function handleTurn(blob: Blob) {
    const orb = orbRef.current;
    if (!orb || !sessionActiveRef.current) return;

    orb.setState("thinking");
    micRef.current?.setGated(true);

    function resumeListening() {
      if (sessionActiveRef.current) {
        orb!.setState("listening");
        micRef.current?.setGated(false);
      }
    }

    // Demo mode: ignore what was actually recorded (blob) entirely and
    // advance through the pre-baked golden-consult script instead -- see
    // this file's DemoTurn/loadDemoScript comment for why. The mic still
    // opened and is still gated/ungated exactly like the live path, so
    // the orb's behavior looks identical to the audience.
    if (isDemoModeActive() && demoScriptRef.current) {
      try {
        const turn = demoScriptRef.current[demoTurnIndexRef.current];
        if (!turn) {
          // Script exhausted -- nothing scripted left to say.
          resumeListening();
          return;
        }
        demoTurnIndexRef.current += 1;

        if (turn.navigateTo) {
          router.push(turn.navigateTo);
        }

        const audioResponse = await fetch(`/jeeva/demo/${turn.audioFile}`);
        if (!audioResponse.ok) {
          throw new Error(`Demo audio file missing: ${turn.audioFile}`);
        }
        await playSpokenReply(orb, await audioResponse.arrayBuffer());

        resumeListening();
      } catch (error) {
        setInternalMessage(error instanceof Error ? error.message : "Something went wrong.");
        orb.error();
        endSession();
      }
      return;
    }

    try {
      const formData = new FormData();
      formData.set("audio", blob, "turn.webm");
      formData.set("language", languageRef.current);

      const response = await fetch(`${JEEVA_SERVICE_URL}/listen`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });

      if (response.status === 422) {
        // Nothing recognized -- not an error, just keep listening.
        resumeListening();
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}) as { detail?: string; message?: string });
        throw new Error(body.detail || body.message || `Transcription failed (${response.status}).`);
      }

      // /listen detects the language actually spoken (falling back to
      // languageRef.current, the app's UI setting, only if detection
      // failed) -- reply in THAT language, not necessarily the UI's, so
      // speaking Bengali gets a Bengali reply even if the UI is in
      // English.
      const { transcript, language: spokenLanguage } = (await response.json()) as {
        transcript?: string;
        language?: string;
      };
      if (!transcript) {
        resumeListening();
        return;
      }
      const replyLanguage = spokenLanguage || languageRef.current;

      const { answer, navigateTo } = await askAssistant(transcript, replyLanguage);
      if (navigateTo) {
        router.push(navigateTo);
      }
      await speakText(orb, answer, replyLanguage);

      resumeListening();
    } catch (error) {
      setInternalMessage(error instanceof Error ? error.message : "Something went wrong.");
      orb.error();
      endSession();
    }
  }

  /**
   * A tap starts a listening session; a tap while one is already active
   * is barge-in -- stop everything and return to dormant, per the build
   * spec ("Tap the orb, Space, or Esc cuts Jeeva off mid-sentence").
   * "Degrade loudly, never silently" applies here too: before opening
   * the mic, this checks Jeeva's own health so a down/unconfigured
   * service reports its actual reason instead of a dead click.
   */
  async function handleTap() {
    const orb = orbRef.current;
    if (!orb) return;

    if (sessionActiveRef.current) {
      endSession();
      orb.setState("dormant");
      setInternalMessage(null);
      return;
    }

    // Created HERE, synchronously, directly inside the click handler --
    // not later inside an async callback (see playReply's comment for
    // why that was the actual bug). This is what lets the browser treat
    // all of this session's later, asynchronously-triggered playback as
    // still tied to a real user gesture.
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    audioCtxRef.current = new AudioContextCtor();

    orb.wake("thinking");
    setInternalMessage(null);

    // Any failure between here and the mic actually starting must close
    // the AudioContext just opened above -- otherwise a failed tap
    // leaks one every time (audio contexts are a limited browser
    // resource, and this one is doing nothing without an active session).
    function failTap(target: JeevaOrbInstance, message: string) {
      setInternalMessage(message);
      target.error();
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    }

    const demoMode = isDemoModeActive();

    if (demoMode) {
      // The whole point of demo mode is no live dependency on Jeeva,
      // Bhashini, or Gemini -- so skip the health check (and everything
      // else network-related) entirely and just load the pre-baked
      // script instead.
      demoTurnIndexRef.current = 0;
      try {
        demoScriptRef.current = await loadDemoScript();
      } catch {
        failTap(orb, "Demo script not found — run scripts/generate-jeeva-demo.ts");
        return;
      }
    } else {
      try {
        const response = await fetch(`${JEEVA_SERVICE_URL}/health`, {
          signal: AbortSignal.timeout(4000),
        });
        const body = await response.json();

        if (!body.bhashini_configured) {
          failTap(orb, "Bhashini not configured — add BHASHINI_ULCA_API_KEY");
          return;
        }
      } catch {
        failTap(orb, "Jeeva service not running — see jeeva/README.md");
        return;
      }
    }

    try {
      await loadScript("/jeeva/mic.js");
    } catch {
      failTap(orb, "Failed to load the microphone module.");
      return;
    }

    if (!window.JeevaMic) {
      failTap(orb, "Microphone module unavailable.");
      return;
    }

    const mic = new window.JeevaMic({
      onLevel: (level) => orb.setLevel(level),
      onTurnEnd: (blob) => {
        void handleTurn(blob);
      },
      onError: (reason) => {
        setInternalMessage(reason);
        orb.error();
        endSession();
      },
    });

    micRef.current = mic;
    sessionActiveRef.current = true;
    orb.setState("listening");
    await mic.start();
  }

  useEffect(() => {
    syncDemoModeFromUrl();

    let cancelled = false;

    loadScript("/jeeva/orb.js")
      .then(() => {
        if (cancelled || !canvasRef.current || !window.JeevaOrb) return;
        const orb = new window.JeevaOrb(canvasRef.current, {
          onStateChange: setState,
        });
        orbRef.current = orb;
        onReady?.(orb);
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      cancelled = true;
      endSession();
      orbRef.current?.destroy();
      orbRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 999990,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        width={96}
        height={96}
        onClick={handleTap}
        role="button"
        aria-label="Talk to Jeeva"
        style={{ width: 96, height: 96, pointerEvents: "auto", cursor: "pointer" }}
      />
      {state === "error" && (internalMessage || errorMessage) && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "#c65b45",
            background: "rgba(26, 21, 18, 0.9)",
            padding: "4px 10px",
            borderRadius: 999,
            whiteSpace: "nowrap",
          }}
        >
          {internalMessage || errorMessage}
        </p>
      )}
    </div>
  );
}
