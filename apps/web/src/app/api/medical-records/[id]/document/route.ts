import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { prisma } from "@/app/lib/prisma";
import { getCurrentUser } from "@/app/lib/auth";
import { resolveMedicalUploadPath } from "@/app/lib/documentStorage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const user =
      await getCurrentUser();

    /*
     * No authenticated user.
     */
    if (!user) {
      return new NextResponse(
        "Authentication required.",
        {
          status: 401,
        }
      );
    }

    const {
      id,
    } = await context.params;

    if (!id) {
      return new NextResponse(
        "Missing medical record ID.",
        {
          status: 400,
        }
      );
    }

    const record =
      await prisma.medicalRecord.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          patientId: true,
          originalFileUrl: true,
          originalFileType: true,
          documentName: true,
        },
      });

    if (!record) {
      return new NextResponse(
        "Medical record not found.",
        {
          status: 404,
        }
      );
    }

    /*
     * Only a clinician, or the owning patient, may access
     * the original medical document through this endpoint.
     */
    const isOwningPatient =
      user.role === "PATIENT" &&
      record.patientId === user.id;

    if (
      user.role !== "CLINICIAN" &&
      !isOwningPatient
    ) {
      return new NextResponse(
        "Forbidden.",
        {
          status: 403,
        }
      );
    }

    if (
      !record.originalFileUrl
    ) {
      return new NextResponse(
        "Original document is unavailable.",
        {
          status: 404,
        }
      );
    }

    /*
     * The original document lives in a private directory
     * outside public/, so it is never served as a static
     * asset. Resolve and validate the stored reference.
     */
    const filePath =
      resolveMedicalUploadPath(
        record.originalFileUrl
      );

    if (!filePath) {
      console.error(
        "Unexpected medical document path:",
        record.originalFileUrl
      );

      return new NextResponse(
        "Invalid document reference.",
        {
          status: 500,
        }
      );
    }

    let fileBuffer: Buffer;

    try {
      fileBuffer =
        await fs.readFile(
          filePath
        );
    } catch (error) {
      console.error(
        "Original medical document could not be read:",
        error
      );

      return new NextResponse(
        "Original document not found.",
        {
          status: 404,
        }
      );
    }

    const contentType =
      record.originalFileType ||
      "application/octet-stream";

    const responseBody =
  new Uint8Array(
    fileBuffer.length
  );

responseBody.set(
  fileBuffer
);

return new NextResponse(
  responseBody,
  {
    status: 200,

    headers: {
      "Content-Type":
        contentType,

      "Content-Disposition":
        `inline; filename="${encodeURIComponent(
          record.documentName ||
            "medical-document"
        )}"`,

      "Cache-Control":
        "private, no-store, max-age=0",

      "X-Content-Type-Options":
        "nosniff",
    },
  }
);
  } catch (error) {
    console.error(
      "Protected document endpoint error:",
      error
    );

    return new NextResponse(
      "Unable to load confidential medical document.",
      {
        status: 500,
      }
    );
  }
}