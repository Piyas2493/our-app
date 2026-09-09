import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/app/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const LANGUAGE_CODES: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  te: "te-IN",
  mr: "mr-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  or: "or-IN",
  as: "as-IN",
};

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

function pcmToWav(
  pcm: Buffer,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16,
) {
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;

  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);

  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("PATIENT");

    const body = await request.json().catch(() => null);

    const text =
      typeof body?.text === "string"
        ? body.text.trim()
        : "";

    const language =
      typeof body?.language === "string"
        ? body.language.trim().toLowerCase()
        : "en";

    if (!text) {
      return NextResponse.json(
        {
          success: false,
          error: "Text to speak is required.",
        },
        { status: 400 },
      );
    }

    if (text.length > 4000) {
      return NextResponse.json(
        {
          success: false,
          error: "The text is too long for speech generation.",
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GEMINI_API_KEY is not configured.",
        },
        { status: 503 },
      );
    }

    const languageCode =
      LANGUAGE_CODES[language] || LANGUAGE_CODES.en;

    const languageName =
      LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en;

    const prompt = `
Read the following text aloud exactly as written.

Do NOT translate it.
Do NOT summarize it.
Do NOT add or remove information.

Speak naturally in ${languageName} as spoken in India.
Use pronunciation appropriate for ${languageCode}.
Use a clear, calm clinical-education voice.

Text:
${text}
`;

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Kore",
                },
              },
            },
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();

      console.error(
        "Gemini TTS error:",
        geminiResponse.status,
        errorText,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini speech generation failed.",
          details: errorText,
        },
        { status: 502 },
      );
    }

    const data = await geminiResponse.json();

    const base64Audio =
      data?.candidates?.[0]?.content?.parts?.find(
        (part: {
          inlineData?: {
            data?: string;
          };
        }) => Boolean(part?.inlineData?.data),
      )?.inlineData?.data;

    if (!base64Audio) {
      console.error(
        "No audio returned by Gemini:",
        JSON.stringify(data).slice(0, 3000),
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini returned no audio data.",
        },
        { status: 502 },
      );
    }

    const pcm = Buffer.from(
      base64Audio,
      "base64",
    );

    const wav = pcmToWav(pcm);

    return new NextResponse(
      new Uint8Array(wav),
      {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Content-Length": String(wav.length),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "Clinical intake TTS route failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate the spoken explanation.",
      },
      { status: 500 },
    );
  }
}