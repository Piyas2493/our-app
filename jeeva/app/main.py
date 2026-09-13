"""
Jeeva's FastAPI service -- the voice-agent backend for JeevanLink.

Runs as a standalone process the existing Next.js frontend calls over
HTTP (see apps/web/public/jeeva/*.js for the browser side). Deliberately
NOT a Next.js API route: this keeps Jeeva's Python-only pieces (ASR
lexicon biasing, and later self-hosted IndicConformer / OCR / FHIR
export) in one place, and lets it run and be reasoned about
independently of the main app.

Run with:  uvicorn app.main:app --reload --port 8000   (from jeeva/)
"""

from fastapi import FastAPI, HTTPException, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import BHASHINI_CONFIGURED, DEMO_MODE, FRONTEND_ORIGIN

MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10MB, matches the app's existing cap

app = FastAPI(title="Jeeva", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    allow_credentials=True,
)


def not_configured_response() -> JSONResponse:
    """The one place that shapes the 'degrade loudly' error the orb
    reads to show its error state and on-screen message. Never return
    silence or a fake success when the speech backend isn't reachable."""
    return JSONResponse(
        status_code=503,
        content={
            "error": "bhashini_not_configured",
            "message": "Bhashini not configured — add BHASHINI_API_KEY to jeeva/.env",
        },
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "bhashini_configured": BHASHINI_CONFIGURED,
        "demo_mode": DEMO_MODE,
    }


@app.post("/listen")
async def listen(
    audio: UploadFile,
    language: str = Form(default="en"),
    mode: str = Form(default="sahayak"),
):
    """Speech-to-text for one recorded turn. The browser never talks to
    Bhashini directly -- the API key stays server-side, here."""
    if not BHASHINI_CONFIGURED:
        return not_configured_response()

    if not audio.content_type or not audio.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Unsupported audio format.")

    data = await audio.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="No speech was captured.")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="Recording is too long.")

    # TODO(bhashini): call the ASR pipeline once BHASHINI_API_KEY exists,
    # then run the clinical term-biasing pass (jeeva/app/lexicon.py,
    # not yet written) before returning the transcript.
    raise HTTPException(status_code=501, detail="Bhashini ASR call not yet implemented.")


@app.post("/speak")
async def speak(text: str = Form(...), language: str = Form(default="en")):
    """Text-to-speech for one reply. Returns audio bytes the browser
    plays directly; never routes through the client-side Web Speech
    API, per the build spec."""
    if not BHASHINI_CONFIGURED:
        return not_configured_response()

    # TODO(bhashini): call the TTS pipeline once BHASHINI_API_KEY exists.
    raise HTTPException(status_code=501, detail="Bhashini TTS call not yet implemented.")
