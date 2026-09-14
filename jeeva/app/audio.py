"""
Bridges the browser's recording format to what Bhashini's ASR accepts.

mic.js records with MediaRecorder, which produces webm/opus (or mp4 as a
fallback) -- there is no browser API that records directly to WAV.
Bhashini's documented audioFormat enum is wav/flac/mp3, not webm/opus, so
this is a real, necessary conversion step, not an optional nicety.

Requires ffmpeg on PATH (pydub shells out to it) -- this is a new system
prerequisite beyond `pip install`, called out in jeeva/README.md. Without
it, this raises a clear error instead of a cryptic pydub traceback.
"""

import io

from pydub import AudioSegment


class AudioConversionError(Exception):
    pass


def to_wav_16k_mono(data: bytes) -> bytes:
    try:
        segment = AudioSegment.from_file(io.BytesIO(data))
    except FileNotFoundError as error:
        raise AudioConversionError(
            "ffmpeg not found on PATH -- install it (e.g. `winget install ffmpeg` "
            "on Windows) and restart this service."
        ) from error
    except Exception as error:  # noqa: BLE001 -- any decode failure should be
        # a clean error, not a stack trace to the caller.
        raise AudioConversionError(f"Could not decode recorded audio: {error}") from error

    segment = segment.set_frame_rate(16000).set_channels(1).set_sample_width(2)

    out = io.BytesIO()
    segment.export(out, format="wav")
    return out.getvalue()
