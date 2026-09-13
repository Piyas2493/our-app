"use client";

import { usePathname } from "next/navigation";

import JeevaOrb from "@/components/JeevaOrb";

/*
 * Decides WHERE the global orb appears -- kept separate from JeevaOrb
 * itself, which is also used standalone on the jeeva-dev harness page
 * and shouldn't carry app-routing policy.
 *
 * Excluded: the public sign-in screen and the pre-redirect root. Jeeva
 * belongs to the authenticated app, not the marketing/login surface.
 */
const HIDDEN_PATHS = new Set(["/", "/login"]);

export default function JeevaOrbGate() {
  const pathname = usePathname();

  if (HIDDEN_PATHS.has(pathname)) {
    return null;
  }

  return <JeevaOrb />;
}
