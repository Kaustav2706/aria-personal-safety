import os
import tempfile
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from starlette.concurrency import run_in_threadpool

# Load root .env and local .env for direct uvicorn starts. Values
# already supplied by the hosting environment take precedence.
for _env_path in [Path(__file__).parent.parent / ".env", Path(__file__).with_name(".env")]:
    if _env_path.is_file():
        for _line in _env_path.read_text(encoding="utf-8-sig").splitlines():
            _line = _line.strip()
            if not _line or _line.startswith("#") or "=" not in _line:
                continue
            _key, _value = _line.split("=", 1)
            os.environ.setdefault(_key.strip(), _value.strip().strip("\"'"))

# Services imports
from whisper_detector import WhisperDetector
from tone_classifier import ToneClassifier
from context_scorer import ContextScorer
from audio_metrics import audio_metrics

# gets AI_ENGINE_SECRET
AI_ENGINE_SECRET = os.environ.get("AI_ENGINE_SECRET", "aria-local-dev-secret-key-2024")
# AI_ENGINE_SECRET = os.environ.get("AI_ENGINE_SECRET")
if not AI_ENGINE_SECRET:
    raise RuntimeError("AI_ENGINE_SECRET is not set. Refusing to start.")

app = FastAPI(
    title="ARIA AI Engine",
    description="Real-time audio processing & context risk assessment service.",
    version="1.1.0"
)

# ── Explicit CORS Configuration ─────────────────────────────────────────────
# Restrict AI Engine access to authorized origins (backend and frontends).
# Configurable via ALLOWED_ORIGINS or BACKEND_URL so staging and production differ securely.
_default_ai_origins = "http://localhost:5000,http://localhost:5173,http://localhost:3000,http://127.0.0.1:5000,http://127.0.0.1:5173,http://127.0.0.1:3000"
_raw_origins = os.environ.get("ALLOWED_ORIGINS") or os.environ.get("BACKEND_URL") or _default_ai_origins
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["X-Internal-Secret", "Content-Type", "Authorization"],
)

# Instantiate models
whisper = WhisperDetector()
tone = ToneClassifier()
scorer = ContextScorer()

@app.get("/")
def read_root():
    return {"status": "ONLINE", "message": "ARIA AI Engine running."}

@app.get("/health")
def health_check():
    ready = whisper.is_available()
    return {
        "status": "ONLINE" if ready else "DEGRADED",
        "service": "ARIA AI Engine",
        "analysisReady": ready,
        "audioPipeline": audio_metrics.get_stats()
    }

@app.get("/metrics")
def get_metrics():
    return audio_metrics.get_stats()

@app.post("/analyze")
async def analyze_incident_audio(
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(0.0),
    longitude: Optional[float] = Form(0.0),
    timestamp: Optional[str] = Form(None),
    is_isolated: Optional[bool] = Form(False),
    motion_anomaly: Optional[bool] = Form(False),
    # BCP-47 language code from the user's profile (e.g. 'hi', 'en').
    # Passed explicitly so Whisper doesn't have to auto-detect on short clips.
    language: Optional[str] = Form(None),
    x_internal_secret: Optional[str] = Header(None)
):
    """
    Analyzes uploaded audio file using Whisper transcription and acoustics evaluation,
    returning threat assessment ratings.
    """

    #checks the AI_ENGINE_SECRET
    if x_internal_secret != AI_ENGINE_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not whisper.is_available():
        raise HTTPException(status_code=503, detail="AI analysis unavailable: speech model is not ready.")

    print(f"\n[AI ENGINE] Processing request for file: {file.filename}")
    print(f"[AI ENGINE] GPS Location: Lat {latitude}, Lng {longitude}")
    print(f"[AI ENGINE] Timestamp: {timestamp} | Isolated Area: {is_isolated}")

    # Save the uploaded file to a temporary file, and pass its path to whisper.transcribe_audio
    _, ext = os.path.splitext(file.filename or "audio.webm")
    temp_file_path = None
    whisper_result = None
    tone_conf = 0.0
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        # 1. Run Whisper transcription
        whisper_result = await run_in_threadpool(
            whisper.transcribe_audio,
            temp_file_path,
            original_filename=file.filename,
            language=language if (language and language != 'auto') else os.environ.get("DEFAULT_AUDIO_LANGUAGE", "en")
        )

        # Handle unreadable audio cleanly without inventing distress phrases:
        # return empty transcript, zero risk score, and explicit status
        if whisper_result.get("status") == "could_not_be_read":
            print("[AI ENGINE] Transcription failed/audio unreadable. Returning empty transcript and zero risk score.")
            return {
                "status": "could_not_be_read",
                "audio_status": "could_not_be_read",
                "message": whisper_result.get("error", "Audio could not be read"),
                "distress": False,
                "confidence": 0.0,
                "transcript": "",
                "riskScore": 0,
                "risk_score": 0,
                "threatLevel": "SAFE",
                "threat_level": "SAFE"
            }

        if not whisper_result.get("available", False):
            raise HTTPException(status_code=503, detail="AI analysis unavailable: speech model is not ready.")

        # 2. Run Acoustic classifier with actual audio file path to detect shouting/RMS volume
        tone_result = await run_in_threadpool(
            tone.classify_voice_tone,
            temp_file_path,
            original_filename=file.filename,
            distress_flagged=whisper_result.get("distress_flagged", False)
        )

        tone_measured = tone_result.get("measured", False) if isinstance(tone_result, dict) else (tone_result is not None)
        tone_conf = tone_result.get("confidence") if isinstance(tone_result, dict) else tone_result

        # If both speech transcription failed AND acoustic measurement failed:
        if whisper_result.get("status") == "could_not_be_read" and not tone_measured:
            print("[AI ENGINE] Both transcription and acoustic tone measurement failed. Audio unreadable.")
            audio_metrics.record_failure("audio_unreadable_both_failed")
            return {
                "status": "could_not_be_read",
                "audio_status": "could_not_be_read",
                "message": "Both transcription and acoustic tone measurement failed.",
                "distress": False,
                "confidence": 0.0,
                "transcript": "",
                "riskScore": 0,
                "risk_score": 0,
                "threatLevel": "SAFE",
                "threat_level": "SAFE",
                "acoustic_measured": False,
                "tone_confidence": None
            }
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as e:
                print(f"[AI ENGINE] Error deleting temp file {temp_file_path}: {e}")

    transcript = whisper_result["transcript"] if whisper_result else ""
    whisper_flag = whisper_result["distress_flagged"] if whisper_result else False
    whisper_conf = whisper_result["confidence"] if whisper_result else 0.0
    threat_level = whisper_result.get("threatLevel", "SAFE") if whisper_result else "SAFE"

    # Acoustic elevation: applied ONLY if tone was successfully measured
    if tone_measured and tone_conf is not None:
        if tone_conf >= 85.0:
            threat_level = "CRITICAL"
            print(f"[AI ENGINE] Threat level elevated to CRITICAL based on shouting volume (tone_conf={tone_conf}%)")
        elif tone_conf >= 75.0 and threat_level != "CRITICAL":
            threat_level = "WARNING"
            print(f"[AI ENGINE] Threat level elevated to WARNING based on shouting volume (tone_conf={tone_conf}%)")

    # Combined distress status check:
    # If tone is missing, distress is determined solely by Whisper (missing is treated as missing, not false)
    if tone_measured and tone_conf is not None:
        is_distress = whisper_flag or tone_conf >= 75.0
    else:
        is_distress = whisper_flag

    # Combining confidence scores:
    # "Anywhere downstream that combines scores should treat a missing input as missing, not as zero and not as a guess."
    if tone_measured and tone_conf is not None:
        # Both Whisper and Tone measurements are available
        if whisper_flag and tone_conf >= 75.0:
            combined_confidence = min(100.0, max(whisper_conf, tone_conf) + 10.0)
        elif whisper_flag:
            combined_confidence = max(whisper_conf, tone_conf)
        elif tone_conf >= 75.0:
            combined_confidence = tone_conf
        else:
            combined_confidence = round((whisper_conf + tone_conf) / 2.0, 2)
    else:
        # Tone measurement failed: treat tone input as MISSING (not zero, not guessed)
        # Confidence is derived strictly from the available Whisper input
        print("[AI ENGINE] Tone measurement failed/missing. Treating tone input as missing (not zero, not guessed).")
        combined_confidence = whisper_conf

    # 3. Context Scorer calculation using weights:
    # Distress Confidence (55%), Threat Level (25%), Isolation (10%), Night Time (5%), Escalation (5%)
    risk_rating = scorer.calculate_risk_score(
        audio_distress=is_distress,
        is_isolated=is_isolated,
        has_motion_anomaly=motion_anomaly,
        timestamp_str=timestamp,
        distress_confidence=combined_confidence,
        threat_level=threat_level,
        transcript=transcript
    )

    print(f"[AI ENGINE] Result -> distress={is_distress}, conf={combined_confidence}%, risk={risk_rating}%, threatLevel={threat_level}\n")

    return {
        "distress": bool(is_distress),
        "confidence": float(combined_confidence),
        "transcript": str(transcript),
        "riskScore": int(risk_rating),
        "risk_score": int(risk_rating),
        "threatLevel": str(threat_level),
        "threat_level": str(threat_level),
        "acoustic_measured": bool(tone_measured),
        "tone_confidence": float(tone_conf) if (tone_measured and tone_conf is not None) else None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
