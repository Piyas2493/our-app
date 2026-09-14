"""
Bhashini/ULCA client: the real ASR and TTS calls, replacing the
"bhashini_not_configured" stubs in main.py.

The flow is two HTTP calls, not one -- this is Bhashini's own design,
not something added here for complexity's sake:

  1. Pipeline Config Call (meity-auth.ulcacontrib.org) -- authenticates
     with your dashboard credentials and a pipeline ID, and returns
     which serviceId to use for each task PLUS a fresh, short-lived
     inference Authorization token for step 2. This is cached in memory
     per (task, language) combo so it isn't re-fetched on every request.
  2. Pipeline Compute Call (the callbackUrl from step 1, normally
     dhruva-api.bhashini.gov.in) -- the actual ASR/TTS inference, using
     the token step 1 returned (never your dashboard credentials
     directly).

Reference: https://bhashini.gitbook.io/bhashini-apis (config/compute
request+response payload pages) and a working reference client
(github.com/AdityaKukreti/bhashini-api) used to fill in the parts the
public docs describe conceptually but don't give exact schemas for.
Verify against your own account if the config call itself starts
rejecting credentials -- see the note in config.py.
"""

import base64

import requests

from app.config import BHASHINI_PIPELINE_ID, BHASHINI_ULCA_API_KEY, BHASHINI_USER_ID

PIPELINE_CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
REQUEST_TIMEOUT_S = 30


class BhashiniError(Exception):
    """Raised for any Bhashini call failure -- main.py turns this into a
    clean 502, never a raw stack trace to the browser."""


# Cached per (tuple of task types, source language, target language) so
# repeated /listen or /speak calls in one conversation don't re-run the
# config call every time. Not TTL'd -- if a cached entry's token goes
# stale, the one retry in _compute() clears it and re-fetches once.
_pipeline_config_cache: dict[tuple, dict] = {}


def _pipeline_config(task_types: list[str], source_language: str, target_language: str | None = None):
    cache_key = (tuple(task_types), source_language, target_language)
    if cache_key in _pipeline_config_cache:
        return _pipeline_config_cache[cache_key]

    pipeline_tasks = []
    for task_type in task_types:
        language = {"sourceLanguage": source_language}
        if target_language:
            language["targetLanguage"] = target_language
        pipeline_tasks.append({"taskType": task_type, "config": {"language": language}})

    response = requests.post(
        PIPELINE_CONFIG_URL,
        headers={
            "userID": BHASHINI_USER_ID,
            "ulcaApiKey": BHASHINI_ULCA_API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "pipelineTasks": pipeline_tasks,
            "pipelineRequestConfig": {"pipelineId": BHASHINI_PIPELINE_ID},
        },
        timeout=REQUEST_TIMEOUT_S,
    )

    if not response.ok:
        raise BhashiniError(
            f"Pipeline config call failed ({response.status_code}): {response.text[:500]}"
        )

    body = response.json()

    try:
        service_ids = {
            task["taskType"]: task["config"][0]["serviceId"]
            for task in body["pipelineResponseConfig"]
        }
        endpoint = body["pipelineInferenceAPIEndPoint"]
        callback_url = endpoint["callbackUrl"]
        auth_header_name = endpoint["inferenceApiKey"]["name"]
        auth_header_value = endpoint["inferenceApiKey"]["value"]
    except (KeyError, IndexError) as error:
        raise BhashiniError(f"Unexpected pipeline config response shape: {error}") from error

    config = {
        "service_ids": service_ids,
        "callback_url": callback_url,
        "auth_header_name": auth_header_name,
        "auth_header_value": auth_header_value,
    }
    _pipeline_config_cache[cache_key] = config
    return config


def _compute(cache_key_tasks: list[str], source_language: str, target_language, payload_builder):
    config = _pipeline_config(cache_key_tasks, source_language, target_language)
    body = payload_builder(config["service_ids"])

    response = requests.post(
        config["callback_url"],
        headers={
            config["auth_header_name"]: config["auth_header_value"],
            "Content-Type": "application/json",
        },
        json=body,
        timeout=REQUEST_TIMEOUT_S,
    )

    if response.status_code in (401, 403):
        # Cached token likely expired -- refetch config once and retry.
        _pipeline_config_cache.pop((tuple(cache_key_tasks), source_language, target_language), None)
        config = _pipeline_config(cache_key_tasks, source_language, target_language)
        body = payload_builder(config["service_ids"])
        response = requests.post(
            config["callback_url"],
            headers={
                config["auth_header_name"]: config["auth_header_value"],
                "Content-Type": "application/json",
            },
            json=body,
            timeout=REQUEST_TIMEOUT_S,
        )

    if not response.ok:
        raise BhashiniError(
            f"Pipeline compute call failed ({response.status_code}): {response.text[:500]}"
        )

    return response.json()


def transcribe(wav_bytes: bytes, source_language: str) -> str:
    """ASR: 16kHz mono WAV bytes in, transcript text out. Raises
    BhashiniError on any failure -- never returns a guessed transcript."""

    def build_payload(service_ids: dict):
        return {
            "pipelineTasks": [
                {
                    "taskType": "asr",
                    "config": {
                        "language": {"sourceLanguage": source_language},
                        "serviceId": service_ids["asr"],
                        "audioFormat": "wav",
                        "samplingRate": 16000,
                    },
                }
            ],
            "inputData": {
                "input": [{"source": None}],
                "audio": [{"audioContent": base64.b64encode(wav_bytes).decode("ascii")}],
            },
        }

    result = _compute(["asr"], source_language, None, build_payload)

    try:
        return result["pipelineResponse"][0]["output"][0]["source"].strip()
    except (KeyError, IndexError) as error:
        raise BhashiniError(f"Unexpected ASR compute response shape: {error}") from error


def synthesize(text: str, language: str, gender: str = "female") -> bytes:
    """TTS: text in, WAV audio bytes out. Raises BhashiniError on any
    failure -- never returns silence pretending to be a real reply."""

    def build_payload(service_ids: dict):
        return {
            "pipelineTasks": [
                {
                    "taskType": "tts",
                    "config": {
                        "language": {"sourceLanguage": language},
                        "serviceId": service_ids["tts"],
                        "gender": gender,
                    },
                }
            ],
            "inputData": {
                "input": [{"source": text}],
                "audio": [{"audioContent": None}],
            },
        }

    result = _compute(["tts"], language, None, build_payload)

    try:
        audio_b64 = result["pipelineResponse"][0]["audio"][0]["audioContent"]
        return base64.b64decode(audio_b64)
    except (KeyError, IndexError) as error:
        raise BhashiniError(f"Unexpected TTS compute response shape: {error}") from error
