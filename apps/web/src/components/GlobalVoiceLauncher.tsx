"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, X } from "lucide-react";

import { useLanguage } from "@/components/LanguageProvider";
import VoiceAssistant from "@/components/VoiceAssistant";

/*
 * Drop-in replacement for the decorative "circle-button voice-top" mic
 * icon that used to sit in page topbars with no onClick handler at
 * all. Renders the same look, but actually opens the voice assistant
 * as a floating panel right there on the page.
 */
export default function GlobalVoiceLauncher() {
  const { language } = useLanguage() as { language?: string };
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="circle-button voice-top"
        onClick={() => setOpen((current) => !current)}
        title="Voice Assistant"
        aria-label="Open voice assistant"
        aria-expanded={open}
      >
        <Mic size={20} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-[380px] max-w-[90vw] rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Voice Assistant</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <VoiceAssistant language={language} compact />
        </div>
      )}
    </div>
  );
}
