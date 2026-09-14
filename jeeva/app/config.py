"""
Central place for Jeeva's environment configuration. One file, read once,
so "is Bhashini configured" is answered the same way everywhere instead
of every route re-checking os.environ for itself.
"""

import os

from dotenv import load_dotenv

load_dotenv()

# RESOLVED 2026-09-14 (see bhashini.py for the full story): this
# Bhashini-Udyat account needs only ONE credential for ASR/TTS -- the
# dashboard's "INFERENCE" key, used directly as the `Authorization`
# header on the inference endpoint. No pipeline ID, no config call, no
# userID/ulcaApiKey pair. Verified with a real end-to-end round trip
# (TTS output fed into ASR, got the original text back).
BHASHINI_ULCA_API_KEY = os.environ.get("BHASHINI_ULCA_API_KEY", "").strip()

# The dashboard's "UDYAT KEY" -- kept for completeness / in case some
# other Bhashini surface ends up needing it, but ASR/TTS here do not.
BHASHINI_USER_ID = os.environ.get("BHASHINI_USER_ID", "").strip()

BHASHINI_CONFIGURED = bool(BHASHINI_ULCA_API_KEY)

# The Next.js frontend's origin, for CORS. Override in jeeva/.env for a
# non-default dev port or a real deployment origin.
FRONTEND_ORIGIN = os.environ.get("JEEVA_FRONTEND_ORIGIN", "http://localhost:3000")

# Demo mode: synthetic patients only, never the live JeevanLink database.
# Defaults ON -- you opt IN to real patients, not the other way round.
DEMO_MODE = os.environ.get("JEEVANLINK_DEMO", "1").strip() != "0"
