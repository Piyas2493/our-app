FROM python:3.11-slim

WORKDIR /code

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Hugging Face Spaces (Docker SDK) expects the container to listen on
# the port declared as `app_port` in README.md's frontmatter -- 7860 is
# HF's own convention, kept here to match it exactly.
EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
