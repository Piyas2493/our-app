import { put } from "@vercel/blob";

/**
 * Original medical documents (prescriptions, lab reports, discharge
 * summaries) are confidential and must never be served as a static
 * asset a client could hit directly -- only ever read through the
 * authenticated, role-checked route in `api/medical-records/[id]/document`,
 * which fetches the bytes server-side and streams them back.
 *
 * Previously these lived on local disk (`private-uploads/medical/`) --
 * moved to Vercel Blob (2026-09-19) because Vercel's serverless
 * functions have a read-only filesystem that doesn't persist between
 * invocations, so anything written to disk there would silently
 * vanish. Vercel Blob was picked over a third-party object store (e.g.
 * Cloudflare R2, AWS S3) specifically because it's native to the same
 * platform hosting the app -- one fewer account/credential to manage.
 *
 * Blob URLs are real, opaque, external https:// URLs (unlike the old
 * disk-based `/uploads/medical/<file>` shape, which resolved to a key
 * under our own control) -- `getMedicalDocument` below only ever
 * fetches a URL if its hostname is actually Vercel Blob's own domain,
 * so a corrupted/malicious `originalFileUrl` value can never turn this
 * into a server-side-request-forgery: it can't be pointed at arbitrary
 * attacker or internal infrastructure.
 */

const VERCEL_BLOB_HOSTNAME_SUFFIX = ".public.blob.vercel-storage.com";

/**
 * The only content types a medical document's Content-Type header may
 * ever be served as. `[id]/document` sends whatever is stored here
 * back to the browser with `Content-Disposition: inline` -- a value
 * like "text/html" stored unchecked would make the browser render
 * (and execute) an uploaded document as a live page instead of an
 * image/PDF, a stored-XSS route. Enforce this allowlist wherever
 * `originalFileType` is written, not just at analyze-document's own
 * upload step.
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

/** Uploads a medical document's bytes to Vercel Blob and returns the
 * real Blob URL to store as `originalFileUrl`. */
export async function putMedicalDocument(
  fileName: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const blob = await put(`medical/${fileName}`, body, {
    access: "public",
    addRandomSuffix: false,
    contentType,
  });

  return blob.url;
}

/** Fetches a medical document's bytes given its stored
 * `originalFileUrl`. Returns null (never throws) for anything that
 * isn't actually a Vercel Blob URL, or that Blob rejects -- the caller
 * treats null the same as "not found". */
export async function getMedicalDocument(
  originalFileUrl: string
): Promise<Buffer | null> {
  let url: URL;
  try {
    url = new URL(originalFileUrl);
  } catch {
    return null;
  }

  if (!url.hostname.endsWith(VERCEL_BLOB_HOSTNAME_SUFFIX)) {
    return null;
  }

  const response = await fetch(url);
  if (!response.ok) return null;

  return Buffer.from(await response.arrayBuffer());
}
