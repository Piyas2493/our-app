import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { parseClinicalIntake } from "@/app/lib/clinicalIntake";

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
      totalFacilities,
      activeAdmissions,
      referralCounts,
      pendingIntakeRecords,
      facilities,
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
      prisma.hospital.count(),
      prisma.hospitalAdmission.count({ where: { status: "ADMITTED" } }),
      prisma.referral.groupBy({ by: ["status"], _count: { _all: true } }),
      // Escalations aren't a stored column -- a red flag is detected at
      // clinical-intake submission time and lives inside the record's
      // JSON `interpretation` (see clinician/page.tsx's getCaseRedFlags).
      // Pending-only keeps this a small, human-reviewable set.
      prisma.medicalRecord.findMany({
        where: { status: "PENDING", documentType: "CLINICAL_INTAKE" },
        select: { interpretation: true },
      }),
      prisma.hospital.findMany({
        select: {
          id: true,
          name: true,
          city: true,
          _count: { select: { admissions: true, referralsTo: true } },
        },
        orderBy: { name: "asc" },
        take: 10,
      }),
    ]);

    const escalations = pendingIntakeRecords.filter(
      (record) => (parseClinicalIntake(record.interpretation || "")?.redFlags.length ?? 0) > 0,
    ).length;

    const referralsByStatus = { PENDING: 0, ACCEPTED: 0, COMPLETED: 0, DECLINED: 0 };
    for (const group of referralCounts) {
      referralsByStatus[group.status as keyof typeof referralsByStatus] = group._count._all;
    }

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
      facilities: {
        total: totalFacilities,
        activeAdmissions,
        referrals: referralsByStatus,
        escalations,
        list: facilities.map((hospital) => ({
          id: hospital.id,
          name: hospital.name,
          city: hospital.city,
          admissions: hospital._count.admissions,
          incomingReferrals: hospital._count.referralsTo,
        })),
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
