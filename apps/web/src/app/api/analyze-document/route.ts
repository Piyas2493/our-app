import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error(
    "GEMINI_API_KEY is not configured."
  );
}

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

/* =========================================================
   GEMINI RETRY HELPER
   ========================================================= */

function getErrorStatus(
  error: unknown
): number | null {
  if (
    typeof error === "object" &&
    error !== null
  ) {
    const candidate =
      error as {
        status?: unknown;
        code?: unknown;
        response?: {
          status?: unknown;
        };
      };

    if (
      typeof candidate.status ===
      "number"
    ) {
      return candidate.status;
    }

    if (
      typeof candidate.code ===
      "number"
    ) {
      return candidate.code;
    }

    if (
      typeof candidate.response
        ?.status === "number"
    ) {
      return candidate.response.status;
    }
  }

  return null;
}

function isRetryableGeminiError(
  error: unknown
): boolean {
  const status =
    getErrorStatus(error);

  if (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  const message =
    error instanceof Error
      ? error.message
      : String(error);

  return /429|500|502|503|504|UNAVAILABLE|RESOURCE_EXHAUSTED|temporarily unavailable|high demand|rate.?limit|quota/i.test(
    message
  );
}

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null
  ) {
    try {
      return JSON.stringify(
        error
      );
    } catch {
      return String(error);
    }
  }

  return String(error);
}

async function generateGeminiWithRetry<
  T
>(
  request: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: unknown =
    null;

  for (
    let attempt = 0;
    attempt <= maxRetries;
    attempt++
  ) {
    try {
      return await request();
    } catch (error) {
      lastError =
        error;

      const status =
        getErrorStatus(
          error
        );

      const retryable =
        isRetryableGeminiError(
          error
        );

      console.error(
        `Gemini request failed. Attempt ${
          attempt + 1
        }/${maxRetries + 1}. Status: ${
          status ?? "unknown"
        }. Error: ${getErrorMessage(
          error
        )}`
      );

      if (
        !retryable ||
        attempt ===
          maxRetries
      ) {
        throw error;
      }

      /*
       * Longer backoff is intentional.
       * Recent Gemini 503 reports indicate that
       * very short retries can land in the same
       * congestion window.
       */

      const delays = [
        5000,
        15000,
        30000,
      ];

      const delay =
        delays[
          Math.min(
            attempt,
            delays.length - 1
          )
        ] +
        Math.floor(
          Math.random() * 1500
        );

      console.warn(
        `Retrying Gemini request in ${delay}ms...`
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            delay
          )
      );
    }
  }

  throw lastError;
}

/* =========================================================
   POST
   ========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    await requireRole("PATIENT");

    /* -------------------------------------------------------
       READ FORM DATA
       ------------------------------------------------------- */

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    if (
      !(file instanceof File)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No document was uploaded.",
        },
        {
          status: 400,
        }
      );
    }

    /* -------------------------------------------------------
       FILE TYPE
       ------------------------------------------------------- */

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (
      !allowedTypes.includes(
        file.type
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unsupported file type. Please upload a PDF, JPG, JPEG, PNG, or WEBP file.",
        },
        {
          status: 400,
        }
      );
    }

    /* -------------------------------------------------------
       FILE SIZE
       ------------------------------------------------------- */

    const MAX_FILE_SIZE =
      15 * 1024 * 1024;

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "File is too large. Maximum supported size is 15 MB.",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      `Analyzing file: ${file.name} (${file.type}, ${file.size} bytes)`
    );

    /* -------------------------------------------------------
       CONVERT FILE
       ------------------------------------------------------- */

    const bytes =
      await file.arrayBuffer();

    const base64Data =
      Buffer.from(
        bytes
      ).toString(
        "base64"
      );

    /* -------------------------------------------------------
       PROMPT
       ------------------------------------------------------- */

    const prompt = `
You are a medical document information extraction system for JeevanLink.

Your task is to READ and STRUCTURE information that is explicitly present
in the uploaded medical document.

The document may be one of the following:

- Prescription
- Laboratory / pathology report
- X-ray report
- MRI report
- CT scan report
- Ultrasound report
- Discharge summary
- Other medical document

IMPORTANT SAFETY RULES:

1. Do NOT diagnose the patient.
2. Do NOT invent missing information.
3. Do NOT infer medications, diseases, findings, or values that are not
   explicitly written in the document.
4. Preserve uncertainty when text is unclear.
5. If a field is unavailable, return an empty string or empty array.
6. This output is a draft for clinician verification.

Classify the document and extract all relevant structured information.

For PRESCRIPTIONS:
Extract medication name, dosage, frequency, duration and instructions.

For LAB REPORTS:
Extract test name, observed value, unit, reference range and abnormality
if explicitly indicated or directly determinable from the supplied
reference range.

For X-RAY, MRI, CT or other RADIOLOGY REPORTS:
Extract study/examination name, body region, clinical history,
technique, findings and impression.

Return ONLY structured JSON matching the requested schema.
`;

    /* -------------------------------------------------------
       GEMINI REQUEST
       ------------------------------------------------------- */

    let response;

    try {
      response =
        await generateGeminiWithRetry(
          () =>
            ai.models.generateContent(
              {
                model:
                  "gemini-3.6-flash",

                contents: [
                  {
                    role: "user",

                    parts: [
                      {
                        inlineData:
                          {
                            mimeType:
                              file.type,

                            data:
                              base64Data,
                          },
                      },

                      {
                        text:
                          prompt,
                      },
                    ],
                  },
                ],

                config: {
                  responseMimeType:
                    "application/json",

                  responseSchema: {
                    type:
                      Type.OBJECT,

                    properties:
                      {
                        documentType:
                          {
                            type:
                              Type.STRING,

                            description:
                              "Type of medical document such as Prescription, Lab Report, X-ray Report, MRI Report, CT Report, or Other.",
                          },

                        summary:
                          {
                            type:
                              Type.STRING,

                            description:
                              "Short factual summary based only on the uploaded document.",
                          },

                        patient:
                          {
                            type:
                              Type.OBJECT,

                            properties:
                              {
                                name:
                                  {
                                    type:
                                      Type.STRING,
                                  },

                                age:
                                  {
                                    type:
                                      Type.STRING,
                                  },

                                sex:
                                  {
                                    type:
                                      Type.STRING,
                                  },

                                patientId:
                                  {
                                    type:
                                      Type.STRING,
                                  },
                              },

                            required:
                              [
                                "name",
                                "age",
                                "sex",
                                "patientId",
                              ],
                          },

                        documentDate:
                          {
                            type:
                              Type.STRING,
                          },

                        medications:
                          {
                            type:
                              Type.ARRAY,

                            items:
                              {
                                type:
                                  Type.OBJECT,

                                properties:
                                  {
                                    name:
                                      {
                                        type:
                                          Type.STRING,
                                      },

                                    dosage:
                                      {
                                        type:
                                          Type.STRING,
                                      },

                                    frequency:
                                      {
                                        type:
                                          Type.STRING,
                                      },

                                    duration:
                                      {
                                        type:
                                          Type.STRING,
                                      },

                                    instructions:
                                      {
                                        type:
                                          Type.STRING,
                                      },
                                  },

                                required:
                                  [
                                    "name",
                                    "dosage",
                                    "frequency",
                                    "duration",
                                    "instructions",
                                  ],
                              },
                          },

                        labResults:
                          {
                            type:
                              Type.ARRAY,

                            items:
                              {
                                type:
                                  Type.OBJECT,

                                properties:
                                  {
                                    testName:
                                      {
                                        type:
                                          Type.STRING,
                                      },

                                    value:
                                      {
                                        type:
                                          Type.STRING,
                                      },

                                    unit:
                                      {
                                        type:
                                          Type.STRING,
                                      },

                                    referenceRange:
                                      {
                                        type:
                                          Type.STRING,
                                      },

                                    status:
                                      {
                                        type:
                                          Type.STRING,

                                        description:
                                          "Normal, High, Low, Abnormal, or empty if not determinable.",
                                      },
                                  },

                                required:
                                  [
                                    "testName",
                                    "value",
                                    "unit",
                                    "referenceRange",
                                    "status",
                                  ],
                              },
                          },

                        radiology:
                          {
                            type:
                              Type.OBJECT,

                            properties:
                              {
                                examination:
                                  {
                                    type:
                                      Type.STRING,
                                  },

                                bodyRegion:
                                  {
                                    type:
                                      Type.STRING,
                                  },

                                clinicalHistory:
                                  {
                                    type:
                                      Type.STRING,
                                  },

                                technique:
                                  {
                                    type:
                                      Type.STRING,
                                  },

                                findings:
                                  {
                                    type:
                                      Type.ARRAY,

                                    items:
                                      {
                                        type:
                                          Type.STRING,
                                      },
                                  },

                                impression:
                                  {
                                    type:
                                      Type.ARRAY,

                                    items:
                                      {
                                        type:
                                          Type.STRING,
                                      },
                                  },
                              },

                            required:
                              [
                                "examination",
                                "bodyRegion",
                                "clinicalHistory",
                                "technique",
                                "findings",
                                "impression",
                              ],
                          },

                        warnings:
                          {
                            type:
                              Type.ARRAY,

                            items:
                              {
                                type:
                                  Type.STRING,
                              },
                          },
                      },

                    required:
                      [
                        "documentType",
                        "summary",
                        "patient",
                        "documentDate",
                        "medications",
                        "labResults",
                        "radiology",
                        "warnings",
                      ],
                  },
                },
              }
            ),
          3
        );
    } catch (
      error: unknown
    ) {
      const message =
        getErrorMessage(
          error
        );

      const status =
        getErrorStatus(
          error
        );

      console.error(
        "Gemini API request failed after retries:",
        {
          status,
          message,
        }
      );

      /*
       * Quota / rate-limit.
       */

      if (
        status === 429 ||
        /429|RESOURCE_EXHAUSTED|quota/i.test(
          message
        )
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              "AI analysis is temporarily unavailable because the Gemini API request limit has been reached. Please try again after the quota resets.",

            code:
              "AI_QUOTA_EXCEEDED",
          },
          {
            status: 429,
          }
        );
      }

      /*
       * Temporary Gemini service congestion.
       */

      if (
        status === 503 ||
        /503|UNAVAILABLE|high demand|temporarily unavailable/i.test(
          message
        )
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              "The AI service is temporarily unavailable. Gemini is currently experiencing service congestion. Please try the document again in a moment.",

            code:
              "AI_SERVICE_UNAVAILABLE",
          },
          {
            status: 503,
          }
        );
      }

      /*
       * Other upstream errors.
       */

      return NextResponse.json(
        {
          success: false,

          error:
            "The AI service could not process this document. Please try again.",

          code:
            "AI_SERVICE_ERROR",
        },
        {
          status: 502,
        }
      );
    }

    /* -------------------------------------------------------
       READ GEMINI RESPONSE
       ------------------------------------------------------- */

    const text =
      response.text;

    if (
      !text ||
      !text.trim()
    ) {
      console.error(
        "Gemini returned an empty response."
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "The AI returned an empty response. Please try again.",

          code:
            "EMPTY_AI_RESPONSE",
        },
        {
          status: 502,
        }
      );
    }

    /* -------------------------------------------------------
       PARSE JSON
       ------------------------------------------------------- */

    let extractedData: unknown;

    try {
      extractedData =
        JSON.parse(
          text
        );
    } catch (
      error
    ) {
      console.error(
        "Invalid Gemini JSON response:",
        error
      );

      console.error(
        "Gemini response text:",
        text
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "The AI returned an invalid structured response. Please try again.",

          code:
            "INVALID_AI_RESPONSE",
        },
        {
          status: 502,
        }
      );
    }

    /* -------------------------------------------------------
       SUCCESS
       ------------------------------------------------------- */

    const documentType =
      (
        extractedData as {
          documentType?: string;
        }
      )?.documentType ||
      "Unknown";

    console.log(
      "JeevanLink document extraction completed:",
      documentType
    );

    return NextResponse.json({
      success: true,

      data:
        extractedData,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "JeevanLink document analysis error:",
      error
    );

    if (
      error instanceof Error &&
      error.message === "AUTHENTICATION_REQUIRED"
    ) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "FORBIDDEN"
    ) {
      return NextResponse.json(
        { success: false, error: "Only patients can analyze documents." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,

        error:
          "Unable to analyze this document. Please try again.",

        code:
          "DOCUMENT_ANALYSIS_ERROR",
      },
      {
        status: 500,
      }
    );
  }
}