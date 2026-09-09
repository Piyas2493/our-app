import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

type TrendDirection = "UP" | "DOWN" | "STABLE" | "INSUFFICIENT_DATA";

function safePercent(change: number | null) {
  return change === null || !Number.isFinite(change)
    ? null
    : Number(change.toFixed(1));
}

function buildTrends(vitals: Array<{
  vitalType: string;
  value: number | null;
  secondaryValue: number | null;
  unit: string;
  recordedAt: Date;
  source: string;
}>) {
  const byType = new Map<string, typeof vitals>();

  for (const vital of vitals) {
    const list = byType.get(vital.vitalType) || [];
    list.push(vital);
    byType.set(vital.vitalType, list);
  }

  return [...byType.entries()].map(([vitalType, list]) => {
    const valid = list
      .filter((item) => typeof item.value === "number")
      .sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() -
          new Date(a.recordedAt).getTime()
      );

    const latest = valid[0];
    const previous = valid[1];

    const average =
      valid.length > 0
        ? valid.reduce((sum, item) => sum + (item.value || 0), 0) /
          valid.length
        : null;

    const changePercent =
      latest && previous && previous.value !== null && previous.value !== 0
        ? ((latest.value! - previous.value) / Math.abs(previous.value)) * 100
        : null;

    let direction: TrendDirection = "INSUFFICIENT_DATA";

    if (changePercent !== null) {
      if (Math.abs(changePercent) < 5) direction = "STABLE";
      else if (changePercent > 0) direction = "UP";
      else direction = "DOWN";
    }

    return {
      vitalType,
      latestValue: latest?.value ?? null,
      previousValue: previous?.value ?? null,
      averageValue: average === null ? null : Number(average.toFixed(1)),
      count: valid.length,
      changePercent: safePercent(changePercent),
      direction,
    };
  });
}

function getAdherence(
  reminders: Array<{
    status: "ACTIVE" | "DISABLED";
    logs: Array<{ status: "TAKEN" | "SKIPPED" | "SNOOZED" }>;
  }>
) {
  let taken = 0;
  let skipped = 0;
  let snoozed = 0;
  let activeReminders = 0;

  for (const reminder of reminders) {
    if (reminder.status === "ACTIVE") activeReminders += 1;
    for (const log of reminder.logs) {
      if (log.status === "TAKEN") taken += 1;
      if (log.status === "SKIPPED") skipped += 1;
      if (log.status === "SNOOZED") snoozed += 1;
    }
  }

  const completed = taken + skipped;
  const adherencePercent =
    completed > 0 ? Number(((taken / completed) * 100).toFixed(1)) : null;

  return {
    activeReminders,
    taken,
    skipped,
    snoozed,
    adherencePercent,
  };
}

function buildHeuristicInsights(input: {
  healthScore: number | null;
  coverage: number;
  trends: Array<{
    vitalType: string;
    changePercent: number | null;
    direction: TrendDirection;
    count: number;
  }>;
  medicationAdherence: number | null;
  verifiedRecords: number;
  verifiedMedications: number;
}) {
  const insights: Array<{
    title: string;
    text: string;
    kind: "positive" | "watch" | "neutral";
  }> = [];

  if (input.verifiedRecords > 0) {
    insights.push({
      title: "Clinician-verified history is available",
      text: `${input.verifiedRecords} verified medical record${input.verifiedRecords === 1 ? "" : "s"} are contributing context to this view.`,
      kind: "positive",
    });
  }

  if (input.medicationAdherence !== null) {
    if (input.medicationAdherence >= 80) {
      insights.push({
        title: "Medication adherence looks consistent",
        text: `Recorded reminder actions show ${input.medicationAdherence}% adherence among completed doses.`,
        kind: "positive",
      });
    } else if (input.medicationAdherence < 60) {
      insights.push({
        title: "Medication adherence needs attention",
        text: `Recorded reminder actions show ${input.medicationAdherence}% adherence among completed doses. This is a tracking signal, not a clinical judgment.`,
        kind: "watch",
      });
    } else {
      insights.push({
        title: "Medication adherence is mixed",
        text: `Recorded reminder actions show ${input.medicationAdherence}% adherence among completed doses.`,
        kind: "neutral",
      });
    }
  }

  const repeatedChanging = input.trends.filter(
    (trend) =>
      trend.count >= 2 &&
      trend.changePercent !== null &&
      Math.abs(trend.changePercent) >= 10
  );

  for (const trend of repeatedChanging.slice(0, 2)) {
    insights.push({
      title: `${trend.vitalType.replaceAll("_", " ")} has changed across readings`,
      text: `The latest reading is ${Math.abs(trend.changePercent!)}% ${
        trend.direction === "UP" ? "higher" : "lower"
      } than the previous available reading.`,
      kind: "watch",
    });
  }

  if (input.coverage < 50) {
    insights.push({
      title: "More longitudinal data would improve personalization",
      text: "JeevanLink currently has limited vital-type coverage, so the picture is incomplete.",
      kind: "neutral",
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: "Your personalized view is ready to grow",
      text: "As more verified records, medication actions, and repeated vital measurements are added, JeevanLink can provide richer continuity insights.",
      kind: "neutral",
    });
  }

  return insights;
}

async function buildContext() {
  const patient = await requireRole("PATIENT");

  const [records, medications, vitals] = await Promise.all([
    prisma.medicalRecord.findMany({
      where: {
        patientId: patient.id,
        status: "VERIFIED",
      },
      include: {
        medications: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.medication.findMany({
      where: {
        medicalRecord: {
          patientId: patient.id,
          status: "VERIFIED",
        },
      },
      include: {
        reminders: {
          include: {
            logs: {
              orderBy: {
                scheduledAt: "desc",
              },
              take: 30,
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.vitalMeasurement.findMany({
      where: {
        patientId: patient.id,
      },
      orderBy: {
        recordedAt: "desc",
      },
      take: 250,
    }),
  ]);

  return { patient, records, medications, vitals };
}

function buildResponseData({
  patient,
  records,
  medications,
  vitals,
}: Awaited<ReturnType<typeof buildContext>>) {
  const trends = buildTrends(vitals);

  const medicationItems = medications.map((medication) => ({
    id: medication.id,
    name: medication.name,
    dosage: medication.dosage,
    frequency: medication.frequency,
    ...getAdherence(medication.reminders),
  }));

  const totals = medicationItems.reduce(
    (acc, item) => {
      acc.taken += item.taken;
      acc.skipped += item.skipped;
      return acc;
    },
    { taken: 0, skipped: 0 }
  );

  const totalCompleted = totals.taken + totals.skipped;
  const overallAdherencePercent =
    totalCompleted > 0
      ? Number(((totals.taken / totalCompleted) * 100).toFixed(1))
      : null;

  const trackedTypes = new Set(vitals.map((item) => item.vitalType)).size;
  const coverage = Number(((trackedTypes / 6) * 100).toFixed(0));

  // Mirrors the existing Vitals module's continuity score concept without
  // claiming clinical risk.
  const healthScore = trackedTypes
    ? Math.round(
        Math.min(
          100,
          Math.max(
            0,
            trends.reduce((sum, trend) => {
              if (trend.direction === "INSUFFICIENT_DATA") return sum + 60;
              if (trend.direction === "STABLE") return sum + 85;
              return sum + 70;
            }, 0) /
              Math.max(1, trends.length) *
              0.8 +
              coverage * 0.2
          )
        )
      )
    : null;

  const dataGaps: string[] = [];

  if (records.length === 0) {
    dataGaps.push("No clinician-verified medical records are available yet.");
  }
  if (medications.length === 0) {
    dataGaps.push("No clinician-verified medications are available yet.");
  }
  if (vitals.length < 2) {
    dataGaps.push("At least two repeated measurements are needed to detect meaningful longitudinal changes.");
  }
  if (trackedTypes < 3) {
    dataGaps.push("Vital-type coverage is limited, so this personalized view is based on a partial data set.");
  }

  const snapshotHeadline =
    records.length === 0 && vitals.length === 0 && medications.length === 0
      ? "Your personalized health view is ready to collect context."
      : `Your JeevanLink health context is built from ${records.length} verified record${
          records.length === 1 ? "" : "s"
        }, ${medications.length} verified medication${
          medications.length === 1 ? "" : "s"
        }, and ${vitals.length} vital measurement${
          vitals.length === 1 ? "" : "s"
        }.`;

  const snapshotSupporting =
    "This view brings the information together so changes, adherence patterns, and missing data are easier to understand over time.";

  const latestByType = new Map<string, (typeof vitals)[number]>();
  for (const vital of vitals) {
    if (!latestByType.has(vital.vitalType)) {
      latestByType.set(vital.vitalType, vital);
    }
  }

  const latest = [...latestByType.values()].map((item) => ({
    vitalType: item.vitalType,
    value: item.value,
    secondaryValue: item.secondaryValue,
    unit: item.unit,
    recordedAt: item.recordedAt,
    source: item.source,
  }));

  const insights = buildHeuristicInsights({
    healthScore,
    coverage,
    trends,
    medicationAdherence: overallAdherencePercent,
    verifiedRecords: records.length,
    verifiedMedications: medications.length,
  });

  return {
    profile: {
      patientName: patient.name,
      verifiedRecords: records.length,
      verifiedMedications: medications.length,
      vitalMeasurements: vitals.length,
      dataSources: [
        ...(records.length ? ["Clinician-verified records"] : []),
        ...(medications.length ? ["Medication adherence"] : []),
        ...(vitals.length ? ["Vital measurements"] : []),
      ],
    },
    snapshot: {
      headline: snapshotHeadline,
      supportingText: snapshotSupporting,
      healthScore,
      coverage,
    },
    vitals: {
      latest,
      trends,
    },
    medications: {
      items: medicationItems,
      overallAdherencePercent,
    },
    records: records.map((record) => ({
      documentName: record.documentName,
      documentType: record.documentType,
      interpretation: record.interpretation,
      createdAt: record.createdAt,
    })),
    insights,
    dataGaps,
    safetyNote:
      "Personalized Health is an information and continuity layer. AI-generated observations are not a diagnosis, do not replace clinician judgment, and must not be used to change medication without professional advice.",
  };
}

const aiSchema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    supportingText: { type: Type.STRING },
    insights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          text: { type: Type.STRING },
          kind: {
            type: Type.STRING,
            enum: ["positive", "watch", "neutral"],
          },
        },
        required: ["title", "text", "kind"],
      },
    },
    dataGaps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["headline", "supportingText", "insights", "dataGaps"],
} as const;

export async function GET() {
  try {
    const context = await buildContext();
    const data = buildResponseData(context);

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("Personalized health GET failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load personalized health.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await buildContext();
    const base = buildResponseData(context);

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "GEMINI_API_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    const acceptLanguage = request.headers.get("accept-language") || "en";
    const language = acceptLanguage.split(",")[0].trim() || "en";

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
You are generating the Personalized Health explanation layer for JeevanLink.

Respond in the user's preferred language when possible. Preferred language hint:
${language}

IMPORTANT SAFETY RULES:
- Do not diagnose disease.
- Do not recommend starting, stopping, increasing, or decreasing medication.
- Do not invent patient facts.
- Do not convert a wellness/continuity signal into a clinical-risk judgment.
- Distinguish observations from conclusions.
- Explicitly mention missing data when it affects interpretation.
- Keep advice limited to reasonable tracking, discussion with a clinician, and data-quality steps.

PATIENT CONTEXT:
${JSON.stringify(
  {
    profile: base.profile,
    snapshot: base.snapshot,
    vitals: base.vitals,
    medications: base.medications,
    records: base.records,
    existingInsights: base.insights,
    existingDataGaps: base.dataGaps,
  },
  null,
  2
)}
`;

    /*
     * Gemini 503 UNAVAILABLE is a transient server-side capacity error.
     * Use bounded exponential backoff, then fall back to the deterministic
     * insights already calculated above. This keeps Personalized Health
     * useful even when the AI service is temporarily unavailable.
     */
    async function generateWithRetry() {
      const models = [
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
      ];

      let lastError: unknown = null;

      for (const model of models) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            return await ai.models.generateContent({
              model,
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: aiSchema,
              },
            });
          } catch (error) {
            lastError = error;

            const message =
              error instanceof Error
                ? error.message
                : String(error);

            const isTransient =
              /\b(503|UNAVAILABLE|high demand|temporarily|overloaded)\b/i.test(
                message
              );

            if (!isTransient || attempt === 2) {
              break;
            }

            const baseDelay = 1500 * 2 ** attempt;
            const jitter = Math.floor(Math.random() * 600);

            await new Promise((resolve) =>
              setTimeout(resolve, baseDelay + jitter)
            );
          }
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new Error("AI service is temporarily unavailable.");
    }

    let generated: {
      headline: string;
      supportingText: string;
      insights: Array<{
        title: string;
        text: string;
        kind: "positive" | "watch" | "neutral";
      }>;
      dataGaps: string[];
    } = {
      headline: base.snapshot.headline,
      supportingText: base.snapshot.supportingText,
      insights: base.insights,
      dataGaps: base.dataGaps,
    };

    let aiUnavailable = false;

    try {
      const response = await generateWithRetry();
      generated = JSON.parse(response.text || "{}");
    } catch (error) {
      aiUnavailable = true;
      console.warn(
        "Personalized Health AI unavailable; using deterministic insights:",
        error
      );
    }

    return NextResponse.json({
      success: true,
      aiGenerated: !aiUnavailable,
      aiUnavailable,
      ...base,
      snapshot: {
        ...base.snapshot,
        headline: generated.headline || base.snapshot.headline,
        supportingText:
          generated.supportingText || base.snapshot.supportingText,
      },
      insights:
        Array.isArray(generated.insights) && generated.insights.length > 0
          ? generated.insights.slice(0, 8)
          : base.insights,
      dataGaps:
        Array.isArray(generated.dataGaps) && generated.dataGaps.length > 0
          ? generated.dataGaps.slice(0, 8)
          : base.dataGaps,
    });
  } catch (error) {
    console.error("Personalized health AI failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate personalized health insights.",
      },
      { status: 500 }
    );
  }
}
