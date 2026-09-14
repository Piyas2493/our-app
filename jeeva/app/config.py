"""
Central place for Jeeva's environment configuration. One file, read once,
so "is Bhashini configured" is answered the same way everywhere instead
of every route re-checking os.environ for itself.
"""

import os

from dotenv import load_dotenv

load_dotenv()

# Names match Bhashini's own dashboard fields exactly (dashboard.bhashini.co.in
# -> API Keys), so there's no translation step when copying values into .env:
#   UDYAT KEY  -> BHASHINI_USER_ID       (sent as the `userID` header)
#   INFERENCE  -> BHASHINI_ULCA_API_KEY  (sent as the `ulcaApiKey` header)
# Both are used only for the Pipeline Config Call. The actual per-request
# inference Authorization token is returned BY that call (see bhashini.py)
# and is never one of these two -- if the config call itself starts
# rejecting these credentials, that's the first thing to check against
# the ULCA portal / Bhashini support, since this mapping is inferred from
# public docs and a reference client, not confirmed against this exact
# dashboard.
BHASHINI_USER_ID = os.environ.get("BHASHINI_USER_ID", "").strip()
BHASHINI_ULCA_API_KEY = os.environ.get("BHASHINI_ULCA_API_KEY", "").strip()

# Public default ULCA pipeline (ASR+translation+TTS) used in Bhashini's own
# published examples. Override with a pipeline ID from your own ULCA portal
# registration if you have one tied to this app specifically.
BHASHINI_PIPELINE_ID = os.environ.get(
    "BHASHINI_PIPELINE_ID", "64392f96daac500b55c543cd"
).strip()

BHASHINI_CONFIGURED = bool(BHASHINI_USER_ID and BHASHINI_ULCA_API_KEY)

# The Next.js frontend's origin, for CORS. Override in jeeva/.env for a
# non-default dev port or a real deployment origin.
FRONTEND_ORIGIN = os.environ.get("JEEVA_FRONTEND_ORIGIN", "http://localhost:3000")

# Demo mode: synthetic patients only, never the live JeevanLink database.
# Defaults ON -- you opt IN to real patients, not the other way round.
DEMO_MODE = os.environ.get("JEEVANLINK_DEMO", "1").strip() != "0"
