FROM python:3.9-slim

WORKDIR /app

# Install system dependencies (ffmpeg for audio decoding)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Pre-download and bake speech model weights into the container image during build.
# This eliminates cold-start download delays and removes third-party runtime dependencies.
ENV WHISPER_MODEL_DIR=/app/models/whisper-small
RUN python -c "from faster_whisper import download_model; download_model('small', output_dir='/app/models/whisper-small')"

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
