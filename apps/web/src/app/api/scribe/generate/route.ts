import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/app/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not configured.");
}

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

/* =========================================================
   GEMINI RETRY HELPER
   (mirrors analyze-document/route.ts and transcribe/route.ts)
   ========================================================= */

function getErrorStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      status?: unknown;
      code?: unknown;
      response?: { status?: unknown };
    };

    if (typeof candidate.status === "number") return candidate.status;
    if (typeof candidate.code === "number") return candidate.code;
    if (typeof candidate.response?.status === "number") {
      return candidate.response.status;
    }
  }

  return null;
}

function isRetryableGeminiError(error: unknown): boolean {
  const status = getErrorStatus(error);

  if (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);

  return /429|500|502|503|504|UNAVAILABLE|RESOURCE_EXHAUSTED|temporarily unavailable|high demand|rate.?limit|quota/i.test(
    message,
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

async function generateGeminiWithRetry<T>(
  request: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await request();
    } catch (error) {
      lastError = error;

      const retryable = isRetryableGeminiError(error);

      console.error(
        `Gemini scribe request failed. Attempt ${attempt + 1}/${
          maxRetries + 1
        }. Error: ${getErrorMessage(error)}`,
      );

      if (!retryable || attempt === maxRetries) {
        throw error;
      }

      const delays = [3000, 8000, 15000];
      const delay =
        delays[Math.min(attempt, delays.length - 1)] +
        Math.floor(Math.random() * 1000);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/* =========================================================
   POST /api/scribe/generate
   Structures a clinician's free-form encounter notes (typed
   or dictated) into a SOAP-format draft. This is a draft for
   the clinician to review, edit and sign -- never saved
   automatically, never treated as final until they save it.
   ========================================================= */

export async function POST(request: NextRequest) {
  try {
    await requireRole("CLINICIAN");

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request." },
        { status: 400 },
      );
    }

    const { rawNotes } = (body ?? {}) as { rawNotes?: unknown };

    const cleanNotes = typeof rawNotes === "string" ? rawNotes.trim() : "";

    if (!cleanNotes) {
      return NextResponse.json(
        { success: false, error: "Encounter notes are required." },
        { status: 400 },
      );
    }

    if (cleanNotes.length > 8000) {
      return NextResponse.json(
        { success: false, error: "Notes are too long to structure at once." },
        { status: 400 },
      );
    }

    const prompt = `
You are a clinical scribe assistant for JeevanLink. A clinician has
dictated or typed free-form notes from a patient encounter. Structure
them into the standard SOAP format.

IMPORTANT SAFETY RULES:
1. Only reorganize and lightly clean up what the clinician actually
   said. Do NOT invent findings, diagnoses, medications, or values
   that are not present in the notes.
2. Do NOT add your own clinical opinion, differential diagnosis, or
   treatment recommendation beyond what the clinician stated.
3. If a SOAP section has nothing corresponding in the notes, leave it
   as an empty string rather than inventing content.
4. This is a draft. The clinician will review and edit every section
   before it becomes part of the patient's record.

Structure into:
- Subjective: patient-reported symptoms, history, complaints, as stated
- Objective: examination findings, vitals, observations
- Assessment: the clinician's stated impression/diagnosis, as stated
- Plan: treatment, medications, follow-up, referrals, as stated

CLINICIAN'S RAW NOTES:
${cleanNotes}

Return ONLY structured JSON matching the requested schema.
`;

    let response;

    try {
      response = await generateGeminiWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                subjective: { type: Type.STRING },
                objective: { type: Type.STRING },
                assessment: { type: Type.STRING },
                plan: { type: Type.STRING },
              },
              required: ["subjective", "objective", "assessment", "plan"],
            },
          },
        }),
      );
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const status = getErrorStatus(error);

      console.error("Gemini scribe request failed after retries:", { status, message });

      if (status === 429 || /429|RESOURCE_EXHAUSTED|quota/i.test(message)) {
        return NextResponse.json(
          {
            success: false,
            error: "The scribe assistant is temporarily busy. Please try again shortly.",
            code: "AI_QUOTA_EXCEEDED",
          },
          { status: 429 },
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Unable to structure these notes right now. Please try again.",
          code: "AI_SERVICE_ERROR",
        },
        { status: 502 },
      );
    }

    const text = response.text;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { success: false, error: "Unable to structure these notes right now." },
        { status: 502 },
      );
    }

    let soap: {
      subjective?: unknown;
      objective?: unknown;
      assessment?: unknown;
      plan?: unknown;
    };

    try {
      soap = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { success: false, error: "Unable to structure these notes right now." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      soap: {
        subjective: typeof soap.subjective === "string" ? soap.subjective : "",
        objective: typeof soap.objective === "string" ? soap.objective : "",
        assessment: typeof soap.assessment === "string" ? soap.assessment : "",
        plan: typeof soap.plan === "string" ? soap.plan : "",
      },
    });
  } catch (error: unknown) {
    console.error("Scribe generate route failed:", error);

    if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: "Only clinicians can use the AI scribe." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Unable to structure these notes right now." },
      { status: 500 },
    );
  }
}
