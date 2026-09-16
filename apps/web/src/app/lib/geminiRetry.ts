/**
 * Shared retry helper for every route calling ai.models.generateContent().
 * Was copy-pasted into 5 routes with drifting behavior; this is the one
 * copy they all import.
 */

export function getErrorStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      status?: unknown;
      code?: unknown;
      response?: { status?: unknown };
    };

    if (typeof candidate.status === "number") return candidate.status;
    if (typeof candidate.code === "number") return candidate.code;
    if (typeof candidate.response?.status === "number") {
      return candidate.response.status;
    }
  }

  return null;
}

/** A day-scoped free-tier quota ("...PerDay..."/"free_tier_requests") can't
 * be fixed by retrying within seconds -- it only resets at midnight
 * Pacific. Excluded from retryable so callers fail fast instead of
 * burning ~26s on doomed attempts. */
function isQuotaExhaustedError(error: unknown): boolean {
  if (getErrorStatus(error) !== 429) return false;
  const message = error instanceof Error ? error.message : String(error);
  return /RESOURCE_EXHAUSTED|PerDay|free_tier_requests/i.test(message);
}

export function isRetryableGeminiError(error: unknown): boolean {
  if (isQuotaExhaustedError(error)) return false;

  const status = getErrorStatus(error);
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /429|500|502|503|504|UNAVAILABLE|temporarily unavailable|high demand|rate.?limit/i.test(message);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

export async function generateGeminiWithRetry<T>(
  request: () => Promise<T>,
  options: { label: string; maxRetries?: number; delays?: number[]; jitterMs?: number },
): Promise<T> {
  const { label, maxRetries = 3, delays = [3000, 8000, 15000], jitterMs = 1000 } = options;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await request();
    } catch (error) {
      lastError = error;

      const status = getErrorStatus(error);
      const retryable = isRetryableGeminiError(error);

      console.error(
        `${label} failed. Attempt ${attempt + 1}/${maxRetries + 1}. Status: ${status ?? "unknown"}. Error: ${getErrorMessage(error)}`,
      );

      if (!retryable || attempt === maxRetries) {
        throw error;
      }

      const delay = delays[Math.min(attempt, delays.length - 1)] + Math.floor(Math.random() * jitterMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
