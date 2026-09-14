"use client";

import { useEffect, useRef, useState } from "react";

import JeevaOrb, { type JeevaOrbHandle, type JeevaMicHandle } from "@/components/JeevaOrb";

/*
 * Private dev-only harness for reviewing the Jeeva orb and mic in
 * isolation -- steps 1-2 of the build order. The window.JeevaMic global
 * is declared once, in JeevaOrb.tsx, and reused here via JeevaMicHandle
 * so the two files can't drift on its shape. Not linked from any nav.
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

type LevelSource = "auto" | "manual" | "mic";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

export default function JeevaDevPage() {
  const orbRef = useRef<JeevaOrbHandle | null>(null);
  const micRef = useRef<JeevaMicHandle | null>(null);

  const [activeState, setActiveState] = useState<string>("dormant");
  const [levelSource, setLevelSource] = useState<LevelSource>("auto");
  const [manualLevel, setManualLevel] = useState(0.5);
  const [micStatus, setMicStatus] = useState<string>("not started");
  const [permission, setPermission] = useState<string>("unknown");
  const [lastTurn, setLastTurn] = useState<string>("none yet");
  const [errorMessage, setErrorMessage] = useState(
    "Bhashini unreachable — check connection",
  );

  useEffect(() => {
    loadScript("/jeeva/mic.js").catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (levelSource !== "auto") return;
    const start = performance.now();
    const id = setInterval(() => {
      const t = performance.now() - start;
      const level =
        0.5 + 0.35 * Math.sin(t / 260) + 0.15 * Math.sin(t / 71);
      orbRef.current?.setLevel(Math.max(0, Math.min(1, level)));
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, [levelSource]);

  useEffect(() => {
    if (levelSource !== "manual") return;
    orbRef.current?.setLevel(manualLevel);
  }, [levelSource, manualLevel]);

  function applyState(name: string) {
    setActiveState(name);
    if (name === "waking") {
      orbRef.current?.wake("speaking");
    } else {
      orbRef.current?.setState(name);
    }
  }

  async function checkPermission() {
    await loadScript("/jeeva/mic.js");
    if (!window.JeevaMic) return;
    const JeevaMicCtor = window.JeevaMic as unknown as {
      checkPermission: () => Promise<string>;
    };
    const state = await JeevaMicCtor.checkPermission();
    setPermission(state);
  }

  async function startMic() {
    await loadScript("/jeeva/mic.js");
    if (!window.JeevaMic) return;

    const mic = new window.JeevaMic({
      onLevel: (level) => {
        orbRef.current?.setLevel(level);
      },
      onTurnEnd: (blob) => {
        setLastTurn(`${(blob.size / 1024).toFixed(1)} KB, ${blob.type}`);
      },
      onError: (reason) => {
        setMicStatus("error");
        setErrorMessage(reason);
        orbRef.current?.error();
      },
    });

    micRef.current = mic;
    setLevelSource("mic");
    setMicStatus("starting…");
    await mic.start();
    setMicStatus("listening (real mic)");
    applyState("listening");
    checkPermission();
  }

  function stopMic() {
    micRef.current?.stop();
    micRef.current = null;
    setMicStatus("stopped");
    setLevelSource("auto");
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
          margin-bottom: 16px;
        }
        .jeeva-dev-panel h1 {
          font-size: 18px;
          margin: 0 0 4px;
          color: #f0c25c;
        }
        .jeeva-dev-panel h2 {
          font-size: 14px;
          margin: 0 0 12px;
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
          margin-bottom: 10px;
        }
        .jeeva-dev-level input[type="range"] {
          flex: 1;
        }
        .jeeva-dev-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .jeeva-dev-panel button.action {
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid rgba(212, 160, 44, 0.4);
          background: #d4a02c;
          color: #1a1512;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }
        .jeeva-dev-panel button.action.secondary {
          background: transparent;
          color: #f0e6d8;
        }
        .jeeva-dev-meta {
          font-size: 12px;
          color: #a89680;
          margin-top: 10px;
          line-height: 1.6;
        }
      `}</style>

      <div className="jeeva-dev-panel">
        <h1>Jeeva orb — dev harness</h1>
        <p className="sub">
          Step 1: canvas, all seven states. Step 2 (mic side, no Bhashini key
          yet): real getUserMedia + AnalyserNode level + silence-based
          turn-taking.
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
          <label className="jeeva-dev-row">
            <input
              type="radio"
              name="level-source"
              checked={levelSource === "auto"}
              onChange={() => setLevelSource("auto")}
            />
            Fake oscillating level
          </label>
        </div>
        <div className="jeeva-dev-level">
          <label className="jeeva-dev-row">
            <input
              type="radio"
              name="level-source"
              checked={levelSource === "manual"}
              onChange={() => setLevelSource("manual")}
            />
            Manual slider
          </label>
          {levelSource === "manual" && (
            <>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={manualLevel}
                onChange={(e) => setManualLevel(Number(e.target.value))}
              />
              <span>{manualLevel.toFixed(2)}</span>
            </>
          )}
        </div>
      </div>

      <div className="jeeva-dev-panel">
        <h2>Real microphone (needs your own mic — won&apos;t work in a headless preview)</h2>

        <div className="jeeva-dev-row" style={{ marginBottom: 12 }}>
          <button type="button" className="action" onClick={startMic}>
            Start real mic
          </button>
          <button type="button" className="action secondary" onClick={stopMic}>
            Stop
          </button>
          <button type="button" className="action secondary" onClick={checkPermission}>
            Check permission
          </button>
        </div>

        <div className="jeeva-dev-meta">
          status: {micStatus}
          <br />
          permission: {permission}
          <br />
          last turn captured: {lastTurn}
        </div>
      </div>

      <JeevaOrb
        errorMessage={errorMessage}
        onReady={(orb) => {
          orbRef.current = orb;
        }}
      />
    </div>
  );
}
