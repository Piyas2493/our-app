import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        user: null,
      });
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      user,
    });
  } catch (error) {
    console.error(
      "Session lookup error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to retrieve session.",
      },
      { status: 500 }
    );
  }
}
