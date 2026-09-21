"""
Central config for the handwriting-OCR service. One file, read once, same
pattern as jeeva/app/config.py.
"""

import os

from dotenv import load_dotenv

load_dotenv()

FRONTEND_ORIGIN = os.environ.get("OCR_FRONTEND_ORIGIN", "http://localhost:3000")

# microsoft/trocr-small-handwritten is trained on the same IAM dataset as
# the base checkpoint -- English cursive/print handwriting from forms,
# NOT clinical handwriting or Indian doctors' shorthand -- but is small
# enough (DeiT-small/MiniLM backbone) to plausibly fit Render's free
# 512MB-RAM tier, unlike -base. Less accurate than -base either way;
# still unverified grounding text for Gemini, never a value accepted on
# its own -- same treatment analyze-document already gives Tesseract's.
MODEL_NAME = os.environ.get("TROCR_MODEL_NAME", "microsoft/trocr-small-handwritten")
