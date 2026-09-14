/**
 * Generates the assets for Jeeva's offline "golden consult" demo mode.
 *
 * Demo day can't depend on venue wifi, and Bhashini itself fails ~1 in 3
 * calls even when the network is fine (see jeeva/README.md) -- so demo
 * mode runs a fixed, rehearsed script client-side with ZERO live network
 * calls to Bhashini or Gemini. This script is what PRODUCES that script's
 * assets: it runs each scripted question through the REAL, live pipeline
 * once (real Gemini reasoning grounded in the demo patient's real seeded
 * data, real Bhashini TTS) and saves the results to
 * apps/web/public/jeeva/demo/ -- so what plays back on demo day is a
 * genuine answer that was actually verified once, not an invented one.
 *
 * Re-run this whenever DEMO_SCRIPT below changes (new/edited turns, or
 * the demo patient's seeded data changes and answers need refreshing):
 *
 *   npx tsx scripts/generate-jeeva-demo.ts
 *
 * Requires: `npm run dev` already running (both web on :3000 and jeeva
 * on :8000), and a working Gemini quota (this makes real Gemini calls).
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const WEB_ORIGIN = "http://localhost:3000";
const JEEVA_ORIGIN = "http://localhost:8000";
const DEMO_PATIENT_EMAIL = "patient@jeevanlink.local";
const DEMO_PATIENT_PASSWORD = "Patient@123";

const OUT_DIR = join(__dirname, "..", "public", "jeeva", "demo");

type DemoTurnSpec = {
  id: string;
  language: string;
  /** What the presenter should actually say -- also shown as a rehearsal
   * cue and used as the fallback transcript if ASR is ever re-enabled. */
  transcript: string;
};

/*
 * The golden consult script. Scoped to what's actually built and
 * verified today (2026-09-14): grounded patient Q&A, voice navigation,
 * a multilingual turn, and a vital-logging draft. Edit freely -- just
 * re-run this file afterward to regenerate the cached audio/answers.
 */
const DEMO_SCRIPT: DemoTurnSpec[] = [
  {
    id: "meds",
    language: "en",
    transcript: "What medications am I currently on?",
  },
  {
    id: "vitals_nav",
    language: "en",
    transcript: "Take me to my vitals page.",
  },
  {
    id: "vitals_bn",
    language: "bn",
    transcript: "আমার সাম্প্রতিক ভাইটালস কী ছিল?", // "What were my recent vitals?"
  },
  {
    id: "log_hr",
    language: "en",
    transcript: "Log my heart rate as 72.",
  },
];

function extractSessionCookie(setCookieHeaders: string[]): string {
  const cookie = setCookieHeaders
    .map((header) => header.split(";")[0])
    .join("; ");
  if (!cookie) {
    throw new Error("Login did not return a session cookie.");
  }
  return cookie;
}

async function login(): Promise<string> {
  const response = await fetch(`${WEB_ORIGIN}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: DEMO_PATIENT_EMAIL, password: DEMO_PATIENT_PASSWORD }),
  });
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${await response.text()}`);
  }
  // Node's fetch exposes multiple Set-Cookie values via getSetCookie().
  const setCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  return extractSessionCookie(setCookie);
}

async function askAssistant(
  cookie: string,
  question: string,
  language: string,
): Promise<{ answer: string; navigateTo?: string }> {
  const response = await fetch(`${WEB_ORIGIN}/api/voice-assistant/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ question, language }),
  });
  const body = (await response.json()) as {
    success?: boolean;
    answer?: string;
    error?: string;
    responseType?: string;
    navigateTo?: string;
  };
  if (!response.ok || !body.success || !body.answer) {
    throw new Error(`askAssistant failed for "${question}": ${body.error ?? response.status}`);
  }
  return {
    answer: body.answer,
    navigateTo: body.responseType === "navigate" ? body.navigateTo : undefined,
  };
}

async function synthesize(text: string, language: string): Promise<ArrayBuffer> {
  const formData = new FormData();
  formData.set("text", text);
  formData.set("language", language);
  const response = await fetch(`${JEEVA_ORIGIN}/speak`, { method: "POST", body: formData });
  if (!response.ok) {
    throw new Error(`/speak failed for "${text}": ${response.status} ${await response.text()}`);
  }
  return response.arrayBuffer();
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Logging in as ${DEMO_PATIENT_EMAIL}...`);
  const cookie = await login();

  const manifest: Array<DemoTurnSpec & { answer: string; navigateTo?: string; audioFile: string }> = [];

  for (const turn of DEMO_SCRIPT) {
    console.log(`\n[${turn.id}] asking: ${turn.transcript}`);
    const { answer, navigateTo } = await askAssistant(cookie, turn.transcript, turn.language);
    console.log(`[${turn.id}] answer: ${answer}${navigateTo ? ` (navigate -> ${navigateTo})` : ""}`);

    console.log(`[${turn.id}] synthesizing reply audio...`);
    const audioBytes = await synthesize(answer, turn.language);
    const audioFile = `${turn.id}.wav`;
    writeFileSync(join(OUT_DIR, audioFile), Buffer.from(audioBytes));
    console.log(`[${turn.id}] saved ${audioBytes.byteLength} bytes -> public/jeeva/demo/${audioFile}`);

    manifest.push({ ...turn, answer, navigateTo, audioFile });
  }

  writeFileSync(join(OUT_DIR, "script.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${manifest.length} turns -> public/jeeva/demo/script.json`);
}

main().catch((error) => {
  console.error("\nGeneration failed:", error);
  process.exit(1);
});
