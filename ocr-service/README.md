# Handwriting OCR (Module B)

A pretrained TrOCR pass over handwritten prescription images, called by
`apps/web`'s `/api/analyze-document` route as a second, independent
grounding source alongside Tesseract's printed-text OCR. Not fine-tuned
on clinical handwriting — see the accuracy caveat below before trusting
its output for anything beyond "a hint Gemini can lean on."

Separate service from `jeeva/` on purpose: voice (Module A) and document
digitization (Module B) are different capabilities with different
lifecycles and much heavier dependencies here (torch + transformers vs.
none in Jeeva).

## Setup (one-time)

```bash
cd ocr-service
python -m venv .venv
.venv/Scripts/activate      # Windows. Use `source .venv/bin/activate` on macOS/Linux.
pip install -r requirements.txt
cp .env.example .env
```

The first run downloads the `microsoft/trocr-base-handwritten` model
(~1.3GB) from Hugging Face — needs internet once, then it's cached
locally. `pip install` itself is large too (torch is the biggest piece);
budget time and disk space for both.

## Run

```bash
cd ocr-service
.venv/Scripts/activate
uvicorn app.main:app --reload --port 8001
```

Check it's up: `curl http://localhost:8001/health` — `model_loaded: true`
means the TrOCR model loaded successfully; `false` means `/handwriting`
will return a 503 with the load error until that's fixed.

The Next.js app (`apps/web`) and Jeeva's own FastAPI service (`jeeva/`,
port 8000) run separately as usual. Three processes total for full
functionality — this matches the target architecture's own choice of
Docker Compose for orchestrating multiple services, not a shortcut.

## Accuracy caveat — read before demoing this

`microsoft/trocr-base-handwritten` is trained on the IAM dataset:
English cursive/print handwriting collected from filled-in forms. It is
**not** fine-tuned on:

- Clinical handwriting or doctors' shorthand
- Indian-language scripts
- Ayurvedic/medical terminology

Expect it to struggle on real prescriptions. That's exactly why
`analyze-document` treats its output as unverified grounding text for
Gemini — never as a value to accept on its own — the same way it already
treats Tesseract's printed-text pass. A genuinely reliable version of
this needs fine-tuning on real (de-identified, consented) handwritten
prescription data, which is a separate, much larger effort than wiring
in the pretrained checkpoint.

## No GPU, but not fast

CPU inference through a transformer encoder-decoder takes a few seconds
per image. The model loads once at process startup, not per request —
restarting the service means paying that load cost again, but every
`/handwriting` call after that reuses the already-loaded model.
