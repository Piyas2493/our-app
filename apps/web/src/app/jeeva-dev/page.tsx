"use client";

import { useEffect, useRef, useState } from "react";

import JeevaOrb, { type JeevaOrbHandle } from "@/components/JeevaOrb";

/*
 * Private dev-only harness for reviewing the Jeeva orb in isolation --
 * step 1 of the build order ("the orb, offline"). Not linked from any
 * nav; not wired to real audio or the server yet. Delete or gate this
 * route once the orb is mounted globally in a later step.
 */

const STATES = [
  "dormant",
  "waking",
  "speaking",
  "listening",
  "thinking",
  "scribing",
  "error",
] as const;

const SAMPLE_MS = 50; // fake level sampler cadence -- setInterval, not rAF

export default function JeevaDevPage() {
  const orbRef = useRef<JeevaOrbHandle | null>(null);
  const [activeState, setActiveState] = useState<string>("dormant");
  const [autoLevel, setAutoLevel] = useState(true);
  const [manualLevel, setManualLevel] = useState(0.5);

  useEffect(() => {
    if (!autoLevel) return;
    const start = performance.now();
    const id = setInterval(() => {
      const t = performance.now() - start;
      const level =
        0.5 + 0.35 * Math.sin(t / 260) + 0.15 * Math.sin(t / 71);
      orbRef.current?.setLevel(Math.max(0, Math.min(1, level)));
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, [autoLevel]);

  useEffect(() => {
    if (autoLevel) return;
    orbRef.current?.setLevel(manualLevel);
  }, [autoLevel, manualLevel]);

  function applyState(name: string) {
    setActiveState(name);
    if (name === "waking") {
      orbRef.current?.wake("speaking");
    } else {
      orbRef.current?.setState(name);
    }
  }

  return (
    <div className="jeeva-dev-root">
      <style>{`
        .jeeva-dev-root {
          min-height: 100vh;
          background: #1a1512;
          color: #f0e6d8;
          font-family: system-ui, sans-serif;
          padding: 32px;
        }
        .jeeva-dev-panel {
          max-width: 480px;
          background: #241d18;
          border: 1px solid rgba(212, 160, 44, 0.25);
          border-radius: 16px;
          padding: 24px;
        }
        .jeeva-dev-panel h1 {
          font-size: 18px;
          margin: 0 0 4px;
          color: #f0c25c;
        }
        .jeeva-dev-panel p.sub {
          margin: 0 0 20px;
          font-size: 13px;
          color: #a89680;
        }
        .jeeva-dev-states {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-bottom: 20px;
        }
        .jeeva-dev-states button {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid rgba(212, 160, 44, 0.3);
          background: rgba(212, 160, 44, 0.08);
          color: #f0e6d8;
          font-size: 13px;
          cursor: pointer;
          text-align: left;
        }
        .jeeva-dev-states button[data-active="true"] {
          background: #d4a02c;
          color: #1a1512;
          font-weight: 600;
        }
        .jeeva-dev-level {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
        }
        .jeeva-dev-level input[type="range"] {
          flex: 1;
        }
        .jeeva-dev-level label.toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 12px;
        }
      `}</style>

      <div className="jeeva-dev-panel">
        <h1>Jeeva orb — dev harness</h1>
        <p className="sub">
          Step 1: canvas, all seven states, fake level generator. No audio, no
          server.
        </p>

        <div className="jeeva-dev-states">
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              data-active={activeState === s}
              onClick={() => applyState(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="jeeva-dev-level">
          <label className="toggle">
            <input
              type="checkbox"
              checked={autoLevel}
              onChange={(e) => setAutoLevel(e.target.checked)}
            />
            Auto level (oscillating)
          </label>
        </div>

        {!autoLevel && (
          <div className="jeeva-dev-level">
            <span>level</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={manualLevel}
              onChange={(e) => setManualLevel(Number(e.target.value))}
            />
            <span>{manualLevel.toFixed(2)}</span>
          </div>
        )}
      </div>

      <JeevaOrb
        errorMessage="Bhashini unreachable — check connection"
        onReady={(orb) => {
          orbRef.current = orb;
        }}
      />
    </div>
  );
}
