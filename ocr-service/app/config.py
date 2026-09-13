"""
Central config for the handwriting-OCR service. One file, read once, same
pattern as jeeva/app/config.py.
"""

import os

from dotenv import load_dotenv

load_dotenv()

FRONTEND_ORIGIN = os.environ.get("OCR_FRONTEND_ORIGIN", "http://localhost:3000")

# microsoft/trocr-base-handwritten is trained on the IAM dataset -- English
# cursive/print handwriting from forms, NOT clinical handwriting or Indian
# doctors' shorthand. It is not fine-tuned for prescriptions. Treat its
# output the same way analyze-document treats Tesseract's: unverified
# grounding text for Gemini, never a value accepted on its own.
MODEL_NAME = os.environ.get("TROCR_MODEL_NAME", "microsoft/trocr-base-handwritten")
