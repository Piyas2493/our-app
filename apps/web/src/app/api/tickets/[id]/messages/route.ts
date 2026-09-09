import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";

/* =========================================================
   POST /api/tickets/[id]/messages
   Adds a reply. The requester or helpdesk staff can post.
   Only helpdesk staff can mark a reply as an internal note.
   ========================================================= */

export async function POST(
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

    const { id } = await params;

    const ticket = await prisma.ticket.findUnique({ where: { id } });

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

    if (ticket.status === "CLOSED") {
      return NextResponse.json(
        { success: false, error: "This ticket is closed." },
        { status: 400 },
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

    const { message: messageText, isInternalNote } = (body ?? {}) as {
      message?: unknown;
      isInternalNote?: unknown;
    };

    const cleanMessage =
      typeof messageText === "string" ? messageText.trim() : "";

    if (!cleanMessage) {
      return NextResponse.json(
        { success: false, error: "Message text is required." },
        { status: 400 },
      );
    }

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        authorId: user.id,
        body: cleanMessage,
        isInternalNote: isHelpdesk && isInternalNote === true,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
    });

    /*
     * A patient/clinician replying to a WAITING ticket brings it back
     * into the active queue. A helpdesk reply on an OPEN ticket moves
     * it forward automatically.
     */
    if (!isHelpdesk && ticket.status === "WAITING") {
      await prisma.ticket.update({
        where: { id },
        data: { status: "IN_PROGRESS" },
      });
    } else if (isHelpdesk && ticket.status === "OPEN") {
      await prisma.ticket.update({
        where: { id },
        data: { status: "IN_PROGRESS", assignedToId: ticket.assignedToId ?? user.id },
      });
    }

    return NextResponse.json({ success: true, message }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tickets/[id]/messages failed:", error);

    return NextResponse.json(
      { success: false, error: "Unable to post message." },
      { status: 500 },
    );
  }
}
