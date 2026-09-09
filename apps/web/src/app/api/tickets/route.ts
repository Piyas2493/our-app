import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";

/* =========================================================
   TYPES
   ========================================================= */

const VALID_CATEGORIES = [
  "ACCOUNT",
  "APPOINTMENT",
  "TECHNICAL",
  "RECORD_CORRECTION",
  "BILLING",
  "OTHER",
] as const;

const VALID_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

const VALID_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
] as const;

type TicketCategory = (typeof VALID_CATEGORIES)[number];
type TicketPriority = (typeof VALID_PRIORITIES)[number];
type TicketStatus = (typeof VALID_STATUSES)[number];

function isValid<T extends string>(
  value: unknown,
  options: readonly T[],
): value is T {
  return typeof value === "string" && options.includes(value as T);
}

/* =========================================================
   GET /api/tickets
   PATIENT / CLINICIAN see only their own tickets.
   HELPDESK sees the full queue, optionally filtered by status.
   ========================================================= */

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");

    if (statusParam && !isValid(statusParam, VALID_STATUSES)) {
      return NextResponse.json(
        { success: false, error: "Invalid status filter." },
        { status: 400 },
      );
    }

    const where =
      user.role === "HELPDESK"
        ? statusParam
          ? { status: statusParam as TicketStatus }
          : {}
        : { requesterId: user.id };

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        requester: { select: { id: true, name: true, role: true } },
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({ success: true, tickets });
  } catch (error) {
    console.error("GET /api/tickets failed:", error);

    return NextResponse.json(
      { success: false, error: "Unable to load tickets." },
      { status: 500 },
    );
  }
}

/* =========================================================
   POST /api/tickets
   Any authenticated user (patient, clinician, or helpdesk)
   can raise a support ticket.
   ========================================================= */

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request." },
        { status: 400 },
      );
    }

    const {
      subject,
      description,
      category,
      priority,
      relatedRecordId,
      callbackRequested,
      callbackPhone,
    } = (body ?? {}) as {
      subject?: unknown;
      description?: unknown;
      category?: unknown;
      priority?: unknown;
      relatedRecordId?: unknown;
      callbackRequested?: unknown;
      callbackPhone?: unknown;
    };

    const cleanSubject = typeof subject === "string" ? subject.trim() : "";
    const cleanDescription =
      typeof description === "string" ? description.trim() : "";

    if (!cleanSubject) {
      return NextResponse.json(
        { success: false, error: "Subject is required." },
        { status: 400 },
      );
    }

    if (!cleanDescription) {
      return NextResponse.json(
        { success: false, error: "Description is required." },
        { status: 400 },
      );
    }

    if (category !== undefined && !isValid(category, VALID_CATEGORIES)) {
      return NextResponse.json(
        { success: false, error: "Invalid category." },
        { status: 400 },
      );
    }

    if (priority !== undefined && !isValid(priority, VALID_PRIORITIES)) {
      return NextResponse.json(
        { success: false, error: "Invalid priority." },
        { status: 400 },
      );
    }

    const wantsCallback = callbackRequested === true;
    const cleanCallbackPhone =
      typeof callbackPhone === "string" ? callbackPhone.trim() : "";

    if (wantsCallback && !cleanCallbackPhone) {
      return NextResponse.json(
        { success: false, error: "A phone number is required to request a callback." },
        { status: 400 },
      );
    }

    const existingCount = await prisma.ticket.count();
    const ticketNumber = `JL-${String(existingCount + 1).padStart(6, "0")}`;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId: user.id,
        subject: cleanSubject,
        description: cleanDescription,
        category: (category as TicketCategory) ?? "OTHER",
        priority: (priority as TicketPriority) ?? "NORMAL",
        status: "OPEN",
        relatedRecordId:
          typeof relatedRecordId === "string" && relatedRecordId.trim()
            ? relatedRecordId.trim()
            : null,
        callbackRequested: wantsCallback,
        callbackPhone: wantsCallback ? cleanCallbackPhone : null,
        messages: {
          create: {
            authorId: user.id,
            body: cleanDescription,
          },
        },
      },
      include: {
        requester: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json(
      { success: true, message: "Ticket submitted.", ticket },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/tickets failed:", error);

    return NextResponse.json(
      { success: false, error: "Unable to submit ticket." },
      { status: 500 },
    );
  }
}
