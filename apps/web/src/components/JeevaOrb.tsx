"use client";

import { useEffect, useRef, useState } from "react";

/*
 * React only mounts the canvas and loads the vanilla-JS orb via a plain
 * <script> tag -- it never reaches into orb.js's rendering logic. This
 * keeps orb.js truly framework-agnostic (see public/jeeva/orb.js) so the
 * same file can later back the Rogi kiosk route without React at all.
 */

declare global {
  interface Window {
    JeevaOrb?: new (
      canvas: HTMLCanvasElement,
      opts?: { onStateChange?: (state: string) => void },
    ) => JeevaOrbInstance;
  }
}

type JeevaOrbInstance = {
  setState: (name: string) => void;
  wake: (nextState?: string) => void;
  setLevel: (v: number) => void;
  error: () => void;
  destroy: () => void;
};

let scriptLoadPromise: Promise<void> | null = null;

function loadOrbScript(): Promise<void> {
  if (window.JeevaOrb) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/jeeva/orb.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Jeeva orb script."));
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}

export type JeevaOrbHandle = JeevaOrbInstance;

export default function JeevaOrb({
  errorMessage,
  onReady,
}: {
  /** Rendered as visible on-screen text when state is "error". The orb
   * itself never draws text on the canvas. */
  errorMessage?: string;
  onReady?: (orb: JeevaOrbHandle) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbRef = useRef<JeevaOrbInstance | null>(null);
  const [state, setState] = useState("dormant");

  useEffect(() => {
    let cancelled = false;

    loadOrbScript()
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
        style={{ width: 96, height: 96, pointerEvents: "auto", cursor: "pointer" }}
      />
      {state === "error" && errorMessage && (
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
          {errorMessage}
        </p>
      )}
    </div>
  );
}
