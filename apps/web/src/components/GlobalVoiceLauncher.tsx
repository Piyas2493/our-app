"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mic, X } from "lucide-react";

import { useLanguage } from "@/components/LanguageProvider";
import VoiceAssistant from "@/components/VoiceAssistant";

/*
 * Drop-in replacement for the decorative "circle-button voice-top" mic
 * icon that used to sit in page topbars with no onClick handler at
 * all. Renders the same look, but actually opens the voice assistant
 * as a floating panel right there on the page.
 *
 * The panel is rendered through a portal into document.body rather
 * than inline. The topbar it lives in uses backdrop-filter, which
 * (like transform) creates a containing block for position:fixed
 * descendants -- so even a fixed-position popover would stay trapped
 * inside the topbar's bounding box and get painted under the page's
 * other stacking contexts (e.g. the dashboard hero's floating cards).
 * Portaling out to <body> escapes that entirely.
 */
export default function GlobalVoiceLauncher() {
  const { language } = useLanguage() as { language?: string };
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function updatePosition() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    setPosition({
      top: rect.bottom + 12,
      right: Math.max(16, window.innerWidth - rect.right),
    });
  }

  function toggleOpen() {
    if (!open) updatePosition();
    setOpen((current) => !current);
  }

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleReposition() {
      updatePosition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="circle-button voice-top"
        onClick={toggleOpen}
        title="Voice Assistant"
        aria-label="Open voice assistant"
        aria-expanded={open}
      >
        <Mic size={20} />
      </button>

      {mounted &&
        open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: position.top, right: position.right, zIndex: 9999 }}
            className="w-[380px] max-w-[90vw] rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl"
          >
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

            <VoiceAssistant language={language} compact autoStart />
          </div>,
          document.body,
        )}
    </>
  );
}
