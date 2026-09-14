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

Then open `.env` and fill in `BHASHINI_ULCA_API_KEY` from
dashboard.bhashini.co.in → API Keys → your app's "INFERENCE" key. That's
the only credential ASR/TTS actually need (see Status below) —
`BHASHINI_USER_ID` ("UDYAT KEY") can stay blank.

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

Once the one-time setup above is done, `npm run dev` from `apps/web`
starts **both** this service and the Next.js app together (via
`concurrently` — see `apps/web/package.json`'s `dev`/`dev:web`/
`dev:jeeva` scripts). Output is prefixed `[web]`/`[jeeva]` so you can
tell which process logged what; Ctrl+C stops both.

To run this service on its own (e.g. for the curl/Python testing this
README describes elsewhere):

```bash
cd jeeva
.venv/Scripts/activate
uvicorn app.main:app --reload --port 8000
```

Still two separate OS processes under the hood, not one binary — see
the architecture note below — `concurrently` just launches both with a
single command instead of two manual terminals.

## Status

**Working, verified end-to-end (2026-09-14).** `/listen` and `/speak`
call Bhashini for real once `BHASHINI_ULCA_API_KEY` is set in `.env` —
until then they return `503 {"error": "bhashini_not_configured"}`
(the intended "degrade loudly" behavior, not a bug: the Jeeva orb reads
this and shows its `error` state with the reason on screen).

Verified with a real round trip through the actual running service, not
just a script, for **all 12 languages JeevanLink's UI supports** (en,
hi, bn, ta, te, mr, gu, kn, ml, pa, or, as): `POST /speak` produced real
audio for each; posting that exact audio back to `POST /listen`
returned the original text almost verbatim every time (only trailing
punctuation is ever missing — ASR doesn't reproduce it, expected).
Odia's first-ever call needed a long cold-start (>200s) before it
worked — if you see a slow first response for a language nobody's
tested yet in this run of the service, that's normal, not a hang.

This took real investigation to get right: the two-step "Pipeline
Config Call → Pipeline Compute Call" flow described in Bhashini's older
public docs (and implemented by most third-party reference clients)
does NOT apply to this Bhashini-Udyat dashboard account — every
pipeline ID tried failed. Connecting directly to Bhashini's own docs via
their MCP server (`dibd-bhashini.gitbook.io`) surfaced the real,
simpler flow this account actually uses: `BHASHINI_ULCA_API_KEY` (the
dashboard's "INFERENCE" key) goes straight into an `Authorization`
header on `https://dhruva-api.bhashini.gov.in/services/inference/pipeline`,
with a known `serviceId` string — no pipeline ID, no config call, no
`userID`/`ulcaApiKey` pair. See `app/bhashini.py` for the full story and
the exact service IDs used.

**Bhashini's TTS output is 32-bit float PCM WAV (format tag 3), not the
far more universal 16-bit integer PCM (format tag 1)** — Python's own
`wave` module rejects it outright, and it's a known source of browsers
silently mis-rendering audio via `decodeAudioData` (no exception, just
near-silent or wrong output). `/speak` re-encodes to plain 16-bit PCM
server-side (`app/audio.py`'s `to_playable_wav`) before it ever reaches
a browser — found this the hard way when the orb wiring played nothing
despite every network call succeeding.

**This backend is measurably flaky** — roughly 1 in 3 calls during
testing failed with a bare TCP connection reset before reaching the
model, no error body; `bhashini.py` retries both that and 5xx responses
a few times, which is a property of the upstream service, not a bug to
chase down here. GPU-backed models can also have a slow cold start —
usually tens of seconds, but a language's first-ever call in a fresh
run of the service can take several minutes (Odia took over 200s
during testing). Any HTTP client calling this service (including the
future browser-side wiring) needs a timeout comfortably longer than
that, or it'll give up before the retries inside `bhashini.py` do.

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
