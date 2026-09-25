import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/auth";

export const runtime = "nodejs";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/*
 * GET -- the patient's own referrals plus the hospital list, so the
 * create form can populate its facility dropdowns from one request.
 */
export async function GET() {
  try {
    const patient = await requireRole("PATIENT");

    const [referrals, hospitals] = await Promise.all([
      prisma.referral.findMany({
        where: { patientId: patient.id },
        include: { fromFacility: true, toFacility: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.hospital.findMany({ orderBy: { name: "asc" } }),
    ]);

    return NextResponse.json({ success: true, referrals, hospitals });
  } catch (error) {
    console.error("Unable to fetch referrals:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to fetch referrals.",
      },
      { status: 500 }
    );
  }
}

/* POST -- create a referral. patientId is never trusted from the browser. */
export async function POST(request: NextRequest) {
  try {
    const patient = await requireRole("PATIENT");
    const body = await request.json();

    const toFacilityId = optionalString(body?.toFacilityId);
    const reason = optionalString(body?.reason);
    const fromFacilityId = optionalString(body?.fromFacilityId);

    if (!toFacilityId || !reason) {
      return NextResponse.json(
        { success: false, error: "toFacilityId and reason are required." },
        { status: 400 }
      );
    }

    const toFacility = await prisma.hospital.findUnique({ where: { id: toFacilityId } });
    if (!toFacility) {
      return NextResponse.json(
        { success: false, error: "Referral facility not found." },
        { status: 404 }
      );
    }

    const referral = await prisma.referral.create({
      data: { patientId: patient.id, toFacilityId, fromFacilityId, reason },
      include: { fromFacility: true, toFacility: true },
    });

    return NextResponse.json({ success: true, referral });
  } catch (error) {
    console.error("Unable to create referral:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to create referral.",
      },
      { status: 500 }
    );
  }
}

/* PATCH -- update a referral's status (accept / complete / decline). */
export async function PATCH(request: NextRequest) {
  try {
    const patient = await requireRole("PATIENT");
    const body = await request.json();

    const id = optionalString(body?.id);
    const status = optionalString(body?.status);
    const allowedStatuses = ["ACCEPTED", "COMPLETED", "DECLINED"];

    if (!id || !status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: "id and a valid status (ACCEPTED, COMPLETED, or DECLINED) are required." },
        { status: 400 }
      );
    }

    const existing = await prisma.referral.findFirst({ where: { id, patientId: patient.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Referral not found." }, { status: 404 });
    }

    const referral = await prisma.referral.update({
      where: { id },
      data: {
        status: status as "ACCEPTED" | "COMPLETED" | "DECLINED",
        acceptedAt: status === "ACCEPTED" ? new Date() : existing.acceptedAt,
        completedAt: status === "COMPLETED" ? new Date() : existing.completedAt,
      },
      include: { fromFacility: true, toFacility: true },
    });

    return NextResponse.json({ success: true, referral });
  } catch (error) {
    console.error("Unable to update referral:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to update referral.",
      },
      { status: 500 }
    );
  }
}
