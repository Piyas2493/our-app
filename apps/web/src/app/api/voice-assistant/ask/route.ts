import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
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

      const status = getErrorStatus(error);
      const retryable = isRetryableGeminiError(error);

      console.error(
        `Gemini voice-assistant request failed. Attempt ${attempt + 1}/${
          maxRetries + 1
        }. Status: ${status ?? "unknown"}. Error: ${getErrorMessage(error)}`,
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
   CONTEXT BUILDER
   Only the patient's own data, condensed to plain text. This
   is the only information the model is allowed to draw on.
   ========================================================= */

async function buildPatientContext(patientId: string): Promise<string> {
  const [records, medications, vitals, reminders] = await Promise.all([
    prisma.medicalRecord.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        documentName: true,
        documentType: true,
        status: true,
        createdAt: true,
        rejectionReason: true,
      },
    }),
    prisma.medication.findMany({
      where: { medicalRecord: { patientId } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        name: true,
        dosage: true,
        frequency: true,
        duration: true,
        startDate: true,
        endDate: true,
      },
    }),
    prisma.vitalMeasurement.findMany({
      where: { patientId },
      orderBy: { recordedAt: "desc" },
      take: 10,
      select: {
        vitalType: true,
        value: true,
        secondaryValue: true,
        unit: true,
        recordedAt: true,
      },
    }),
    prisma.medicationReminder.findMany({
      where: { medication: { medicalRecord: { patientId } }, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { hour: true, minute: true, medication: { select: { name: true } } },
    }),
  ]);

  const recordLines = records.length
    ? records
        .map(
          (record) =>
            `- ${record.documentName} (${record.documentType}), status: ${record.status}, date: ${record.createdAt.toISOString().slice(0, 10)}${
              record.rejectionReason ? `, note: ${record.rejectionReason}` : ""
            }`,
        )
        .join("\n")
    : "No records on file.";

  const medicationLines = medications.length
    ? medications
        .map(
          (med) =>
            `- ${med.name}${med.dosage ? ` ${med.dosage}` : ""}${
              med.frequency ? `, ${med.frequency}` : ""
            }${med.duration ? `, duration: ${med.duration}` : ""}`,
        )
        .join("\n")
    : "No medications on file.";

  const vitalLines = vitals.length
    ? vitals
        .map(
          (vital) =>
            `- ${vital.vitalType}: ${vital.value ?? ""}${
              vital.secondaryValue ? `/${vital.secondaryValue}` : ""
            } ${vital.unit} on ${vital.recordedAt.toISOString().slice(0, 10)}`,
        )
        .join("\n")
    : "No vitals recorded.";

  const reminderLines = reminders.length
    ? reminders
        .map(
          (reminder) =>
            `- ${reminder.medication.name} at ${String(reminder.hour).padStart(2, "0")}:${String(reminder.minute).padStart(2, "0")}`,
        )
        .join("\n")
    : "No active reminders.";

  return `RECENT HEALTH RECORDS:\n${recordLines}\n\nCURRENT/RECENT MEDICATIONS:\n${medicationLines}\n\nRECENT VITALS:\n${vitalLines}\n\nACTIVE MEDICATION REMINDERS:\n${reminderLines}`;
}

/* =========================================================
   POST /api/voice-assistant/ask
   ========================================================= */

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("PATIENT");

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request." },
        { status: 400 },
      );
    }

    const { question, language } = (body ?? {}) as {
      question?: unknown;
      language?: unknown;
    };

    const cleanQuestion = typeof question === "string" ? question.trim() : "";

    if (!cleanQuestion) {
      return NextResponse.json(
        { success: false, error: "A question is required." },
        { status: 400 },
      );
    }

    if (cleanQuestion.length > 1000) {
      return NextResponse.json(
        { success: false, error: "That question is too long." },
        { status: 400 },
      );
    }

    const cleanLanguage =
      typeof language === "string" ? language.trim().toLowerCase() : "en";
    const languageName = LANGUAGE_NAMES[cleanLanguage] || LANGUAGE_NAMES.en;

    const context = await buildPatientContext(user.id);

    const prompt = `
You are JeevanLink's patient-facing voice assistant. You answer the
patient's question STRICTLY using the health data provided below,
which belongs to this patient only.

RULES:
1. Only use information explicitly present in the data below. Never
   invent facts, values, or dates that are not there.
2. Do NOT give medical advice, a diagnosis, a treatment recommendation,
   or your own interpretation of what a result "means" clinically.
   You may read back what is on file; you may not explain it medically.
3. If the question requires medical judgment, or the data below does not
   contain the answer, say so plainly and suggest they ask their
   clinician or raise a request in Help & Support. Do not guess.
4. If the question is unrelated to this patient's own health data
   (general medical questions, other people, anything else), politely
   decline and redirect them to their clinician.
5. Keep the answer short (2-4 sentences) and conversational, since it
   may be read aloud.
6. Answer in ${languageName}, the language the patient asked in.

PATIENT'S HEALTH DATA:
${context}

PATIENT'S QUESTION:
${cleanQuestion}

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
                answer: {
                  type: Type.STRING,
                  description: "The short, spoken-style answer to the patient.",
                },
                outOfScope: {
                  type: Type.BOOLEAN,
                  description:
                    "True if the question needed medical judgment or was unrelated to the patient's own data on file.",
                },
              },
              required: ["answer", "outOfScope"],
            },
          },
        }),
      );
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const status = getErrorStatus(error);

      console.error("Gemini voice-assistant request failed after retries:", {
        status,
        message,
      });

      if (status === 429 || /429|RESOURCE_EXHAUSTED|quota/i.test(message)) {
        return NextResponse.json(
          {
            success: false,
            error: "The assistant is temporarily busy. Please try again shortly.",
            code: "AI_QUOTA_EXCEEDED",
          },
          { status: 429 },
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Unable to answer that right now. Please try again.",
          code: "AI_SERVICE_ERROR",
        },
        { status: 502 },
      );
    }

    const text = response.text;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { success: false, error: "Unable to answer that right now. Please try again." },
        { status: 502 },
      );
    }

    let parsed: { answer?: unknown; outOfScope?: unknown };

    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { success: false, error: "Unable to answer that right now. Please try again." },
        { status: 502 },
      );
    }

    const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";

    if (!answer) {
      return NextResponse.json(
        { success: false, error: "Unable to answer that right now. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      answer,
      outOfScope: parsed.outOfScope === true,
    });
  } catch (error: unknown) {
    console.error("Voice assistant route failed:", error);

    if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: "Only patients can use the voice assistant." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Unable to answer that right now. Please try again." },
      { status: 500 },
    );
  }
}
