"use client";

import { useState } from "react";
import {
  LogOut,
  Loader2,
} from "lucide-react";

export default function LogoutButton() {
  const [loggingOut, setLoggingOut] =
    useState(false);

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      const response =
        await fetch(
          "/api/auth/logout",
          {
            method: "POST",
            credentials: "include",
            cache: "no-store",
          }
        );

      /*
       * We already know this endpoint returns:
       * { success: true, loggedOut: true }
       *
       * Do not navigate until the request completes.
       */
      if (!response.ok) {
        throw new Error(
          `Logout failed with status ${response.status}`
        );
      }

      /*
       * Clear only development client state.
       */
      try {
        localStorage.removeItem(
          "clinicianCases"
        );

        localStorage.removeItem(
          "verificationRecords"
        );

        sessionStorage.clear();
      } catch {
        // Storage cleanup is non-critical.
      }

      /*
       * Verify that the server really considers
       * the session unauthenticated.
       */
      const sessionResponse =
        await fetch(
          "/api/auth/session",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

      let session: Record<string, unknown> | null = null;

      try {
        session =
          await sessionResponse.json();
      } catch {
        session = null;
      }

      console.log(
        "Session after logout:",
        session
      );

      /*
       * Hard navigation.
       *
       * replace() prevents the protected page from
       * remaining in browser history.
       */
      window.location.replace(
        "/login"
      );
    } catch (error) {
      console.error(
        "Logout failed:",
        error
      );

      /*
       * Even if something unexpected happens,
       * force the browser to the login screen.
       */
      window.location.replace(
        "/login"
      );
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loggingOut ? (
        <Loader2
          size={17}
          className="animate-spin"
        />
      ) : (
        <LogOut size={17} />
      )}

      {loggingOut
        ? "Logging out..."
        : "Logout"}
    </button>
  );
}