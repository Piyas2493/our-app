import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";

const VALID_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
] as const;

const VALID_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

type TicketStatus = (typeof VALID_STATUSES)[number];
type TicketPriority = (typeof VALID_PRIORITIES)[number];

function isValid<T extends string>(
  value: unknown,
  options: readonly T[],
): value is T {
  return typeof value === "string" && options.includes(value as T);
}

/* =========================================================
   GET /api/tickets/[id]
   Visible to the requester or to helpdesk staff.
   ========================================================= */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, name: true, role: true } },
        assignedTo: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "Ticket not found." },
        { status: 404 },
      );
    }

    const isOwner = ticket.requesterId === user.id;
    const isHelpdesk = user.role === "HELPDESK";

    if (!isOwner && !isHelpdesk) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this ticket." },
        { status: 403 },
      );
    }

    /*
     * Internal notes are staff-only.
     */
    const visibleMessages = isHelpdesk
      ? ticket.messages
      : ticket.messages.filter((message) => !message.isInternalNote);

    return NextResponse.json({
      success: true,
      ticket: { ...ticket, messages: visibleMessages },
    });
  } catch (error) {
    console.error("GET /api/tickets/[id] failed:", error);

    return NextResponse.json(
      { success: false, error: "Unable to load ticket." },
      { status: 500 },
    );
  }
}

/* =========================================================
   PATCH /api/tickets/[id]
   Helpdesk-only: update status, priority, or assignment.
   ========================================================= */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    if (user.role !== "HELPDESK") {
      return NextResponse.json(
        { success: false, error: "Only helpdesk staff can update tickets." },
        { status: 403 },
      );
    }

    const { id } = await params;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request." },
        { status: 400 },
      );
    }

    const { status, priority, assignToSelf, markCallbackDone } = (body ?? {}) as {
      status?: unknown;
      priority?: unknown;
      assignToSelf?: unknown;
      markCallbackDone?: unknown;
    };

    if (status !== undefined && !isValid(status, VALID_STATUSES)) {
      return NextResponse.json(
        { success: false, error: "Invalid status." },
        { status: 400 },
      );
    }

    if (priority !== undefined && !isValid(priority, VALID_PRIORITIES)) {
      return NextResponse.json(
        { success: false, error: "Invalid priority." },
        { status: 400 },
      );
    }

    const existing = await prisma.ticket.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Ticket not found." },
        { status: 404 },
      );
    }

    const data: {
      status?: TicketStatus;
      priority?: TicketPriority;
      assignedToId?: string;
      resolvedAt?: Date | null;
      closedAt?: Date | null;
      callbackCompletedAt?: Date;
    } = {};

    if (status) {
      data.status = status as TicketStatus;
      data.resolvedAt =
        status === "RESOLVED" ? new Date() : existing.resolvedAt;
      data.closedAt = status === "CLOSED" ? new Date() : existing.closedAt;
    }

    if (priority) {
      data.priority = priority as TicketPriority;
    }

    if (assignToSelf === true) {
      data.assignedToId = user.id;
      if (existing.status === "OPEN") {
        data.status = "ASSIGNED";
      }
    }

    if (markCallbackDone === true && existing.callbackRequested) {
      data.callbackCompletedAt = new Date();
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data,
      include: {
        requester: { select: { id: true, name: true, role: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    console.error("PATCH /api/tickets/[id] failed:", error);

    return NextResponse.json(
      { success: false, error: "Unable to update ticket." },
      { status: 500 },
    );
  }
}
