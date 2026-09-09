import { NextResponse } from "next/server";

import { GoogleGenAI } from "@google/genai";

import {
  getCurrentUser,
} from "@/app/lib/auth";

import { prisma } from "@/app/lib/prisma";

import type {
  VitalAnalyticsInput,
} from "@/app/lib/vitalAnalytics";

import {
  buildVitalHealthSummary,
  getVitalLabel,
} from "@/app/lib/vitalAnalytics";

/* =========================================================
   TYPES
   ========================================================= */

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

/* =========================================================
   MODELS
   ========================================================= */

const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
] as const;

/* =========================================================
   CLIENT
   ========================================================= */

function getGeminiClient() {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Check your .env.local file."
    );
  }

  return new GoogleGenAI({
    apiKey,
  });
}

/* =========================================================
   SAFE ARRAY
   ========================================================= */

function toStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item
    ): item is string =>
      typeof item === "string" &&
      item.trim().length > 0
  );
}

/* =========================================================
   PARSE JSON
   ========================================================= */

function parseAIReport(
  text: string
): AIReport {
  let cleaned =
    text.trim();

  /*
   * Remove markdown code fences if Gemini
   * happens to return them.
   */

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
        /\s*```$/i,
        ""
      );
  }

  /*
   * Sometimes a model may return extra text
   * around the JSON. Try to isolate the object.
   */

  if (
    !cleaned.startsWith(
      "{"
    )
  ) {
    const start =
      cleaned.indexOf(
        "{"
      );

    const end =
      cleaned.lastIndexOf(
        "}"
      );

    if (
      start !== -1 &&
      end !== -1 &&
      end > start
    ) {
      cleaned =
        cleaned.slice(
          start,
          end + 1
        );
    }
  }

  const parsed =
    JSON.parse(
      cleaned
    );

  const report: AIReport = {
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
      toStringArray(
        parsed.observedTrends
      ),

    whatChanged:
      toStringArray(
        parsed.whatChanged
      ),

    positiveSignals:
      toStringArray(
        parsed.positiveSignals
      ),

    areasToMonitor:
      toStringArray(
        parsed.areasToMonitor
      ),

    dataGaps:
      toStringArray(
        parsed.dataGaps
      ),

    nextSteps:
      toStringArray(
        parsed.nextSteps
      ),

    safetyNote:
      typeof parsed.safetyNote ===
      "string"
        ? parsed.safetyNote
        : "This report summarizes recorded health information and is not a diagnosis.",
  };

  /*
   * Basic validation.
   */

  if (
    !report.overview &&
    report.observedTrends.length ===
      0
  ) {
    throw new Error(
      "Gemini returned an incomplete health report."
    );
  }

  return report;
}

/* =========================================================
   RETRYABLE ERROR DETECTION
   ========================================================= */

function isRetryableGeminiError(
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const normalized =
    message.toLowerCase();

  return (
    normalized.includes(
      "503"
    ) ||
    normalized.includes(
      "unavailable"
    ) ||
    normalized.includes(
      "high demand"
    ) ||
    normalized.includes(
      "overloaded"
    ) ||
    normalized.includes(
      "temporarily unavailable"
    ) ||
    normalized.includes(
      "deadline exceeded"
    )
  );
}

/* =========================================================
   DELAY
   ========================================================= */

function sleep(
  milliseconds: number
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

/* =========================================================
   GEMINI GENERATION
   ========================================================= */

async function generateWithGemini(
  ai: GoogleGenAI,
  model: string,
  prompt: string
) {
  /*
   * Two attempts per model.
   *
   * Small delay prevents immediate repeated
   * requests when Google is temporarily busy.
   */

  let lastError:
    | unknown =
    null;

  for (
    let attempt = 1;
    attempt <= 2;
    attempt += 1
  ) {
    try {
      console.log(
        `Attempting Gemini model: ${model}, attempt ${attempt}`
      );

      const response =
        await ai.models.generateContent(
          {
            model,

            contents:
              prompt,
          }
        );

      const text =
        response.text;

      if (
        !text ||
        !text.trim()
      ) {
        throw new Error(
          `Gemini model ${model} returned an empty response.`
        );
      }

      return text;
    } catch (
      error
    ) {
      lastError =
        error;

      console.error(
        `Gemini ${model} attempt ${attempt} failed:`,
        error
      );

      if (
        !isRetryableGeminiError(
          error
        )
      ) {
        throw error;
      }

      if (
        attempt < 2
      ) {
        /*
         * 2 seconds before retry.
         */

        await sleep(
          2000
        );
      }
    }
  }

  throw (
    lastError instanceof
    Error
      ? lastError
      : new Error(
          `Gemini model ${model} is unavailable.`
        )
  );
}

/* =========================================================
   POST /api/vitals/ai-report
   ========================================================= */

export async function POST() {
  try {
    /* -------------------------------------------------------
       AUTH
       ------------------------------------------------------- */

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

    /* -------------------------------------------------------
       LOAD VITALS
       ------------------------------------------------------- */

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

    /* -------------------------------------------------------
       CALCULATED SUMMARY
       ------------------------------------------------------- */

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

    /* -------------------------------------------------------
       COMPACT DATA FOR AI
       ------------------------------------------------------- */

    const measurements =
      vitals.map(
        (vital: VitalAnalyticsInput) => ({
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

    /* -------------------------------------------------------
       PROMPT
       ------------------------------------------------------- */

    const prompt = `
You are the health-data interpretation assistant inside JeevanLink.

Your job is to summarize the patient's recorded vital measurements and longitudinal trends in clear, patient-friendly language.

STRICT SAFETY RULES:

- Do not diagnose diseases.
- Do not state that the patient definitely has or does not have a disease.
- Do not prescribe medication.
- Do not recommend starting, stopping, or changing medication.
- Do not invent symptoms.
- Do not invent medical history.
- Do not invent measurements.
- Do not invent dates.
- Do not invent device information.
- Do not turn the JeevanLink score into a medical-risk score.
- Do not treat one isolated measurement as a diagnosis.
- Clearly distinguish observations from interpretation.
- Mention when there is insufficient data.
- Use cautious language.
- When a persistent concerning trend exists, suggest discussing it with a qualified healthcare professional.
- Base all statements strictly on the supplied data.

JEEVANLINK CALCULATED SUMMARY:

${JSON.stringify(
  summary,
  null,
  2
)}

RECORDED VITAL MEASUREMENTS:

${JSON.stringify(
  measurements,
  null,
  2
)}

Return ONLY a valid JSON object.

Required structure:

{
  "title": "JeevanLink AI Health Report",
  "overview": "Patient-friendly overall summary.",
  "observedTrends": [
    "Supported observation."
  ],
  "whatChanged": [
    "Supported change between measurements."
  ],
  "positiveSignals": [
    "Supported reassuring observation."
  ],
  "areasToMonitor": [
    "Supported area that may warrant continued monitoring."
  ],
  "dataGaps": [
    "Missing or insufficient data."
  ],
  "nextSteps": [
    "Safe practical next step."
  ],
  "safetyNote": "This report summarizes recorded health information and is not a diagnosis."
}

CONTENT RULES:

observedTrends:
Provide 1 to 5 observations directly supported by the recorded data.

whatChanged:
Compare repeated readings when enough data exists.
When there is not enough history, clearly say that more measurements are needed.

positiveSignals:
Only include genuinely reassuring or stable observations.

areasToMonitor:
Only include supported observations that merit continued monitoring.
Do not diagnose.

dataGaps:
Mention missing vital types, limited historical measurements, or missing context.

nextSteps:
Suggest actions such as consistent measurement, recording context, repeating measurements where appropriate, or discussing persistent concerning findings with a healthcare professional.

Keep the language concise and understandable.

Do not include markdown.
Do not include code fences.
Do not include text outside the JSON object.
`;

    /* -------------------------------------------------------
       GEMINI
       ------------------------------------------------------- */

    const ai =
      new GoogleGenAI({
        apiKey:
          process.env.GEMINI_API_KEY,
      });

    let rawText:
      | string
      | null =
      null;

    let lastError:
      | unknown =
      null;

    /*
     * Try models in order.
     *
     * 1. gemini-3.8-flash
     * 2. gemini-3.5-flash-lite
     */

    for (
      const model of
        GEMINI_MODELS
    ) {
      try {
        rawText =
          await generateWithGemini(
            ai,
            model,
            prompt
          );

        console.log(
          `JeevanLink AI report generated using ${model}.`
        );

        break;
      } catch (
        error
      ) {
        lastError =
          error;

        console.error(
          `Model ${model} failed. Trying next available model if possible.`
        );

        /*
         * If this is not a capacity/unavailable
         * problem, don't unnecessarily switch.
         */

        if (
          !isRetryableGeminiError(
            error
          )
        ) {
          throw error;
        }
      }
    }

    if (
      !rawText
    ) {
      throw (
        lastError instanceof
        Error
          ? lastError
          : new Error(
              "All configured Gemini models are currently unavailable."
            )
      );
    }

    /* -------------------------------------------------------
       PARSE
       ------------------------------------------------------- */

    const report =
      parseAIReport(
        rawText
      );

    /* -------------------------------------------------------
       RESPONSE
       ------------------------------------------------------- */

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

    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate AI health report.";

    /*
     * Give the frontend a useful message for
     * temporary provider outages.
     */

    if (
      isRetryableGeminiError(
        error
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Gemini is temporarily unavailable. JeevanLink tried the available Flash models and could not generate the report right now. Please try again in a moment.",
        },
        {
          status: 503,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,

        error:
          message,
      },
      {
        status: 500,
      }
    );
  }
}