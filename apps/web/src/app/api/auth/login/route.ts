import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Email and password are required.",
        },
        { status: 400 }
      );
    }

    const user =
      await prisma.user.findUnique({
        where: {
          email,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    const passwordValid =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordValid) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    const response =
      NextResponse.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });

    response.cookies.set(
      "jeevanlink_session",
      user.id,
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV ===
          "production",
        path: "/",
        maxAge:
          60 * 60 * 24 * 7,
      }
    );

    return response;
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to sign in.",
      },
      { status: 500 }
    );
  }
}
