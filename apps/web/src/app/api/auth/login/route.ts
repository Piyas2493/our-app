import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { createSession, SESSION_COOKIE, SESSION_TTL_MS } from "@/app/lib/auth";
import {
  clearLoginAttempts,
  isLoginRateLimited,
  recordFailedLogin,
} from "@/app/lib/loginRateLimit";

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

    if (isLoginRateLimited(email)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Too many attempts. Please try again in a few minutes.",
        },
        { status: 429 }
      );
    }

    const user =
      await prisma.user.findUnique({
        where: {
          email,
        },
      });

    if (!user) {
      recordFailedLogin(email);
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
      recordFailedLogin(email);
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    clearLoginAttempts(email);

    const token = await createSession(user.id);

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
      SESSION_COOKIE,
      token,
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV ===
          "production",
        path: "/",
        maxAge:
          SESSION_TTL_MS / 1000,
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
