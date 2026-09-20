/**
 * In-memory, per-process login throttle. Proportionate for this app's
 * actual deployment shape (a single Node process, not horizontally
 * scaled) -- swap for a shared store (Redis, a DB table) if this ever
 * runs as more than one instance, since attempts wouldn't be tracked
 * across processes otherwise.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type Attempt = { count: number; firstAttemptAt: number };

const attempts = new Map<string, Attempt>();

function isExpired(entry: Attempt): boolean {
  return Date.now() - entry.firstAttemptAt > WINDOW_MS;
}

/** Key on the email being logged into (not just IP) -- the goal is
 * protecting a specific account from being brute-forced, regardless
 * of how many source IPs an attacker rotates through. */
export function isLoginRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (isExpired(entry)) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedLogin(key: string): void {
  const entry = attempts.get(key);
  if (!entry || isExpired(entry)) {
    attempts.set(key, { count: 1, firstAttemptAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}
