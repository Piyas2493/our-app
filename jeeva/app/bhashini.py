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
MAX_ATTEMPTS = 6  # a less-used model's GPU instance can take a few tries to wake up
RETRY_DELAY_S = 5

# One ASR model covers all 12 languages JeevanLink's UI supports.
# VERIFIED 2026-09-14: full TTS->ASR round trip for all 12 (en, hi, bn,
# ta, te, mr, gu, kn, ml, pa, or, as) came back correct except for
# trailing punctuation (expected -- ASR doesn't reproduce it).
ASR_SERVICE_ID = "bhashini/bodhan/asr-transcribe-core"

# TTS needs a different model per language family -- one service ID
# does not cover all 12. Grouped per Bhashini's own "Available Models"
# listing, and VERIFIED 2026-09-14 the same way as ASR above -- every
# language below round-tripped correctly:
#   misc:       en (+ Manipuri, Bodo, not used by JeevanLink)
#   indo_aryan: hi, mr, bn, gu, or, pa, as
#   dravidian:  ta, te, kn, ml
# Odia's first-ever call needed >200s (a cold GPU instance for a
# less-used model) -- REQUEST_TIMEOUT_S/MAX_ATTEMPTS below give enough
# retry budget for that, but the CALLER (main.py's HTTP client, or the
# browser fetch once wired up) needs a client-side timeout comfortably
# longer than REQUEST_TIMEOUT_S * MAX_ATTEMPTS or it'll give up first.
_TTS_MISC = "ai4bharat/indic-tts-coqui-misc-gpu--t4"
_TTS_INDO_ARYAN = "ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4"
_TTS_DRAVIDIAN = "ai4bharat/indic-tts-coqui-dravidian-gpu--t4"

TTS_SERVICE_ID_BY_LANGUAGE = {
    "en": _TTS_MISC,
    "hi": _TTS_INDO_ARYAN,
    "mr": _TTS_INDO_ARYAN,
    "bn": _TTS_INDO_ARYAN,
    "gu": _TTS_INDO_ARYAN,
    "or": _TTS_INDO_ARYAN,
    "pa": _TTS_INDO_ARYAN,
    "as": _TTS_INDO_ARYAN,
    "ta": _TTS_DRAVIDIAN,
    "te": _TTS_DRAVIDIAN,
    "kn": _TTS_DRAVIDIAN,
    "ml": _TTS_DRAVIDIAN,
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

    # Retries on BOTH connection-level failures (bare TCP resets, seen
    # on roughly 1 in 3 calls during testing) AND 5xx responses -- a
    # less-frequently-used model can come back with a 500
    # "DHRUVA-101 Failed to send request" a few times in a row while its
    # GPU instance cold-starts, then succeed. A 4xx is never retried:
    # that's a real request problem (bad serviceId, bad payload), not a
    # transient one, and retrying it would just waste time.
    response = None
    last_error: Exception | str | None = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            response = requests.post(
                INFERENCE_URL, headers=headers, json=body, timeout=REQUEST_TIMEOUT_S
            )
        except requests.exceptions.RequestException as error:
            last_error = error
            response = None
        else:
            if response.ok:
                break
            last_error = f"{response.status_code}: {response.text[:300]}"
            if response.status_code < 500:
                break  # client error -- not retryable

        if attempt < MAX_ATTEMPTS - 1:
            time.sleep(RETRY_DELAY_S)

    if response is None:
        raise BhashiniError(f"Bhashini connection failed after {MAX_ATTEMPTS} attempts: {last_error}")

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
