"use client";

import { Volume2, VolumeX } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useAccessibility } from "@/components/AccessibilityProvider";
import { useLanguage } from "@/components/LanguageProvider";
import type { TranslationKey } from "@/app/lib/i18n";

/*
 * Extends the same "narrate this page aloud" pattern clinical-intake
 * already built (see its own local `say()`) to every patient page --
 * mounted once here so the TTS audio cache survives navigation instead
 * of resetting per page, and hidden on paths that either don't need it
 * or already have their own audio-guide UI (clinical-intake).
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
  const { audioGuided, toggleAudioGuided } = useAccessibility();
  const { language, t } = useLanguage();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, Blob>>(new Map());
  const requestIdRef = useRef(0);

  const narrationKey = PAGE_NARRATION[pathname];
  const narrationText = narrationKey ? t(narrationKey) : null;

  async function speak(text: string) {
    const requestId = ++requestIdRef.current;

    audioRef.current?.pause();
    audioRef.current = null;

    try {
      const cacheKey = `${language}:${text}`;
      let audioBlob = cacheRef.current.get(cacheKey);

      if (!audioBlob) {
        const response = await fetch("/api/clinical-intake/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text, language }),
        });

        if (requestId !== requestIdRef.current || !response.ok) return;

        audioBlob = await response.blob();
        if (!audioBlob.size) return;

        cacheRef.current.set(cacheKey, audioBlob);
      }

      if (requestId !== requestIdRef.current) return;

      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audioRef.current = audio;
      await audio.play();
    } catch {
      // Silent guide is a harmless degradation -- e.g. a non-patient
      // role gets a 403 from the speak endpoint, or Gemini's quota is
      // exhausted. No error UI for a background narration.
    }
  }

  useEffect(() => {
    if (!audioGuided || !narrationText) return;
    void speak(narrationText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioGuided, narrationText, language]);

  useEffect(() => {
    if (!audioGuided) {
      audioRef.current?.pause();
      audioRef.current = null;
    }
  }, [audioGuided]);

  if (HIDDEN_PATHS.has(pathname)) return null;

  return (
    <button
      type="button"
      onClick={toggleAudioGuided}
      aria-pressed={audioGuided}
      title={t(audioGuided ? "audioGuide.on" : "audioGuide.off")}
      style={{ position: "fixed", bottom: 24, right: 24, zIndex: 999980 }}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-3 text-xs font-semibold shadow-lg transition ${
        audioGuided
          ? "border-teal-600 bg-teal-600 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {audioGuided ? <Volume2 size={16} /> : <VolumeX size={16} />}
      {t("audioGuide.buttonLabel")}
    </button>
  );
}
