import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/auth";

export const runtime = "nodejs";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* GET -- the patient's own appointments plus the facility list for the request form. */
export async function GET() {
  try {
    const patient = await requireRole("PATIENT");

    const [appointments, hospitals] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientId: patient.id },
        include: { facility: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.hospital.findMany({ orderBy: { name: "asc" } }),
    ]);

    return NextResponse.json({ success: true, appointments, hospitals });
  } catch (error) {
    console.error("Unable to fetch appointments:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to fetch appointments.",
      },
      { status: 500 }
    );
  }
}

/* POST -- request an appointment. patientId is never trusted from the browser. */
export async function POST(request: NextRequest) {
  try {
    const patient = await requireRole("PATIENT");
    const body = await request.json();

    const facilityId = optionalString(body?.facilityId);
    const reason = optionalString(body?.reason);
    const preferredAt = optionalDate(body?.preferredAt);

    if (!facilityId || !reason) {
      return NextResponse.json(
        { success: false, error: "facilityId and reason are required." },
        { status: 400 }
      );
    }

    const facility = await prisma.hospital.findUnique({ where: { id: facilityId } });
    if (!facility) {
      return NextResponse.json(
        { success: false, error: "Facility not found." },
        { status: 404 }
      );
    }

    const appointment = await prisma.appointment.create({
      data: { patientId: patient.id, facilityId, reason, preferredAt },
      include: { facility: true },
    });

    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    console.error("Unable to create appointment:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to create appointment.",
      },
      { status: 500 }
    );
  }
}

/* PATCH -- move an appointment through the queue (queued / seen / cancelled). */
export async function PATCH(request: NextRequest) {
  try {
    const patient = await requireRole("PATIENT");
    const body = await request.json();

    const id = optionalString(body?.id);
    const status = optionalString(body?.status);
    const allowedStatuses = ["QUEUED", "SEEN", "CANCELLED"];

    if (!id || !status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: "id and a valid status (QUEUED, SEEN, or CANCELLED) are required." },
        { status: 400 }
      );
    }

    const existing = await prisma.appointment.findFirst({ where: { id, patientId: patient.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Appointment not found." }, { status: 404 });
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status: status as "QUEUED" | "SEEN" | "CANCELLED" },
      include: { facility: true },
    });

    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    console.error("Unable to update appointment:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to update appointment.",
      },
      { status: 500 }
    );
  }
}
