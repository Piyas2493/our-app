import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/auth";

export const runtime = "nodejs";

/* =========================================================
   GET /api/clinician/patients
   Lightweight patient directory for the clinician to search
   when starting a new AI Medical Scribe note (or anything
   else that needs "pick a patient" rather than "I already
   have their record open").
   ========================================================= */

export async function GET(request: NextRequest) {
  try {
    await requireRole("CLINICIAN");

    const query = request.nextUrl.searchParams.get("q")?.trim() || "";

    const patients = await prisma.user.findMany({
      where: {
        role: "PATIENT",
        ...(query
          ? {
              OR: [
                { name: { contains: query } },
                { email: { contains: query } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 50,
    });

    return NextResponse.json({ success: true, patients });
  } catch (error) {
    console.error("GET /api/clinician/patients failed:", error);

    const message = error instanceof Error ? error.message : "";

    if (message === "AUTHENTICATION_REQUIRED") {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: "Only clinicians can list patients." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Unable to load patients." },
      { status: 500 },
    );
  }
}
