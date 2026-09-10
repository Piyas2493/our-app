import { NextRequest, NextResponse } from "next/server";

export async function proxy(
  request: NextRequest
) {
  const pathname =
    request.nextUrl.pathname;

  /*
   * Public application pages.
   */
  const publicRoutes = [
    "/",
    "/login",
  ];

  const isPublicRoute =
    publicRoutes.includes(pathname);

  if (isPublicRoute) {
    return NextResponse.next();
  }

  /*
   * API routes perform their own authentication
   * and authorization.
   */
  if (
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  /*
   * Read the session cookie.
   */
  const sessionCookie =
    request.cookies.get(
      "jeevanlink_session"
    );

  if (!sessionCookie?.value) {
    const loginUrl =
      new URL(
        "/login",
        request.url
      );

    loginUrl.searchParams.set(
      "next",
      pathname
    );

    return NextResponse.redirect(
      loginUrl
    );
  }

  /*
   * Ask the existing session endpoint to
   * resolve the session from the HTTP-only cookie.
   *
   * We forward the original cookie explicitly.
   */
  try {
    const sessionUrl =
      new URL(
        "/api/auth/session",
        request.url
      );

    const sessionResponse =
      await fetch(
        sessionUrl,
        {
          method: "GET",

          headers: {
            cookie:
              request.headers.get(
                "cookie"
              ) || "",
          },

          cache: "no-store",
        }
      );

    if (!sessionResponse.ok) {
      const loginUrl =
        new URL(
          "/login",
          request.url
        );

      loginUrl.searchParams.set(
        "next",
        pathname
      );

      return NextResponse.redirect(
        loginUrl
      );
    }

    const session =
      await sessionResponse.json();

    if (
      !session?.authenticated ||
      !session?.user
    ) {
      const loginUrl =
        new URL(
          "/login",
          request.url
        );

      loginUrl.searchParams.set(
        "next",
        pathname
      );

      return NextResponse.redirect(
        loginUrl
      );
    }

    const role =
      session.user.role;

    /*
     * PATIENT-only pages.
     */
    const patientRoutes = [
      "/records",
      "/prescriptions",
    ];

    const isPatientRoute =
      patientRoutes.some(
        (route) =>
          pathname === route ||
          pathname.startsWith(
            `${route}/`
          )
      );

    if (
      isPatientRoute &&
      role !== "PATIENT"
    ) {
      return NextResponse.redirect(
        new URL(
          "/clinician",
          request.url
        )
      );
    }

    /*
     * CLINICIAN-only pages.
     */
    const clinicianRoutes = [
      "/clinician",
      "/verification",
    ];

    const isClinicianRoute =
      clinicianRoutes.some(
        (route) =>
          pathname === route ||
          pathname.startsWith(
            `${route}/`
          )
      );

    if (
      isClinicianRoute &&
      role !== "CLINICIAN"
    ) {
      return NextResponse.redirect(
        new URL(
          "/records",
          request.url
        )
      );
    }

    /*
     * HELPDESK-only pages.
     */
    const helpdeskRoutes = [
      "/helpdesk",
    ];

    const isHelpdeskRoute =
      helpdeskRoutes.some(
        (route) =>
          pathname === route ||
          pathname.startsWith(
            `${route}/`
          )
      );

    if (
      isHelpdeskRoute &&
      role !== "HELPDESK"
    ) {
      return NextResponse.redirect(
        new URL(
          role === "CLINICIAN"
            ? "/clinician"
            : role === "ADMIN"
              ? "/admin"
              : "/dashboard",
          request.url
        )
      );
    }

    /*
     * ADMIN-only pages.
     */
    const adminRoutes = [
      "/admin",
    ];

    const isAdminRoute =
      adminRoutes.some(
        (route) =>
          pathname === route ||
          pathname.startsWith(
            `${route}/`
          )
      );

    if (
      isAdminRoute &&
      role !== "ADMIN"
    ) {
      return NextResponse.redirect(
        new URL(
          role === "CLINICIAN"
            ? "/clinician"
            : role === "HELPDESK"
              ? "/helpdesk"
              : "/dashboard",
          request.url
        )
      );
    }

    /*
     * Unknown protected pages:
     * authenticated users may continue.
     */
    return NextResponse.next();
  } catch (error) {
    console.error(
      "Proxy authentication check failed:",
      error
    );

    /*
     * Fail closed.
     */
    const loginUrl =
      new URL(
        "/login",
        request.url
      );

    loginUrl.searchParams.set(
      "next",
      pathname
    );

    return NextResponse.redirect(
      loginUrl
    );
  }
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};