import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/auth";
import { generateGeminiWithRetry, getErrorMessage, getErrorStatus } from "@/app/lib/geminiRetry";

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

/*
 * Closed set of pages the assistant is allowed to send the patient to.
 * The model must pick from this exact list (enforced via schema enum)
 * -- it can never invent a route.
 */
const NAVIGABLE_PAGES: Record<string, string> = {
  "/dashboard": "Dashboard / home overview",
  "/records": "Health Records",
  "/health-timeline": "Health Timeline",
  "/prescriptions": "Prescriptions",
  "/vitals": "Vitals",
  "/medications": "Medication & Reminders",
  "/personalized-health": "Personalized Health",
  "/hospitals-labs": "Hospitals & Labs",
  "/consent": "Consent & Privacy",
  "/support": "Help & Support",
  "/clinical-intake": "Clinical Intake (start a new case)",
  "/voice-assistant": "Voice Assistant",
};

/*
 * The only action type the assistant can draft right now: logging a
 * vital measurement. Deliberately narrow -- one well-validated action
 * beats several shallow ones. Mirrors VALID_VITAL_TYPES in
 * api/vitals/route.ts.
 */
const VOICE_VITAL_TYPES = [
  "HEART_RATE",
  "BLOOD_PRESSURE",
  "OXYGEN_SATURATION",
  "TEMPERATURE",
  "WEIGHT",
  "BLOOD_GLUCOSE",
  "STEPS",
  "SLEEP_DURATION",
] as const;

const VOICE_VITAL_UNITS: Record<string, string> = {
  HEART_RATE: "bpm",
  BLOOD_PRESSURE: "mmHg",
  OXYGEN_SATURATION: "%",
  TEMPERATURE: "°F",
  WEIGHT: "kg",
  BLOOD_GLUCOSE: "mg/dL",
  STEPS: "steps",
  SLEEP_DURATION: "hours",
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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

    const pageList = Object.entries(NAVIGABLE_PAGES)
      .map(([path, description]) => `- ${path}: ${description}`)
      .join("\n");

    const prompt = `
You are JeevanLink's patient-facing voice assistant. You handle the
patient's spoken or typed request using STRICTLY the health data
provided below, which belongs to this patient only.

Classify the request into exactly one responseType:

1. "navigate" -- the patient wants to go to a part of the app (e.g.
   "open my medications", "take me to health records", "show my
   vitals"). Set navigateTo to the single closest matching path from
   this exact list -- never invent a path, and only use this
   responseType if one of these is clearly what they want:
${pageList}

2. "action_draft" -- the patient wants to log a NEW vital measurement
   AND has stated a specific number (e.g. "log my blood pressure as
   120 over 80", "record my weight as 70 kg", "my heart rate is 72").
   Set actionDraft.vitalType to one of: ${VOICE_VITAL_TYPES.join(", ")}.
   Set actionDraft.value (and actionDraft.secondaryValue for
   BLOOD_PRESSURE only, systolic first then diastolic) to EXACTLY the
   number(s) stated -- never invent, round, or guess a value. If they
   want to log something but did not give a clear number, use
   responseType "answer" instead and ask them to repeat it with the
   value.

3. "answer" -- everything else, including all questions about their
   own data. Follow these rules for it:
   a. Only use information explicitly present in the data below. Never
      invent facts, values, or dates that are not there.
   b. Do NOT give medical advice, a diagnosis, a treatment
      recommendation, or your own interpretation of what a result
      "means" clinically. You may read back what is on file; you may
      not explain it medically.
   c. If the question requires medical judgment, or the data below
      does not contain the answer, say so plainly and suggest they ask
      their clinician or raise a request in Help & Support. Do not
      guess.
   d. If the question is unrelated to this patient's own health data
      (general medical questions, other people, anything else),
      politely decline and redirect them to their clinician.

GENERAL RULES:
- Always fill "answer" with a short (1-3 sentence), conversational
  reply suitable for being read aloud, even for "navigate" (e.g.
  "Opening your medications.") and "action_draft" (e.g. "Here is a
  blood pressure reading of 120 over 80 to confirm.").
- Respond in ${languageName}, the language the patient used.

PATIENT'S HEALTH DATA:
${context}

PATIENT'S REQUEST:
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
                responseType: {
                  type: Type.STRING,
                  enum: ["answer", "navigate", "action_draft"],
                  description: "Which kind of response this is.",
                },
                answer: {
                  type: Type.STRING,
                  description: "The short, spoken-style reply to the patient.",
                },
                navigateTo: {
                  type: Type.STRING,
                  enum: Object.keys(NAVIGABLE_PAGES),
                  description: "Only set when responseType is 'navigate'.",
                },
                actionDraft: {
                  type: Type.OBJECT,
                  description:
                    "Required whenever responseType is 'action_draft'; omit entirely otherwise.",
                  properties: {
                    vitalType: {
                      type: Type.STRING,
                      enum: [...VOICE_VITAL_TYPES],
                    },
                    value: { type: Type.NUMBER },
                    secondaryValue: {
                      type: Type.NUMBER,
                      description: "Diastolic value, BLOOD_PRESSURE only.",
                    },
                  },
                  required: ["vitalType", "value"],
                },
                outOfScope: {
                  type: Type.BOOLEAN,
                  description:
                    "True if an 'answer' needed medical judgment or was unrelated to the patient's own data on file.",
                },
              },
              required: ["responseType", "answer", "outOfScope"],
            },
          },
        }),
        { label: "Gemini voice-assistant request" },
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

    let parsed: {
      responseType?: unknown;
      answer?: unknown;
      navigateTo?: unknown;
      actionDraft?: {
        vitalType?: unknown;
        value?: unknown;
        secondaryValue?: unknown;
      };
      outOfScope?: unknown;
    };

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

    /*
     * Validate navigate/action_draft independently of what the model
     * claims -- never forward a navigation target or an action draft
     * to the client unless it passes validation here. Falls back to a
     * plain answer rather than risk an invalid or invented action.
     */
    if (parsed.responseType === "navigate") {
      const navigateTo =
        typeof parsed.navigateTo === "string" ? parsed.navigateTo : "";

      if (navigateTo in NAVIGABLE_PAGES) {
        return NextResponse.json({
          success: true,
          responseType: "navigate",
          answer,
          navigateTo,
        });
      }
    }

    if (parsed.responseType === "action_draft") {
      const draft = parsed.actionDraft;
      const vitalType =
        typeof draft?.vitalType === "string" ? draft.vitalType : "";
      const value = draft?.value;
      const secondaryValue = draft?.secondaryValue;

      const isKnownVitalType = (VOICE_VITAL_TYPES as readonly string[]).includes(vitalType);
      const isBloodPressure = vitalType === "BLOOD_PRESSURE";

      const valid =
        isKnownVitalType &&
        isFiniteNumber(value) &&
        (!isBloodPressure || isFiniteNumber(secondaryValue));

      if (valid) {
        return NextResponse.json({
          success: true,
          responseType: "action_draft",
          answer,
          actionDraft: {
            vitalType,
            value,
            secondaryValue: isBloodPressure ? secondaryValue : undefined,
            unit: VOICE_VITAL_UNITS[vitalType],
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      responseType: "answer",
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
