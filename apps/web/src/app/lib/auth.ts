import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { prisma } from "@/app/lib/prisma";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: "PATIENT" | "CLINICIAN" | "HELPDESK" | "ADMIN";
};

export const SESSION_COOKIE = "jeevanlink_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * Creates a new session for a user and returns the opaque,
 * cryptographically random token to store in the cookie.
 *
 * The cookie never contains anything that identifies the user
 * directly (previously it was the raw database user ID) -- a leaked
 * or guessed user ID must never be enough to authenticate as them.
 */
export async function createSession(
  userId: string
): Promise<string> {
  const token = randomBytes(32).toString("hex");

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  return token;
}

/** Invalidates a session server-side, e.g. on logout. */
export async function destroySession(
  token: string
): Promise<void> {
  await prisma.session.deleteMany({
    where: { token },
  });
}

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

    const token =
      cookieStore.get(SESSION_COOKIE)?.value;

    if (!token) {
      return null;
    }

    const session =
      await prisma.session.findUnique({
        where: { token },
        select: {
          expiresAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        // Expired -- clean it up rather than leaving it to accumulate.
        await prisma.session.deleteMany({ where: { token } });
      }
      return null;
    }

    return session.user;
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
