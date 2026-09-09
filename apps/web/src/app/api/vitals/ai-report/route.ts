import { NextResponse } from "next/server";

import {
  GoogleGenAI,
} from "@google/genai";

import {
  getCurrentUser,
} from "@/app/lib/auth";

import { prisma } from "@/app/lib/prisma";

import {
  buildVitalHealthSummary,
  getVitalLabel,
} from "@/app/lib/vitalAnalytics";

type AIReport = {
  title: string;

  overview: string;

  observedTrends: string[];

  whatChanged: string[];

  positiveSignals: string[];

  areasToMonitor: string[];

  dataGaps: string[];

  nextSteps: string[];

  safetyNote: string;
};

function getGeminiClient() {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured in the server environment."
    );
  }

  return new GoogleGenAI({
    apiKey,
  });
}

function stringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item
    ): item is string =>
      typeof item ===
        "string" &&
      item.trim().length >
        0
  );
}

function parseAIReport(
  text: string
): AIReport {
  let cleaned =
    text.trim();

  if (
    cleaned.startsWith(
      "```"
    )
  ) {
    cleaned =
      cleaned.replace(
        /^```(?:json)?\s*/i,
        ""
      );

    cleaned =
      cleaned.replace(
        /\s*```$/,
        ""
      );
  }

  const parsed =
    JSON.parse(
      cleaned
    );

  return {
    title:
      typeof parsed.title ===
      "string"
        ? parsed.title
        : "JeevanLink AI Health Report",

    overview:
      typeof parsed.overview ===
      "string"
        ? parsed.overview
        : "",

    observedTrends:
      stringArray(
        parsed.observedTrends
      ),

    whatChanged:
      stringArray(
        parsed.whatChanged
      ),

    positiveSignals:
      stringArray(
        parsed.positiveSignals
      ),

    areasToMonitor:
      stringArray(
        parsed.areasToMonitor
      ),

    dataGaps:
      stringArray(
        parsed.dataGaps
      ),

    nextSteps:
      stringArray(
        parsed.nextSteps
      ),

    safetyNote:
      typeof parsed.safetyNote ===
      "string"
        ? parsed.safetyNote
        : "This report summarizes recorded health information and is not a diagnosis.",
  };
}

export async function POST() {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      user.role !==
      "PATIENT"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only patients can generate their health report.",
        },
        {
          status: 403,
        }
      );
    }

    const vitals =
      await prisma.vitalMeasurement.findMany(
        {
          where: {
            patientId:
              user.id,
          },

          orderBy: {
            recordedAt:
              "desc",
          },

          take: 500,
        }
      );

    if (
      vitals.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Add at least one vital measurement before generating an AI report.",
        },
        {
          status: 400,
        }
      );
    }

    const summary =
      buildVitalHealthSummary(
        vitals
      );

    if (
      summary.measurementsCount ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No valid vital measurements are available for the AI report.",
        },
        {
          status: 400,
        }
      );
    }

    const measurements =
      vitals.map(
        (vital) => ({
          type:
            getVitalLabel(
              vital.vitalType
            ),

          value:
            vital.value,

          secondaryValue:
            vital.secondaryValue,

          unit:
            vital.unit,

          recordedAt:
            vital.recordedAt.toISOString(),

          source:
            vital.source,

          deviceName:
            vital.deviceName,

          notes:
            vital.notes,
        })
      );

    const prompt = `
You are JeevanLink's health-data interpretation assistant.

Generate an informational patient-friendly summary from the supplied health measurements and calculated longitudinal summary.

SAFETY RULES:

- Do not diagnose disease.
- Do not claim that the patient definitely has or does not have a condition.
- Do not prescribe or alter medication.
- Do not invent measurements, symptoms, dates, devices, diagnoses, or history.
- Do not turn the JeevanLink score into a medical-risk score.
- Clearly distinguish observations from interpretation.
- Do not overinterpret one isolated reading.
- Mention insufficient data.
- Use cautious language.
- Recommend professional evaluation when persistent concerning measurements are observed, without diagnosing.

CALCULATED SUMMARY:

${JSON.stringify(
  summary,
  null,
  2
)}

RECORDED MEASUREMENTS:

${JSON.stringify(
  measurements,
  null,
  2
)}

Return ONLY valid JSON using exactly:

{
  "title": "JeevanLink AI Health Report",
  "overview": "string",
  "observedTrends": ["string"],
  "whatChanged": ["string"],
  "positiveSignals": ["string"],
  "areasToMonitor": ["string"],
  "dataGaps": ["string"],
  "nextSteps": ["string"],
  "safetyNote": "string"
}

Write concise statements.

observedTrends:
Describe 1-5 supported observations.

whatChanged:
Compare repeated measurements where enough historical data exists.

positiveSignals:
Only include supported reassuring or stable observations.

areasToMonitor:
Only include supported observations that deserve continued monitoring.

dataGaps:
Mention limited history, missing vital types, or missing context.

nextSteps:
Use safe suggestions such as consistent measurement, recording context, and discussing persistent concerning readings with a healthcare professional.

safetyNote:
Explicitly state that this is an informational summary and not a diagnosis.
`;

    const ai =
      getGeminiClient();

    const response =
      await ai.models.generateContent(
        {
          model:
            "gemini-3.6-flash",

          contents:
            prompt,

          config: {
            responseMimeType:
              "application/json",

            responseSchema: {
              type: "object",

              properties: {
                title: {
                  type: "string",
                },

                overview: {
                  type: "string",
                },

                observedTrends: {
                  type: "array",

                  items: {
                    type: "string",
                  },
                },

                whatChanged: {
                  type: "array",

                  items: {
                    type: "string",
                  },
                },

                positiveSignals: {
                  type: "array",

                  items: {
                    type: "string",
                  },
                },

                areasToMonitor: {
                  type: "array",

                  items: {
                    type: "string",
                  },
                },

                dataGaps: {
                  type: "array",

                  items: {
                    type: "string",
                  },
                },

                nextSteps: {
                  type: "array",

                  items: {
                    type: "string",
                  },
                },

                safetyNote: {
                  type: "string",
                },
              },

              required: [
                "title",
                "overview",
                "observedTrends",
                "whatChanged",
                "positiveSignals",
                "areasToMonitor",
                "dataGaps",
                "nextSteps",
                "safetyNote",
              ],
            },
          },
        }
      );

    const text =
      response.text;

    if (
      !text ||
      !text.trim()
    ) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    const report =
      parseAIReport(
        text
      );

    return NextResponse.json({
      success: true,

      report,

      summary,
    });
  } catch (error) {
    console.error(
      "POST /api/vitals/ai-report failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to generate AI health report.",
      },
      {
        status: 500,
      }
    );
  }
}