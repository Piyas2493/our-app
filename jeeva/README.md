# Jeeva

The voice agent inside JeevanLink. Runs as its own Python/FastAPI service
that the existing Next.js frontend (`apps/web`) calls over HTTP — it does
not replace or run inside the Next.js app, and the Next.js app keeps
working with or without Jeeva running.

## Setup (one-time)

```bash
cd jeeva
python -m venv .venv
.venv/Scripts/activate      # Windows. Use `source .venv/bin/activate` on macOS/Linux.
pip install -r requirements.txt
cp .env.example .env
```

Then open `.env` and fill in `BHASHINI_USER_ID` and `BHASHINI_ULCA_API_KEY`
from dashboard.bhashini.co.in → API Keys → your app's "UDYAT KEY" and
"INFERENCE" key respectively.

**Also install ffmpeg** and make sure it's on your PATH (`ffmpeg -version`
should work in a terminal). The browser records audio as webm/opus;
Bhashini's ASR needs WAV. `pydub` does that conversion by shelling out to
ffmpeg — without it, `/listen` returns a clear error naming the problem
rather than a cryptic failure.
- Windows: `winget install ffmpeg` (or download from ffmpeg.org and add
  `bin/` to PATH)
- macOS: `brew install ffmpeg`
- Linux: `apt install ffmpeg` / your distro's equivalent

## Run

```bash
cd jeeva
.venv/Scripts/activate
uvicorn app.main:app --reload --port 8000
```

The Next.js app (`apps/web`) runs separately as usual (`npm run dev`).
Two processes, not one, for now — see the architecture note below.

## Status

`/listen` and `/speak` call Bhashini for real once both `BHASHINI_USER_ID`
and `BHASHINI_ULCA_API_KEY` are set in `.env` — until then they return
`503 {"error": "bhashini_not_configured"}`. This is the intended
"degrade loudly" behavior, not a bug: the Jeeva orb in the browser reads
this and shows its `error` state with the reason on screen, rather than
failing silently.

The exact request/response shapes for the Pipeline Config and Compute
calls (`app/bhashini.py`) are assembled from Bhashini's public GitBook
docs plus a third-party reference client, not confirmed against a real
key yet — the config call's two header names (`userID`/`ulcaApiKey`)
mapping to the dashboard's "UDYAT KEY"/"INFERENCE" fields is the most
likely reading, but if the config call itself starts rejecting
credentials, that mapping is the first thing to double-check (try
swapping which dashboard value goes in which env var).

Check it's up: `curl http://localhost:8000/health`

## Cost

₹0 on Bhashini's free tier. No paid speech vendor is used anywhere in
this module.

## Architecture note

The original build spec asked for Python stdlib + `requests` specifically
so Jeeva wouldn't need a second server process on a one-command clinic
laptop deploy. That was superseded on 2026-09-13: the team's actual
target architecture names FastAPI as the backend for the whole app
(chosen so ASR/OCR/extraction run in-process there), so Jeeva is built
as a real FastAPI service to match, rather than stdlib-only. The rest of
that target architecture (PostgreSQL, MinIO, Celery/Redis, Docker
Compose, the document-OCR module, ABDM interoperability) is explicitly
**out of scope for this service** — JeevanLink's existing Next.js /
Prisma / SQLite app stays as the deployable baseline for the 2026-09-21
deadline, and only Jeeva's own voice pipeline lives here for now.

## Where does the audio go?

Recorded audio is posted to `/listen` from the browser, held in memory
for the duration of the request, and discarded once transcribed —
nothing is written to disk here. (The "unless the vaidya pins it"
retention behavior from the build spec isn't implemented yet.) Nothing
leaves India — Bhashini is a MeitY/government-run service. The API keys
never reach the browser; the frontend only ever calls this local
FastAPI service.
