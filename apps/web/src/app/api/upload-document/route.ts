import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { randomUUID } from "crypto";
import { requireRole } from "@/app/lib/auth";
import { putMedicalDocument } from "@/app/lib/documentStorage";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export async function POST(request: NextRequest) {
  try {
    await requireRole("PATIENT");

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "No document was uploaded.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unsupported file type. Please upload a PDF, JPG, JPEG, PNG, or WEBP file.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error:
            "File is too large. Maximum supported size is 15 MB.",
        },
        { status: 400 }
      );
    }

    const extension =
      path.extname(file.name).toLowerCase() ||
      getExtensionFromMimeType(file.type);

    const storedFileName =
      `${randomUUID()}${extension}`;

    const bytes = await file.arrayBuffer();

    const publicUrl = await putMedicalDocument(
      storedFileName,
      Buffer.from(bytes),
      file.type
    );

    return NextResponse.json({
      success: true,
      file: {
        originalName: file.name,
        storedFileName,
        url: publicUrl,
        type: file.type,
        size: file.size,
      },
    });
  } catch (error) {
    console.error(
      "Document upload error:",
      error
    );

    if (
      error instanceof Error &&
      error.message === "AUTHENTICATION_REQUIRED"
    ) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "FORBIDDEN"
    ) {
      return NextResponse.json(
        { success: false, error: "Only patients can upload documents." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to store the uploaded document.",
      },
      { status: 500 }
    );
  }
}

function getExtensionFromMimeType(
  mimeType: string
): string {
  switch (mimeType) {
    case "application/pdf":
      return ".pdf";

    case "image/jpeg":
    case "image/jpg":
      return ".jpg";

    case "image/png":
      return ".png";

    case "image/webp":
      return ".webp";

    default:
      return "";
  }
}
