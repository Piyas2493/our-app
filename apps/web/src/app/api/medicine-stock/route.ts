import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser, requireRole } from "@/app/lib/auth";

export const runtime = "nodejs";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/* GET -- read-only for any signed-in user (patient or admin). */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    const [stock, hospitals] = await Promise.all([
      prisma.medicineStock.findMany({
        include: { facility: true },
        orderBy: [{ facility: { name: "asc" } }, { medicineName: "asc" }],
      }),
      prisma.hospital.findMany({ orderBy: { name: "asc" } }),
    ]);

    return NextResponse.json({ success: true, stock, hospitals });
  } catch (error) {
    console.error("Unable to fetch medicine stock:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to fetch medicine stock.",
      },
      { status: 500 }
    );
  }
}

/*
 * POST -- admin-only. Upserts by (facilityId, medicineName), so setting
 * an entry's status is the same call as creating it -- no separate
 * create/update pair or client-tracked id needed.
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole("ADMIN");
    const body = await request.json();

    const facilityId = optionalString(body?.facilityId);
    const medicineName = optionalString(body?.medicineName);
    const status = optionalString(body?.status);
    const allowedStatuses = ["AVAILABLE", "LOW", "OUT"];

    if (!facilityId || !medicineName || !status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: "facilityId, medicineName and a valid status (AVAILABLE, LOW, or OUT) are required.",
        },
        { status: 400 }
      );
    }

    const facility = await prisma.hospital.findUnique({ where: { id: facilityId } });
    if (!facility) {
      return NextResponse.json({ success: false, error: "Facility not found." }, { status: 404 });
    }

    const entry = await prisma.medicineStock.upsert({
      where: { facilityId_medicineName: { facilityId, medicineName } },
      create: { facilityId, medicineName, status: status as "AVAILABLE" | "LOW" | "OUT" },
      update: { status: status as "AVAILABLE" | "LOW" | "OUT" },
      include: { facility: true },
    });

    return NextResponse.json({ success: true, entry });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: "Only administrators can update medicine availability." },
        { status: 403 }
      );
    }
    console.error("Unable to update medicine stock:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to update medicine stock.",
      },
      { status: 500 }
    );
  }
}
