import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    loggedOut: true,
  });

  /*
   * Delete the session cookie.
   */
  response.cookies.delete(
    "jeevanlink_session"
  );

  /*
   * Also explicitly expire it.
   * This handles browsers that retain the
   * previous cookie until its expiry.
   */
  response.cookies.set(
    "jeevanlink_session",
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    }
  );

  /*
   * Extra cleanup for a cookie that may have
   * been created by an older version without
   * the same Path attribute.
   */
  response.cookies.set(
    "jeevanlink_session",
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/login",
      expires: new Date(0),
      maxAge: 0,
    }
  );

  response.cookies.set(
    "jeevanlink_session",
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/api/auth",
      expires: new Date(0),
      maxAge: 0,
    }
  );

  return response;
}