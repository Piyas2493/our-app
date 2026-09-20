import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";
import { extractOcrText } from "@/app/lib/ocr";
import { extractHandwritingText } from "@/app/lib/handwritingOcr";
import { generateGeminiWithRetry, getErrorMessage, getErrorStatus } from "@/app/lib/geminiRetry";
import { ALLOWED_DOCUMENT_MIME_TYPES } from "@/app/lib/documentStorage";

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

    if (
      !ALLOWED_DOCUMENT_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number]
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
       OCR -- two independent, best-effort grounding passes for
       Gemini, never a replacement for it. Both skipped for PDFs.
       Run in parallel; neither blocks on the other, and either
       failing/being unreachable just means less grounding text,
       not a failed request. See ocr.ts and handwritingOcr.ts.
       ------------------------------------------------------- */

    const [ocrText, handwritingText] = await Promise.all([
      extractOcrText(Buffer.from(bytes), file.type),
      extractHandwritingText(Buffer.from(bytes), file.type),
    ]);

    const ocrSection = ocrText
      ? `

An automated OCR pass (Tesseract, tuned for printed text) over this
image produced the following raw text. It is UNVERIFIED and may contain
recognition errors -- use it only to help read faint or unclear print in
the image itself. The image remains the source of truth: never extract
a value that appears only in this OCR text and is not actually visible
in the image.

PRINTED-TEXT OCR:
"""
${ocrText}
"""
`
      : "";

    const handwritingSection = handwritingText
      ? `

A second, independent OCR pass (a handwriting-recognition model, not
fine-tuned on clinical handwriting) over this image produced the
following raw text. It is UNVERIFIED and likely LESS RELIABLE than the
printed-text pass above -- use it only as a weak hint for handwritten
portions of the document. The image remains the source of truth: never
extract a value that appears only in this text and is not actually
visible in the image.

HANDWRITING OCR (low confidence):
"""
${handwritingText}
"""
`
      : "";

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
${ocrSection}${handwritingSection}`;

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
          { label: "Gemini request", delays: [5000, 15000, 30000], jitterMs: 1500 }
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

      ocrUsed: Boolean(ocrText),
      handwritingOcrUsed: Boolean(handwritingText),
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