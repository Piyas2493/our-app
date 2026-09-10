import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";

/* =========================================================
   GET /api/admin/overview
   Read-only operational snapshot for the admin console:
   user counts by role, record status breakdown, ticket
   queue health, and a short recent-activity feed. No
   mutation endpoints exist here on purpose -- account and
   record management deserve their own deliberate design
   pass rather than being bolted onto a monitoring view.
   ========================================================= */

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Only administrators can view this." },
        { status: 403 },
      );
    }

    const [
      totalUsers,
      patientCount,
      clinicianCount,
      helpdeskCount,
      adminCount,
      totalRecords,
      pendingRecords,
      verifiedRecords,
      rejectedRecords,
      totalTickets,
      openTickets,
      assignedTickets,
      inProgressTickets,
      waitingTickets,
      resolvedTickets,
      closedTickets,
      pendingCallbacks,
      totalConsentEvents,
      recentUsers,
      recentRecords,
      recentTickets,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "PATIENT" } }),
      prisma.user.count({ where: { role: "CLINICIAN" } }),
      prisma.user.count({ where: { role: "HELPDESK" } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.medicalRecord.count(),
      prisma.medicalRecord.count({ where: { status: "PENDING" } }),
      prisma.medicalRecord.count({ where: { status: "VERIFIED" } }),
      prisma.medicalRecord.count({ where: { status: "REJECTED" } }),
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: "OPEN" } }),
      prisma.ticket.count({ where: { status: "ASSIGNED" } }),
      prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),
      prisma.ticket.count({ where: { status: "WAITING" } }),
      prisma.ticket.count({ where: { status: "RESOLVED" } }),
      prisma.ticket.count({ where: { status: "CLOSED" } }),
      prisma.ticket.count({
        where: { callbackRequested: true, callbackCompletedAt: null },
      }),
      prisma.consentEvent.count(),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
      prisma.medicalRecord.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          patientName: true,
          documentType: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.ticket.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
          requester: { select: { name: true, role: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      users: {
        total: totalUsers,
        patients: patientCount,
        clinicians: clinicianCount,
        helpdesk: helpdeskCount,
        admins: adminCount,
      },
      records: {
        total: totalRecords,
        pending: pendingRecords,
        verified: verifiedRecords,
        rejected: rejectedRecords,
      },
      tickets: {
        total: totalTickets,
        open: openTickets,
        active: assignedTickets + inProgressTickets,
        waiting: waitingTickets,
        resolved: resolvedTickets,
        closed: closedTickets,
        pendingCallbacks,
      },
      consent: {
        totalEvents: totalConsentEvents,
      },
      recentUsers,
      recentRecords,
      recentTickets,
    });
  } catch (error) {
    console.error("GET /api/admin/overview failed:", error);

    return NextResponse.json(
      { success: false, error: "Unable to load the admin overview." },
      { status: 500 },
    );
  }
}
