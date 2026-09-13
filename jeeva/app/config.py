"""
Central place for Jeeva's environment configuration. One file, read once,
so "is Bhashini configured" is answered the same way everywhere instead
of every route re-checking os.environ for itself.
"""

import os

from dotenv import load_dotenv

load_dotenv()

BHASHINI_API_KEY = os.environ.get("BHASHINI_API_KEY", "").strip()
BHASHINI_USER_ID = os.environ.get("BHASHINI_USER_ID", "").strip()
BHASHINI_PIPELINE_ID = os.environ.get("BHASHINI_PIPELINE_ID", "").strip()

BHASHINI_CONFIGURED = bool(BHASHINI_API_KEY)

# The Next.js frontend's origin, for CORS. Override in jeeva/.env for a
# non-default dev port or a real deployment origin.
FRONTEND_ORIGIN = os.environ.get("JEEVA_FRONTEND_ORIGIN", "http://localhost:3000")

# Demo mode: synthetic patients only, never the live JeevanLink database.
# Defaults ON -- you opt IN to real patients, not the other way round.
DEMO_MODE = os.environ.get("JEEVANLINK_DEMO", "1").strip() != "0"
