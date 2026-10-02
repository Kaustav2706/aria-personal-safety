import os
import tempfile
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from starlette.concurrency import run_in_threadpool

# Services imports
from whisper_detector import WhisperDetector
from tone_classifier import ToneClassifier
from context_scorer import ContextScorer

# Load the engine's local .env for direct `uvicorn main:app` starts. Values
# already supplied by the hosting environment take precedence.
_local_env_file = Path(__file__).with_name(".env")
if _local_env_file.is_file():
    for _line in _local_env_file.read_text(encoding="utf-8-sig").splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _key, _value = _line.split("=", 1)
        os.environ.setdefault(_key.strip(), _value.strip().strip("\"'") )

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

# Restrict CORS to only the backend service — this is an internal API,
# it should never be callable from a browser or public client.
# BACKEND_URL must be set in the environment (e.g. http://aria-backend:5000)
_allowed_origins = [o.strip() for o in os.environ.get("BACKEND_URL", "http://localhost:5000").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["POST"],
    allow_headers=["X-Internal-Secret", "Content-Type"],
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
        "analysisReady": ready
    }

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

        # 1. Run Whisper transcription, passing the user's preferred language
        whisper_result = await run_in_threadpool(
            whisper.transcribe_audio,
            temp_file_path,
            original_filename=file.filename,
            # The caller's profile/UI language is not necessarily the spoken
            # language. Use Whisper's multilingual audio detection by default.
            language=None
        )
        if not whisper_result.get("available", False):
            raise HTTPException(status_code=503, detail="AI analysis unavailable: audio transcription failed.")

        # 2. Run Acoustic classifier with actual audio file path to detect shouting/RMS volume
        tone_conf = await run_in_threadpool(
            tone.classify_voice_tone,
            temp_file_path,
            original_filename=file.filename,
            distress_flagged=whisper_result["distress_flagged"]
        )
        if tone_conf is None:
            raise HTTPException(status_code=503, detail="AI analysis unavailable: audio signal could not be decoded.")
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

    # Elevate threat_level if acoustic classifier detects shouting/screaming
    if tone_conf >= 85.0:
        threat_level = "CRITICAL"
        print(f"[AI ENGINE] Threat level elevated to CRITICAL based on shouting volume (tone_conf={tone_conf}%)")
    elif tone_conf >= 75.0 and threat_level != "CRITICAL":
        threat_level = "WARNING"
        print(f"[AI ENGINE] Threat level elevated to WARNING based on shouting volume (tone_conf={tone_conf}%)")

    # Combined distress status check
    is_distress = whisper_flag or tone_conf >= 75.0
    combined_confidence = round((whisper_conf + tone_conf) / 2.0, 2)

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
        "threat_level": str(threat_level)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
