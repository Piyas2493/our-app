import { createWorker } from "tesseract.js";

/*
 * Best-effort OCR grounding for the document-analysis pipeline.
 *
 * This never replaces the Gemini vision extraction -- it only gives it
 * a second, independent read of the page's text to lean on for faint
 * print or awkward handwriting. Gemini still sees the original image
 * and remains the source of truth: nothing here should ever cause a
 * value to be extracted that isn't actually visible in the image.
 *
 * Tesseract only understands raster images, not PDF pages, so PDFs are
 * skipped entirely rather than attempting a partial/incorrect read.
 * Most Indian prescriptions and reports are written in Latin-script
 * English regardless of the patient-facing UI language, so English is
 * the only trained language loaded -- this keeps the OCR pass fast and
 * avoids downloading additional language data per request.
 */

const OCR_SUPPORTED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export async function extractOcrText(
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  if (!OCR_SUPPORTED_TYPES.has(mimeType)) {
    return null;
  }

  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

  try {
    worker = await createWorker("eng");
    const {
      data: { text },
    } = await worker.recognize(buffer);

    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (error) {
    console.error("OCR pass failed; continuing without it:", error);
    return null;
  } finally {
    if (worker) {
      await worker.terminate().catch(() => {});
    }
  }
}
