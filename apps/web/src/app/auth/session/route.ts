import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest
) {
  try {
    const sessionCookie =
      request.cookies.get(
        "jeevanlink_session"
      );

    const userId =
      sessionCookie?.value;

    if (!userId) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        user: null,
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

    if (!user) {
      const response =
        NextResponse.json({
          success: true,
          authenticated: false,
          user: null,
        });

      response.cookies.delete(
        "jeevanlink_session"
      );

      return response;
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