"use client";

import { useEffect, useRef, useState } from "react";

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
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbRef = useRef<JeevaOrbInstance | null>(null);
  const micRef = useRef<JeevaMicInstance | null>(null);
  const sessionActiveRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

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

  async function speakText(orb: JeevaOrbInstance, text: string) {
    orb.setState("speaking");
    micRef.current?.setGated(true);

    const formData = new FormData();
    formData.set("text", text);
    formData.set("language", languageRef.current);

    const response = await fetch(`${JEEVA_SERVICE_URL}/speak`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}) as { detail?: string; message?: string });
      throw new Error(body.detail || body.message || `Speech synthesis failed (${response.status}).`);
    }

    await playReply(orb, await response.arrayBuffer());
  }

  /** One recorded turn -> transcript -> spoken reply. No conversation
   * engine exists yet (Sahayak's reasoning is later in the build order),
   * so the reply is an echo of what was heard -- this proves the full
   * listen+speak loop through the real orb UI, the same round trip
   * already verified directly against the service for all 12 languages. */
  async function handleTurn(blob: Blob) {
    const orb = orbRef.current;
    if (!orb || !sessionActiveRef.current) return;

    orb.setState("thinking");

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
        if (sessionActiveRef.current) {
          orb.setState("listening");
          micRef.current?.setGated(false);
        }
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}) as { detail?: string; message?: string });
        throw new Error(body.detail || body.message || `Transcription failed (${response.status}).`);
      }

      const { transcript } = (await response.json()) as { transcript?: string };
      if (!transcript) {
        if (sessionActiveRef.current) {
          orb.setState("listening");
          micRef.current?.setGated(false);
        }
        return;
      }

      await speakText(orb, transcript);

      if (sessionActiveRef.current) {
        orb.setState("listening");
        micRef.current?.setGated(false);
      }
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
