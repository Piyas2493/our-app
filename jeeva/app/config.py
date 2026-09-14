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
# and is never one of these two.
#
# STATUS as of 2026-09-14, tested against a real account/key pair -- still
# UNRESOLVED, not confirmed working:
#   - Against pipeline 64392f96daac500b55c543cd (MeitY) and
#     643930aa521a4b1ba0f4c41d (AI4Bharat): "Pipeline model with the
#     request PipelineId does not exist" -- reads like the pipeline is
#     the problem, not the keys.
#   - Against pipeline 660fa5bec7fb5b0328229016 (IIT Madras, the one
#     pipeline publicly documented to support ASR+TTS): "Error in
#     fetching ulcaApiKey. Please check if it exists" -- for BOTH
#     orderings of the two dashboard values across the two headers.
#     This one reads like the keys themselves aren't recognized.
#   These two error types contradict each other on whether the keys are
#   even valid, which means the header mapping above is NOT confirmed --
#   it's the most plausible reading, not a verified fact. This "Udyat"
#   dashboard style may need an activation step, may take time to
#   propagate after generation, or may use a flow the classic public
#   ULCA docs don't cover (its own docs page was an unrelated generic
#   template, not real content, when checked). If this keeps failing,
#   escalate to Bhashini support with these two exact error messages
#   rather than continuing to guess.
BHASHINI_USER_ID = os.environ.get("BHASHINI_USER_ID", "").strip()
BHASHINI_ULCA_API_KEY = os.environ.get("BHASHINI_ULCA_API_KEY", "").strip()

# No usable default exists -- of the 4 pipeline IDs Bhashini's docs list
# as publicly usable, only IIT Madras (660fa5bec7fb5b0328229016) supports
# ASR+TTS (the other 3 are translation-only or fail outright for this
# account -- see the status note above). None have been made to work yet.
# BHASHINI_PIPELINE_ID must be set in .env -- check your Bhashini
# dashboard for a "Pipelines"/"Services" section naming one tied to your
# specific keys, or ask Bhashini support.
BHASHINI_PIPELINE_ID = os.environ.get("BHASHINI_PIPELINE_ID", "").strip()

BHASHINI_CONFIGURED = bool(BHASHINI_USER_ID and BHASHINI_ULCA_API_KEY and BHASHINI_PIPELINE_ID)

# The Next.js frontend's origin, for CORS. Override in jeeva/.env for a
# non-default dev port or a real deployment origin.
FRONTEND_ORIGIN = os.environ.get("JEEVA_FRONTEND_ORIGIN", "http://localhost:3000")

# Demo mode: synthetic patients only, never the live JeevanLink database.
# Defaults ON -- you opt IN to real patients, not the other way round.
DEMO_MODE = os.environ.get("JEEVANLINK_DEMO", "1").strip() != "0"
