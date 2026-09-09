import { cookies } from "next/headers";
import { prisma } from "@/app/lib/prisma";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: "PATIENT" | "CLINICIAN" | "HELPDESK";
};

/**
 * Get the currently authenticated user from
 * the HTTP-only session cookie.
 */
export async function getCurrentUser(): Promise<
  AuthenticatedUser | null
> {
  try {
    const cookieStore =
      await cookies();

    const sessionCookie =
      cookieStore.get(
        "jeevanlink_session"
      );

    const userId =
      sessionCookie?.value;

    if (!userId) {
      return null;
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
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    console.error(
      "Unable to resolve authenticated user:",
      error
    );

    return null;
  }
}

/**
 * Require an authenticated user.
 *
 * Throws when no valid session exists.
 */
export async function requireUser(): Promise<
  AuthenticatedUser
> {
  const user =
    await getCurrentUser();

  if (!user) {
    throw new Error(
      "AUTHENTICATION_REQUIRED"
    );
  }

  return user;
}

/**
 * Require a specific application role.
 */
export async function requireRole(
  role: AuthenticatedUser["role"]
): Promise<AuthenticatedUser> {
  const user =
    await requireUser();

  if (user.role !== role) {
    throw new Error(
      "FORBIDDEN"
    );
  }

  return user;
}