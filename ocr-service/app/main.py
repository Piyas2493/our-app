"""
Handwriting-OCR service (Module B, document digitization) -- a pretrained
TrOCR pass over handwritten prescriptions, called by JeevanLink's
apps/web analyze-document route as a second, independent grounding
source alongside Tesseract's printed-text pass.

Separate from jeeva/ on purpose: voice (Module A) and document
digitization (Module B) are different capabilities with different
lifecycles and different heavy dependencies (torch/transformers here vs.
none in jeeva). Keeping them as separate services means either can be
started, stopped, or fail on its own without taking the other down.

IMPORTANT ACCURACY CAVEAT: microsoft/trocr-base-handwritten is trained
on the IAM dataset (English cursive/print handwriting from forms). It is
NOT fine-tuned on clinical handwriting, drug names, or Indian doctors'
shorthand -- expect it to struggle on real prescriptions. Its output is
treated exactly like Tesseract's in analyze-document: unverified
grounding text for Gemini to lean on, never a value accepted on its own.

No GPU required, but CPU inference with a transformer encoder-decoder is
slow (multiple seconds per image) -- the model loads once at startup,
not per request.

Run with:  uvicorn app.main:app --reload --port 8001   (from ocr-service/)
"""

import io

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import FRONTEND_ORIGIN, MODEL_NAME

MAX_IMAGE_BYTES = 15 * 1024 * 1024  # matches analyze-document's own cap

SUPPORTED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}

app = FastAPI(title="JeevanLink handwriting OCR", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Loaded once at startup, not per request -- reloading a transformer
# encoder-decoder on every call would make this unusably slow. If loading
# fails (no internet on first run to fetch the model, torch missing,
# etc.) the service still starts; /handwriting degrades loudly instead
# of crashing the whole process.
_processor = None
_model = None
_load_error: str | None = None

try:
    from transformers import TrOCRProcessor, VisionEncoderDecoderModel

    _processor = TrOCRProcessor.from_pretrained(MODEL_NAME)
    _model = VisionEncoderDecoderModel.from_pretrained(MODEL_NAME)
except Exception as error:  # noqa: BLE001 -- deliberately broad: any
    # failure here (missing deps, no internet, corrupt cache) should
    # degrade to a clear 503 rather than crash the process at import time.
    _load_error = str(error)


def not_ready_response() -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "error": "model_not_loaded",
            "message": _load_error
            or "The handwriting-OCR model failed to load.",
        },
    )


@app.get("/health")
def health():
    return {
        "status": "ok" if _model is not None else "degraded",
        "model": MODEL_NAME,
        "model_loaded": _model is not None,
        "load_error": _load_error,
    }


@app.post("/handwriting")
async def handwriting(image: UploadFile):
    """Best-effort handwriting transcription for one document image.
    Returns {"text": "..."} -- empty string if nothing was recognized,
    never an invented reading."""
    if _model is None or _processor is None:
        return not_ready_response()

    if not image.content_type or image.content_type not in SUPPORTED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image type. Use JPEG, PNG, or WEBP.",
        )

    data = await image.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty image upload.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image is too large.")

    try:
        from PIL import Image

        pil_image = Image.open(io.BytesIO(data)).convert("RGB")

        pixel_values = _processor(images=pil_image, return_tensors="pt").pixel_values
        generated_ids = _model.generate(pixel_values)
        text = _processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
    except Exception as error:  # noqa: BLE001 -- a bad/corrupt image or an
        # inference hiccup should be a clean 502, not a stack trace to the
        # caller; analyze-document treats this the same as "found nothing."
        raise HTTPException(
            status_code=502, detail=f"Handwriting recognition failed: {error}"
        ) from error

    return {"text": text.strip()}
