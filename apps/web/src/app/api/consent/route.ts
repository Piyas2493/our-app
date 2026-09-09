import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";

/* =========================================================
   TYPES
   ========================================================= */

const VALID_CATEGORIES = [
  "CLINICAL_HISTORY",
  "DOCUMENT_PROCESSING",
  "CLINICIAN_SHARING",
  "RESEARCH_DATA_SHARING",
  "REMINDERS_NOTIFICATIONS",
] as const;

type ConsentCategory = (typeof VALID_CATEGORIES)[number];

function isValidCategory(value: unknown): value is ConsentCategory {
  return (
    typeof value === "string" &&
    VALID_CATEGORIES.includes(value as ConsentCategory)
  );
}

/* =========================================================
   GET /api/consent
   Returns the current status per category (the latest event
   for each) plus the full chronological history.
   ========================================================= */

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    if (user.role !== "PATIENT") {
      return NextResponse.json(
        { success: false, error: "Only patients manage their own consent." },
        { status: 403 }
      );
    }

    const events = await prisma.consentEvent.findMany({
      where: { patientId: user.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const current: Partial<Record<ConsentCategory, (typeof events)[number]>> = {};

    for (const event of events) {
      const category = event.category as ConsentCategory;
      if (!current[category]) {
        current[category] = event;
      }
    }

    const statuses = VALID_CATEGORIES.map((category) => {
      const latest = current[category];

      return {
        category,
        granted: latest?.granted ?? false,
        updatedAt: latest?.createdAt ?? null,
        source: latest?.source ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      statuses,
      history: events,
    });
  } catch (error) {
    console.error("GET /api/consent failed:", error);

    return NextResponse.json(
      { success: false, error: "Unable to load consent records." },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST /api/consent
   Records a grant or revoke event. Never mutates a prior
   event — every change is a new, independently auditable row.
   ========================================================= */

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    if (user.role !== "PATIENT") {
      return NextResponse.json(
        { success: false, error: "Only patients manage their own consent." },
        { status: 403 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request." },
        { status: 400 }
      );
    }

    const { category, granted, notes } = (body ?? {}) as {
      category?: unknown;
      granted?: unknown;
      notes?: unknown;
    };

    if (!isValidCategory(category)) {
      return NextResponse.json(
        { success: false, error: "Invalid consent category." },
        { status: 400 }
      );
    }

    if (typeof granted !== "boolean") {
      return NextResponse.json(
        { success: false, error: "granted must be a boolean." },
        { status: 400 }
      );
    }

    const event = await prisma.consentEvent.create({
      data: {
        patientId: user.id,
        category,
        granted,
        source: "CONSENT_CENTER",
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: granted
          ? "Consent recorded."
          : "Consent revoked.",
        event,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/consent failed:", error);

    return NextResponse.json(
      { success: false, error: "Unable to update consent." },
      { status: 500 }
    );
  }
}
