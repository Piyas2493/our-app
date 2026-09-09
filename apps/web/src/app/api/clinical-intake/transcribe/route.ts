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

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  or: "Odia",
  as: "Assamese",
};

const MAX_AUDIO_SIZE = 10 * 1024 * 1024;

/* =========================================================
   GEMINI RETRY HELPER
   (mirrors analyze-document/route.ts)
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

      const status = getErrorStatus(error);
      const retryable = isRetryableGeminiError(error);

      console.error(
        `Gemini transcription request failed. Attempt ${attempt + 1}/${
          maxRetries + 1
        }. Status: ${status ?? "unknown"}. Error: ${getErrorMessage(error)}`,
      );

      if (!retryable || attempt === maxRetries) {
        throw error;
      }

      const delays = [5000, 15000, 30000];
      const delay =
        delays[Math.min(attempt, delays.length - 1)] +
        Math.floor(Math.random() * 1500);

      console.warn(`Retrying Gemini transcription request in ${delay}ms...`);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/* =========================================================
   POST /api/clinical-intake/transcribe
   Speech-to-text for a single recorded voice answer.
   ========================================================= */

export async function POST(request: NextRequest) {
  try {
    await requireRole("PATIENT");

    const formData = await request.formData();

    const audio = formData.get("audio");
    const language = String(formData.get("language") || "en")
      .trim()
      .toLowerCase();

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No audio recording was received." },
        { status: 400 },
      );
    }

    if (!audio.type.startsWith("audio/")) {
      return NextResponse.json(
        { success: false, error: "Unsupported audio format." },
        { status: 400 },
      );
    }

    if (audio.size === 0) {
      return NextResponse.json(
        { success: false, error: "No speech was captured. Please try again." },
        { status: 400 },
      );
    }

    if (audio.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { success: false, error: "Recording is too long. Please keep answers under a minute." },
        { status: 400 },
      );
    }

    const languageName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en;

    const bytes = await audio.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");

    const prompt = `
You are a speech-to-text system for JeevanLink, a clinical case-taking
platform. Transcribe the attached audio recording of a patient answering
a clinical intake question.

The patient is speaking in ${languageName}.

RULES:
1. Transcribe exactly what was said, in the language it was spoken in.
   Do NOT translate it into another language.
2. Do NOT add medical interpretation, correction, or commentary.
3. Do NOT invent words if the audio is unclear or silent — return an
   empty string instead of guessing.
4. Return ONLY structured JSON matching the requested schema.
`;

    let response;

    try {
      response = await generateGeminiWithRetry(
        () =>
          ai.models.generateContent({
            model: "gemini-3.6-flash",

            contents: [
              {
                role: "user",

                parts: [
                  {
                    inlineData: {
                      mimeType: audio.type,
                      data: base64Data,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],

            config: {
              responseMimeType: "application/json",

              responseSchema: {
                type: Type.OBJECT,

                properties: {
                  transcript: {
                    type: Type.STRING,
                    description:
                      "The patient's spoken answer, transcribed as-is in the language it was spoken. Empty string if inaudible or silent.",
                  },
                },

                required: ["transcript"],
              },
            },
          }),
        3,
      );
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const status = getErrorStatus(error);

      console.error("Gemini transcription request failed after retries:", {
        status,
        message,
      });

      if (status === 429 || /429|RESOURCE_EXHAUSTED|quota/i.test(message)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Voice transcription is temporarily unavailable because the Gemini API request limit has been reached. Please type your answer instead.",
            code: "AI_QUOTA_EXCEEDED",
          },
          { status: 429 },
        );
      }

      if (
        status === 503 ||
        /503|UNAVAILABLE|high demand|temporarily unavailable/i.test(message)
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Voice transcription is temporarily unavailable. Please try again or type your answer.",
            code: "AI_SERVICE_UNAVAILABLE",
          },
          { status: 503 },
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Unable to transcribe the recording. Please try again or type your answer.",
          code: "AI_SERVICE_ERROR",
        },
        { status: 502 },
      );
    }

    const text = response.text;

    if (!text || !text.trim()) {
      console.error("Gemini transcription returned an empty response.");

      return NextResponse.json(
        {
          success: false,
          error: "Unable to transcribe the recording. Please try again or type your answer.",
          code: "EMPTY_AI_RESPONSE",
        },
        { status: 502 },
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch (error) {
      console.error("Invalid Gemini transcription JSON response:", error, text);

      return NextResponse.json(
        {
          success: false,
          error: "Unable to transcribe the recording. Please try again or type your answer.",
          code: "INVALID_AI_RESPONSE",
        },
        { status: 502 },
      );
    }

    const transcript =
      typeof (parsed as { transcript?: unknown })?.transcript === "string"
        ? (parsed as { transcript: string }).transcript.trim()
        : "";

    if (!transcript) {
      return NextResponse.json(
        {
          success: false,
          error: "No speech was recognized. Please try again or type your answer.",
          code: "EMPTY_TRANSCRIPT",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      transcript,
    });
  } catch (error: unknown) {
    console.error("Clinical intake transcription route failed:", error);

    if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: "Only patients can use voice capture here." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to transcribe the recording. Please try again or type your answer.",
        code: "TRANSCRIPTION_ERROR",
      },
      { status: 500 },
    );
  }
}
