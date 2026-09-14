"""
Bhashini client -- real ASR and TTS calls for /listen and /speak.

CORRECTED 2026-09-14: the two-step "Pipeline Config Call then Pipeline
Compute Call" flow this file originally implemented (per the classic
public ULCA docs) does NOT apply to this Bhashini-Udyat dashboard
account -- every pipeline ID tried (public defaults and the one
documented to support ASR+TTS) failed, in two different, mutually
inconsistent ways. Root-caused by connecting to Bhashini's own docs
MCP server (dibd-bhashini.gitbook.io) directly instead of guessing from
partial web fetches, then verified empirically end-to-end: a real TTS
call followed by feeding that exact audio into ASR and getting the
original text back.

The actual flow for this account type is much simpler and needs NO
pipeline ID and NO config call at all:

  POST https://dhruva-api.bhashini.gov.in/services/inference/pipeline
  Headers: Authorization: <BHASHINI_ULCA_API_KEY -- the dashboard's
           "INFERENCE" key, used directly, not as part of a userID/
           ulcaApiKey pair>
  Body: {"pipelineTasks": [...], "inputData": {...}} -- same task/
        input shape as the classic flow, just no config-call
        indirection to get there.

BHASHINI_USER_ID (the "UDYAT KEY") turned out to be unused for this --
kept in config.py in case some other Bhashini surface needs it later,
but ASR/TTS here only need the one key.

This backend is measurably flaky: roughly 1 in 3 calls during testing
failed with a plain TCP connection reset (no error body, nothing to
retry-after) before ever reaching the model. That is worked around here
with a blind retry, not something a code fix can eliminate -- it isn't
a bug in this client.
"""

import base64
import time

import requests

from app.config import BHASHINI_ULCA_API_KEY

INFERENCE_URL = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
REQUEST_TIMEOUT_S = 90  # GPU-backed models can have a slow cold start
MAX_ATTEMPTS = 4
RETRY_DELAY_S = 3

# One ASR model covers all three languages Jeeva speaks (see
# jeeva-apis "Available Models for usage"). Verified empirically for
# English; Hindi/Bengali are per-docs, not yet spot-checked.
ASR_SERVICE_ID = "bhashini/bodhan/asr-transcribe-core"

# TTS needs a different model per language family. English verified
# empirically (full round-trip with ASR above); hi/bn are per-docs.
TTS_SERVICE_ID_BY_LANGUAGE = {
    "en": "ai4bharat/indic-tts-coqui-misc-gpu--t4",
    "hi": "ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4",
    "bn": "ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4",
}


class BhashiniError(Exception):
    """Raised for any Bhashini call failure -- main.py turns this into a
    clean 502, never a raw stack trace to the browser."""


def _post(body: dict) -> dict:
    headers = {
        "Accept": "*/*",
        "Authorization": BHASHINI_ULCA_API_KEY,
        "Content-Type": "application/json",
    }

    last_error: Exception | None = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            response = requests.post(
                INFERENCE_URL, headers=headers, json=body, timeout=REQUEST_TIMEOUT_S
            )
            break
        except requests.exceptions.RequestException as error:
            last_error = error
            if attempt < MAX_ATTEMPTS - 1:
                time.sleep(RETRY_DELAY_S)
    else:
        raise BhashiniError(
            f"Bhashini connection failed after {MAX_ATTEMPTS} attempts: {last_error}"
        )

    if not response.ok:
        raise BhashiniError(f"Bhashini call failed ({response.status_code}): {response.text[:500]}")

    return response.json()


def transcribe(wav_bytes: bytes, source_language: str) -> str:
    """ASR: 16kHz mono WAV bytes in, transcript text out. Raises
    BhashiniError on any failure -- never returns a guessed transcript."""
    body = {
        "pipelineTasks": [
            {
                "taskType": "asr",
                "config": {
                    "language": {"sourceLanguage": source_language},
                    "serviceId": ASR_SERVICE_ID,
                    "audioFormat": "wav",
                    "samplingRate": 16000,
                },
            }
        ],
        # NOTE: omit "input" entirely for ASR -- this endpoint's schema
        # validation rejects {"source": None}, unlike the classic
        # pipeline-compute-call docs' example.
        "inputData": {"audio": [{"audioContent": base64.b64encode(wav_bytes).decode("ascii")}]},
    }

    result = _post(body)

    try:
        return result["pipelineResponse"][0]["output"][0]["source"].strip()
    except (KeyError, IndexError) as error:
        raise BhashiniError(f"Unexpected ASR response shape: {error}") from error


def synthesize(text: str, language: str, gender: str = "female") -> bytes:
    """TTS: text in, WAV audio bytes out. Raises BhashiniError on any
    failure -- never returns silence pretending to be a real reply."""
    service_id = TTS_SERVICE_ID_BY_LANGUAGE.get(language, TTS_SERVICE_ID_BY_LANGUAGE["en"])

    body = {
        "pipelineTasks": [
            {
                "taskType": "tts",
                "config": {
                    "language": {"sourceLanguage": language},
                    "serviceId": service_id,
                    "gender": gender,
                },
            }
        ],
        "inputData": {"input": [{"source": text}], "audio": [{"audioContent": None}]},
    }

    result = _post(body)

    try:
        audio_b64 = result["pipelineResponse"][0]["audio"][0]["audioContent"]
        return base64.b64decode(audio_b64)
    except (KeyError, IndexError) as error:
        raise BhashiniError(f"Unexpected TTS response shape: {error}") from error
