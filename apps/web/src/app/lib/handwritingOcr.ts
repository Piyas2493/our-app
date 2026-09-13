/*
 * Calls the separate handwriting-OCR service (ocr-service/, Module B --
 * a pretrained TrOCR model, not fine-tuned on clinical handwriting; see
 * ocr-service/README.md for the accuracy caveat). Same contract as
 * ocr.ts's extractOcrText: returns text or null, never throws -- if the
 * service isn't running, isn't reachable, or the model failed to load,
 * this just means the Gemini call proceeds without that grounding,
 * exactly as it already does when Tesseract finds nothing.
 *
 * Only image types make sense here (same set ocr-service accepts);
 * PDFs are skipped for the same reason ocr.ts skips them.
 */

const SUPPORTED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const HANDWRITING_OCR_URL =
  process.env.HANDWRITING_OCR_URL || "http://localhost:8001/handwriting";

const REQUEST_TIMEOUT_MS = 20000;

export async function extractHandwritingText(
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  if (!SUPPORTED_TYPES.has(mimeType)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const formData = new FormData();
    formData.set(
      "image",
      new Blob([new Uint8Array(buffer)], { type: mimeType }),
      "document",
    );

    const response = await fetch(HANDWRITING_OCR_URL, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(
        `Handwriting OCR service returned ${response.status}; continuing without it.`,
      );
      return null;
    }

    const body = (await response.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    return text.length > 0 ? text : null;
  } catch (error) {
    // Service not running, unreachable, or timed out -- this is an
    // optional enhancement, not a required dependency of document
    // analysis, so it degrades silently to "found nothing" rather than
    // failing the upload.
    console.error(
      "Handwriting OCR service unreachable; continuing without it:",
      error,
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
