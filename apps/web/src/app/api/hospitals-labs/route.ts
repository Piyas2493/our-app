import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { requireRole } from "@/app/lib/auth";

export const runtime = "nodejs";

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function numberOrZero(value: unknown): number {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

/*
 * =========================================================
 * GET
 *
 * Patient can only see their own hospital/lab context.
 * =========================================================
 */

export async function GET() {
  try {
    const patient = await requireRole("PATIENT");

    const [
      admissions,
      encounters,
      labOrders,
      labReports,
    ] = await Promise.all([
      prisma.hospitalAdmission.findMany({
        where: {
          patientId: patient.id,
        },
        include: {
          hospital: true,

          encounters: {
            orderBy: {
              encounterDate: "desc",
            },
          },

          tests: {
            orderBy: {
              orderedAt: "desc",
            },
          },

          procedures: {
            orderBy: {
              scheduledAt: "desc",
            },
          },

          bills: {
            include: {
              items: {
                orderBy: {
                  createdAt: "asc",
                },
              },

              insuranceClaims: {
                orderBy: {
                  createdAt: "desc",
                },
              },
            },

            orderBy: {
              issuedAt: "desc",
            },
          },

          insuranceClaims: {
            include: {
              bill: true,
            },

            orderBy: {
              createdAt: "desc",
            },
          },
        },

        orderBy: {
          admissionDate: "desc",
        },
      }),

      prisma.hospitalEncounter.findMany({
        where: {
          patientId: patient.id,
        },

        include: {
          admission: {
            include: {
              hospital: true,
            },
          },
        },

        orderBy: {
          encounterDate: "desc",
        },
      }),

      prisma.labOrder.findMany({
        where: {
          patientId: patient.id,
        },

        include: {
          lab: true,

          reports: {
            orderBy: {
              reportDate: "desc",
            },
          },
        },

        orderBy: {
          orderedAt: "desc",
        },
      }),

      prisma.labReport.findMany({
        where: {
          patientId: patient.id,
        },

        include: {
          lab: true,

          labOrder: true,

          medicalRecord: {
            select: {
              id: true,
              status: true,
              documentName: true,
              documentType: true,
              verifiedAt: true,
            },
          },
        },

        orderBy: {
          reportDate: "desc",
        },
      }),
    ]);

    return NextResponse.json({
      success: true,

      patient: {
        id: patient.id,
        name: patient.name,
      },

      hospital: {
        admissions,
        encounters,
      },

      labs: {
        orders: labOrders,
        reports: labReports,
      },
    });
  } catch (error) {
    console.error("Unable to fetch Hospitals & Labs data:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to fetch Hospitals & Labs data.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * =========================================================
 * POST
 *
 * The API supports controlled creation of:
 * 1. Hospital
 * 2. Hospital admission
 * 3. Hospital encounter
 * 4. Hospital test
 * 5. Hospital procedure
 * 6. Hospital bill
 * 7. Insurance claim
 * 8. Lab
 * 9. Lab order
 * 10. Lab report
 *
 * patientId is NEVER trusted from the browser.
 * The authenticated patient is used instead.
 * =========================================================
 */

export async function POST(request: NextRequest) {
  try {
    const patient = await requireRole("PATIENT");

    const body = await request.json();

    const entity =
      typeof body?.entity === "string"
        ? body.entity.trim().toLowerCase()
        : "";

    const data = body?.data ?? {};

    /*
     * =======================================================
     * HOSPITAL
     * =======================================================
     */

    if (entity === "hospital") {
      const name = optionalString(data.name);

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error: "Hospital name is required.",
          },
          { status: 400 }
        );
      }

      const hospital = await prisma.hospital.create({
        data: {
          name,
          code: optionalString(data.code),
          address: optionalString(data.address),
          city: optionalString(data.city),
          state: optionalString(data.state),
          pincode: optionalString(data.pincode),
          phone: optionalString(data.phone),
        },
      });

      return NextResponse.json({
        success: true,
        entity: "hospital",
        hospital,
      });
    }

    /*
     * =======================================================
     * HOSPITAL ADMISSION
     * =======================================================
     */

    if (entity === "admission") {
      const hospitalId = optionalString(data.hospitalId);
      const admissionDate = parseDate(data.admissionDate);

      if (!hospitalId || !admissionDate) {
        return NextResponse.json(
          {
            success: false,
            error:
              "hospitalId and a valid admissionDate are required.",
          },
          { status: 400 }
        );
      }

      const hospital = await prisma.hospital.findUnique({
        where: {
          id: hospitalId,
        },
      });

      if (!hospital) {
        return NextResponse.json(
          {
            success: false,
            error: "Hospital not found.",
          },
          { status: 404 }
        );
      }

      const status =
        typeof data.status === "string" &&
        [
          "PLANNED",
          "ADMITTED",
          "DISCHARGED",
          "CANCELLED",
        ].includes(data.status)
          ? data.status
          : "ADMITTED";

      const admission =
        await prisma.hospitalAdmission.create({
          data: {
            patientId: patient.id,
            hospitalId,
            admissionNumber:
              optionalString(data.admissionNumber),
            status,
            admissionDate,
            dischargeDate: parseDate(
              data.dischargeDate
            ),
            ward: optionalString(data.ward),
            bed: optionalString(data.bed),
            attendingClinicianName:
              optionalString(
                data.attendingClinicianName
              ),
            reason: optionalString(data.reason),
            dischargeSummary:
              optionalString(
                data.dischargeSummary
              ),
          },

          include: {
            hospital: true,
          },
        });

      return NextResponse.json({
        success: true,
        entity: "admission",
        admission,
      });
    }

    /*
     * =======================================================
     * HOSPITAL ENCOUNTER
     * =======================================================
     */

    if (entity === "encounter") {
      const encounterDate = parseDate(data.encounterDate);

      if (!encounterDate) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A valid encounterDate is required.",
          },
          { status: 400 }
        );
      }

      const admissionId =
        optionalString(data.admissionId);

      if (admissionId) {
        const admission =
          await prisma.hospitalAdmission.findFirst({
            where: {
              id: admissionId,
              patientId: patient.id,
            },
          });

        if (!admission) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Hospital admission not found for this patient.",
            },
            { status: 404 }
          );
        }
      }

      const encounterType =
        optionalString(data.encounterType) ||
        "GENERAL";

      const encounter =
        await prisma.hospitalEncounter.create({
          data: {
            admissionId,
            patientId: patient.id,
            encounterType,
            encounterDate,
            clinicianName:
              optionalString(
                data.clinicianName
              ),
            department:
              optionalString(
                data.department
              ),
            notes:
              optionalString(data.notes),
          },

          include: {
            admission: {
              include: {
                hospital: true,
              },
            },
          },
        });

      return NextResponse.json({
        success: true,
        entity: "encounter",
        encounter,
      });
    }

    /*
     * =======================================================
     * HOSPITAL TEST
     * =======================================================
     */

    if (entity === "test") {
      const admissionId =
        optionalString(data.admissionId);

      const name = optionalString(data.name);

      if (!admissionId || !name) {
        return NextResponse.json(
          {
            success: false,
            error:
              "admissionId and test name are required.",
          },
          { status: 400 }
        );
      }

      const admission =
        await prisma.hospitalAdmission.findFirst({
          where: {
            id: admissionId,
            patientId: patient.id,
          },
        });

      if (!admission) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Hospital admission not found for this patient.",
          },
          { status: 404 }
        );
      }

      const allowedStatuses = [
        "ORDERED",
        "SAMPLE_COLLECTED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ];

      const status =
        typeof data.status === "string" &&
        allowedStatuses.includes(
          data.status
        )
          ? data.status
          : "ORDERED";

      const test =
        await prisma.hospitalTest.create({
          data: {
            admissionId,
            name,
            category:
              optionalString(
                data.category
              ),
            status,
            orderedAt:
              parseDate(
                data.orderedAt
              ) || new Date(),
            completedAt:
              parseDate(
                data.completedAt
              ),
            resultSummary:
              optionalString(
                data.resultSummary
              ),
            reportDocumentUrl:
              optionalString(
                data.reportDocumentUrl
              ),
            reportDocumentType:
              optionalString(
                data.reportDocumentType
              ),
            labName:
              optionalString(
                data.labName
              ),
            notes:
              optionalString(
                data.notes
              ),
          },
        });

      return NextResponse.json({
        success: true,
        entity: "test",
        test,
      });
    }

    /*
     * =======================================================
     * HOSPITAL PROCEDURE
     * =======================================================
     */

    if (entity === "procedure") {
      const admissionId =
        optionalString(data.admissionId);

      const name =
        optionalString(data.name);

      if (!admissionId || !name) {
        return NextResponse.json(
          {
            success: false,
            error:
              "admissionId and procedure name are required.",
          },
          { status: 400 }
        );
      }

      const admission =
        await prisma.hospitalAdmission.findFirst({
          where: {
            id: admissionId,
            patientId: patient.id,
          },
        });

      if (!admission) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Hospital admission not found for this patient.",
          },
          { status: 404 }
        );
      }

      const allowedStatuses = [
        "PLANNED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ];

      const status =
        typeof data.status === "string" &&
        allowedStatuses.includes(
          data.status
        )
          ? data.status
          : "PLANNED";

      const procedure =
        await prisma.hospitalProcedure.create({
          data: {
            admissionId,
            name,
            status,
            scheduledAt:
              parseDate(
                data.scheduledAt
              ),
            completedAt:
              parseDate(
                data.completedAt
              ),
            clinicianName:
              optionalString(
                data.clinicianName
              ),
            notes:
              optionalString(
                data.notes
              ),
          },
        });

      return NextResponse.json({
        success: true,
        entity: "procedure",
        procedure,
      });
    }

    /*
     * =======================================================
     * HOSPITAL BILL
     * =======================================================
     */

    if (entity === "bill") {
      const admissionId =
        optionalString(data.admissionId);

      if (!admissionId) {
        return NextResponse.json(
          {
            success: false,
            error: "admissionId is required.",
          },
          { status: 400 }
        );
      }

      const admission =
        await prisma.hospitalAdmission.findFirst({
          where: {
            id: admissionId,
            patientId: patient.id,
          },
        });

      if (!admission) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Hospital admission not found for this patient.",
          },
          { status: 404 }
        );
      }

      const items =
        Array.isArray(data.items)
          ? data.items
          : [];

      const normalizedItems =
        items
          .filter(
            (item: unknown) =>
              item &&
              typeof item === "object"
          )
          .map(
            (item: Record<string, unknown>) => {
              const quantity =
                numberOrZero(
                  item.quantity
                ) || 1;

              const unitPrice =
                numberOrZero(
                  item.unitPrice
                );

              const explicitAmount =
                Number(item.amount);

              const amount =
                Number.isFinite(
                  explicitAmount
                )
                  ? explicitAmount
                  : quantity *
                    unitPrice;

              return {
                description:
                  optionalString(
                    item.description
                  ) || "Hospital service",

                category:
                  optionalString(
                    item.category
                  ),

                quantity,

                unitPrice,

                amount,
              };
            }
          );

     const subtotal = normalizedItems.reduce(
  (sum: number, item: { amount: number }) => sum + item.amount,
  0
);

      const insuranceCoveredAmount =
        numberOrZero(
          data.insuranceCoveredAmount
        );

      const totalAmount =
        Number.isFinite(
          Number(data.totalAmount)
        )
          ? Number(data.totalAmount)
          : subtotal;

      const patientPayableAmount =
        Number.isFinite(
          Number(
            data.patientPayableAmount
          )
        )
          ? Number(
              data.patientPayableAmount
            )
          : Math.max(
              0,
              totalAmount -
                insuranceCoveredAmount
            );

      const allowedStatuses = [
        "DRAFT",
        "ISSUED",
        "PARTIALLY_PAID",
        "PAID",
        "CANCELLED",
      ];

      const status =
        typeof data.status === "string" &&
        allowedStatuses.includes(
          data.status
        )
          ? data.status
          : "ISSUED";

      const bill =
        await prisma.hospitalBill.create({
          data: {
            admissionId,

            invoiceNumber:
              optionalString(
                data.invoiceNumber
              ),

            issuedAt:
              parseDate(
                data.issuedAt
              ) || new Date(),

            status,

            subtotal,

            insuranceCoveredAmount,

            patientPayableAmount,

            totalAmount,

            currency:
              optionalString(
                data.currency
              ) || "INR",

            items: {
              create: normalizedItems,
            },
          },

          include: {
            items: true,
          },
        });

      return NextResponse.json({
        success: true,
        entity: "bill",
        bill,
      });
    }

    /*
     * =======================================================
     * INSURANCE CLAIM
     * =======================================================
     */

    if (entity === "insurance-claim") {
      const admissionId =
        optionalString(data.admissionId);

      const insurerName =
        optionalString(data.insurerName);

      if (!admissionId || !insurerName) {
        return NextResponse.json(
          {
            success: false,
            error:
              "admissionId and insurerName are required.",
          },
          { status: 400 }
        );
      }

      const admission =
        await prisma.hospitalAdmission.findFirst({
          where: {
            id: admissionId,
            patientId: patient.id,
          },
        });

      if (!admission) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Hospital admission not found for this patient.",
          },
          { status: 404 }
        );
      }

      const billId =
        optionalString(data.billId);

      if (billId) {
        const bill =
          await prisma.hospitalBill.findFirst({
            where: {
              id: billId,
              admissionId,
            },
          });

        if (!bill) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Bill not found for this admission.",
            },
            { status: 404 }
          );
        }
      }

      const allowedStatuses = [
        "NOT_SUBMITTED",
        "SUBMITTED",
        "UNDER_REVIEW",
        "APPROVED",
        "PARTIALLY_APPROVED",
        "REJECTED",
        "SETTLED",
      ];

      const status =
        typeof data.status === "string" &&
        allowedStatuses.includes(
          data.status
        )
          ? data.status
          : "NOT_SUBMITTED";

      const claim =
        await prisma.insuranceClaim.create({
          data: {
            admissionId,

            billId,

            insurerName,

            policyNumber:
              optionalString(
                data.policyNumber
              ),

            claimNumber:
              optionalString(
                data.claimNumber
              ),

            status,

            submittedAt:
              parseDate(
                data.submittedAt
              ),

            decidedAt:
              parseDate(
                data.decidedAt
              ),

            claimedAmount:
              numberOrZero(
                data.claimedAmount
              ),

            approvedAmount:
              numberOrZero(
                data.approvedAmount
              ),

            rejectedAmount:
              numberOrZero(
                data.rejectedAmount
              ),

            patientPayableAmount:
              numberOrZero(
                data.patientPayableAmount
              ),

            rejectionReason:
              optionalString(
                data.rejectionReason
              ),

            notes:
              optionalString(
                data.notes
              ),
          },

          include: {
            bill: true,
          },
        });

      return NextResponse.json({
        success: true,
        entity: "insurance-claim",
        claim,
      });
    }

    /*
     * =======================================================
     * LAB
     * =======================================================
     */

    if (entity === "lab") {
      const name = optionalString(data.name);

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error: "Lab name is required.",
          },
          { status: 400 }
        );
      }

      const lab = await prisma.lab.create({
        data: {
          name,

          code:
            optionalString(
              data.code
            ),

          address:
            optionalString(
              data.address
            ),

          city:
            optionalString(
              data.city
            ),

          state:
            optionalString(
              data.state
            ),

          pincode:
            optionalString(
              data.pincode
            ),

          phone:
            optionalString(
              data.phone
            ),
        },
      });

      return NextResponse.json({
        success: true,
        entity: "lab",
        lab,
      });
    }

    /*
     * =======================================================
     * LAB ORDER
     * =======================================================
     */

    if (entity === "lab-order") {
      const labId =
        optionalString(data.labId);

      const testName =
        optionalString(data.testName);

      if (!labId || !testName) {
        return NextResponse.json(
          {
            success: false,
            error:
              "labId and testName are required.",
          },
          { status: 400 }
        );
      }

      const lab =
        await prisma.lab.findUnique({
          where: {
            id: labId,
          },
        });

      if (!lab) {
        return NextResponse.json(
          {
            success: false,
            error: "Lab not found.",
          },
          { status: 404 }
        );
      }

      const allowedStatuses = [
        "ORDERED",
        "SAMPLE_COLLECTED",
        "PROCESSING",
        "FINALIZED",
        "CANCELLED",
      ];

      const status =
        typeof data.status === "string" &&
        allowedStatuses.includes(
          data.status
        )
          ? data.status
          : "ORDERED";

      const order =
        await prisma.labOrder.create({
          data: {
            patientId:
              patient.id,

            labId,

            orderNumber:
              optionalString(
                data.orderNumber
              ),

            testName,

            testCategory:
              optionalString(
                data.testCategory
              ),

            status,

            orderedAt:
              parseDate(
                data.orderedAt
              ) || new Date(),

            sampleCollectedAt:
              parseDate(
                data.sampleCollectedAt
              ),

            finalizedAt:
              parseDate(
                data.finalizedAt
              ),

            clinicalNotes:
              optionalString(
                data.clinicalNotes
              ),
          },

          include: {
            lab: true,
            reports: true,
          },
        });

      return NextResponse.json({
        success: true,
        entity: "lab-order",
        order,
      });
    }

    /*
     * =======================================================
     * LAB REPORT
     *
     * This represents the finalized digital report
     * received from a laboratory.
     *
     * If medicalRecordId is supplied, it links the report
     * into the existing JeevanLink medical-record timeline.
     * =======================================================
     */

    if (entity === "lab-report") {
      const labId =
        optionalString(data.labId);

      const testName =
        optionalString(data.testName);

      const reportDate =
        parseDate(data.reportDate);

      if (
        !labId ||
        !testName ||
        !reportDate
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "labId, testName and a valid reportDate are required.",
          },
          { status: 400 }
        );
      }

      const lab =
        await prisma.lab.findUnique({
          where: {
            id: labId,
          },
        });

      if (!lab) {
        return NextResponse.json(
          {
            success: false,
            error: "Lab not found.",
          },
          { status: 404 }
        );
      }

      const medicalRecordId =
        optionalString(
          data.medicalRecordId
        );

      if (medicalRecordId) {
        const record =
          await prisma.medicalRecord.findFirst({
            where: {
              id: medicalRecordId,
              patientId: patient.id,
            },
          });

        if (!record) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Medical record not found for this patient.",
            },
            { status: 404 }
          );
        }
      }

      const labOrderId =
        optionalString(
          data.labOrderId
        );

      if (labOrderId) {
        const order =
          await prisma.labOrder.findFirst({
            where: {
              id: labOrderId,
              patientId: patient.id,
            },
          });

        if (!order) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Lab order not found for this patient.",
            },
            { status: 404 }
          );
        }
      }

      const allowedStatuses = [
        "DRAFT",
        "FINAL",
        "CORRECTED",
        "CANCELLED",
      ];

      const status =
        typeof data.status === "string" &&
        allowedStatuses.includes(
          data.status
        )
          ? data.status
          : "FINAL";

      /*
       * Avoid creating a duplicate report when the same
       * sourceRecordId already exists for this patient.
       */
      const sourceRecordId =
        optionalString(
          data.sourceRecordId
        );

      if (sourceRecordId) {
        const existing =
          await prisma.labReport.findFirst({
            where: {
              patientId: patient.id,
              sourceRecordId,
            },
          });

        if (existing) {
          return NextResponse.json(
            {
              success: false,
              error:
                "This laboratory report has already been received.",
              report: existing,
            },
            { status: 409 }
          );
        }
      }

      const report =
        await prisma.labReport.create({
          data: {
            patientId:
              patient.id,

            labId,

            labOrderId,

            medicalRecordId,

            reportNumber:
              optionalString(
                data.reportNumber
              ),

            testName,

            testCategory:
              optionalString(
                data.testCategory
              ),

            status,

            resultSummary:
              optionalString(
                data.resultSummary
              ),

            reportDate,

            finalizedAt:
              parseDate(
                data.finalizedAt
              ),

            sourceRecordId,

            sourceDocumentUrl:
              optionalString(
                data.sourceDocumentUrl
              ),

            sourceDocumentType:
              optionalString(
                data.sourceDocumentType
              ),

            digitallyReceived:
              typeof data.digitallyReceived ===
              "boolean"
                ? data.digitallyReceived
                : true,

            notes:
              optionalString(
                data.notes
              ),
          },

          include: {
            lab: true,
            labOrder: true,
            medicalRecord: true,
          },
        });

      /*
       * If the lab report is finalized and is not already
       * connected to a MedicalRecord, automatically create
       * a patient-owned pending MedicalRecord entry.
       *
       * This gives the lab integration a concrete path into
       * the existing longitudinal record system while keeping
       * the report distinct from clinician verification.
       */
      let linkedMedicalRecord =
        report.medicalRecord;

      if (
        status === "FINAL" &&
        !report.medicalRecordId
      ) {
        const createdRecord =
          await prisma.medicalRecord.create({
            data: {
              patientName:
                patient.name,

              documentName:
                report.reportNumber
                  ? `Lab Report ${report.reportNumber}`
                  : `Lab Report - ${report.testName}`,

              documentType:
                report.testCategory ||
                "Laboratory Report",

              interpretation:
                report.resultSummary ||
                "Digital laboratory report received from laboratory.",

              status: "PENDING",

              patientId:
                patient.id,

              originalFileUrl:
                report.sourceDocumentUrl,

              originalFileType:
                report.sourceDocumentType,
            },
          });

        linkedMedicalRecord =
          createdRecord;

        await prisma.labReport.update({
          where: {
            id: report.id,
          },

          data: {
            medicalRecordId:
              createdRecord.id,
          },
        });
      }

      return NextResponse.json({
        success: true,
        entity: "lab-report",

        report: {
          ...report,

          medicalRecordId:
            linkedMedicalRecord?.id ||
            report.medicalRecordId,

          medicalRecord:
            linkedMedicalRecord,
        },
      });
    }

    /*
     * =======================================================
     * UNKNOWN ENTITY
     * =======================================================
     */

    return NextResponse.json(
      {
        success: false,
        error:
          "Unsupported entity. Use hospital, admission, encounter, test, procedure, bill, insurance-claim, lab, lab-order, or lab-report.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Unable to create Hospitals & Labs data:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Hospitals & Labs data.",
      },
      {
        status: 500,
      }
    );
  }
}
