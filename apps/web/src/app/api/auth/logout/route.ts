import { NextRequest, NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE } from "@/app/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (token) {
    // Invalidate server-side too -- a copy of this cookie captured
    // before logout (e.g. from a shared/borrowed device) must not
    // keep working just because the browser's own copy was cleared.
    await destroySession(token);
  }

  const response = NextResponse.json({
    success: true,
    loggedOut: true,
  });

  /*
   * Delete the session cookie.
   */
  response.cookies.delete(SESSION_COOKIE);

  /*
   * Also explicitly expire it.
   * This handles browsers that retain the
   * previous cookie until its expiry.
   */
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });

  /*
   * Extra cleanup for a cookie that may have
   * been created by an older version without
   * the same Path attribute.
   */
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/login",
    expires: new Date(0),
    maxAge: 0,
  });

  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    expires: new Date(0),
    maxAge: 0,
  });

  return response;
}
