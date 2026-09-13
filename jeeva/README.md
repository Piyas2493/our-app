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
cp .env.example .env        # then fill in BHASHINI_API_KEY once you have one
```

## Run

```bash
cd jeeva
.venv/Scripts/activate
uvicorn app.main:app --reload --port 8000
```

The Next.js app (`apps/web`) runs separately as usual (`npm run dev`).
Two processes, not one, for now — see the architecture note below.

## Status

No Bhashini API key is configured yet. `/listen` and `/speak` both
return `503 {"error": "bhashini_not_configured"}` until `BHASHINI_API_KEY`
is set in `.env` — this is the intended "degrade loudly" behavior, not a
bug: the Jeeva orb in the browser reads this and shows its `error` state
with the reason on screen, rather than failing silently.

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
for the duration of the request, and (once Bhashini is wired in) deleted
immediately after transcription unless the vaidya pins it. Nothing
leaves India — Bhashini is a MeitY/government-run service. The API key
never reaches the browser; the frontend only ever calls this local
FastAPI service.
