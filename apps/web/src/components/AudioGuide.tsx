"use client";

import { Volume2, VolumeX } from "lucide-react";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/app/lib/i18n";

/*
 * Extends the same "narrate this page aloud" pattern clinical-intake
 * already built (see its own local `say()`) to every patient page --
 * mounted once here so the TTS audio cache survives navigation instead
 * of resetting per page, and hidden on paths that either don't need it
 * or already have their own audio-guide UI (clinical-intake).
 *
 * Deliberately manual, not automatic: it never speaks on its own when
 * you land on or navigate between pages -- only when you tap it.
 */
const PAGE_NARRATION: Partial<Record<string, TranslationKey>> = {
  "/dashboard": "audioGuide.dashboard",
  "/records": "audioGuide.records",
  "/health-timeline": "audioGuide.healthTimeline",
  "/prescriptions": "audioGuide.prescriptions",
  "/vitals": "audioGuide.vitals",
  "/medications": "audioGuide.medications",
  "/personalized-health": "audioGuide.personalizedHealth",
  "/hospitals-labs": "audioGuide.hospitalsLabs",
  "/voice-assistant": "audioGuide.voiceAssistant",
  "/consent": "audioGuide.consent",
  "/support": "audioGuide.support",
};

const HIDDEN_PATHS = new Set(["/", "/login", "/clinical-intake"]);

export default function AudioGuide() {
  const pathname = usePathname();
  const { language, t } = useLanguage();

  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, Blob>>(new Map());
  const requestIdRef = useRef(0);

  const narrationKey = PAGE_NARRATION[pathname];
  const narrationText = narrationKey ? t(narrationKey) : null;

  async function handleTap() {
    // Tapping while already speaking stops it, rather than restarting.
    if (isSpeaking) {
      requestIdRef.current++;
      audioRef.current?.pause();
      audioRef.current = null;
      setIsSpeaking(false);
      return;
    }

    if (!narrationText) return;

    const requestId = ++requestIdRef.current;
    setIsSpeaking(true);

    try {
      const cacheKey = `${language}:${narrationText}`;
      let audioBlob = cacheRef.current.get(cacheKey);

      if (!audioBlob) {
        const response = await fetch("/api/clinical-intake/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: narrationText, language }),
        });

        if (requestId !== requestIdRef.current || !response.ok) return;

        audioBlob = await response.blob();
        if (!audioBlob.size) return;

        cacheRef.current.set(cacheKey, audioBlob);
      }

      if (requestId !== requestIdRef.current) return;

      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (requestId === requestIdRef.current) setIsSpeaking(false);
      };
      audioRef.current = audio;
      await audio.play();
    } catch {
      // e.g. a non-patient role gets a 403, or Gemini's quota is
      // exhausted -- just fall back to the idle button, no error UI.
    } finally {
      if (requestId !== requestIdRef.current) return;
      if (!audioRef.current) setIsSpeaking(false);
    }
  }

  if (HIDDEN_PATHS.has(pathname) || !narrationText) return null;

  return (
    <button
      type="button"
      onClick={handleTap}
      aria-pressed={isSpeaking}
      title={t("audioGuide.title")}
      style={{ position: "fixed", bottom: 24, right: 24, zIndex: 999980 }}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-3 text-xs font-semibold shadow-lg transition ${
        isSpeaking
          ? "border-teal-600 bg-teal-600 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {isSpeaking ? <Volume2 size={16} /> : <VolumeX size={16} />}
      {t("audioGuide.buttonLabel")}
    </button>
  );
}
