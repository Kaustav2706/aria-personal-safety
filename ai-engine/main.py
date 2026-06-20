import os
import tempfile
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

# Services imports
from whisper_detector import WhisperDetector
from tone_classifier import ToneClassifier
from context_scorer import ContextScorer

app = FastAPI(
    title="ARIA AI Engine",
    description="Real-time audio processing & context risk assessment service.",
    version="1.1.0"
)

# Enable CORS for cross-communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate models
whisper = WhisperDetector()
tone = ToneClassifier()
scorer = ContextScorer()

@app.get("/")
def read_root():
    return {"status": "ONLINE", "message": "ARIA AI Engine running."}

@app.post("/analyze")
async def analyze_incident_audio(
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(0.0),
    longitude: Optional[float] = Form(0.0),
    timestamp: Optional[str] = Form(None),
    is_isolated: Optional[bool] = Form(False),
    motion_anomaly: Optional[bool] = Form(False)
):
    """
    Analyzes uploaded audio file using Whisper transcription and acoustics evaluation,
    returning threat assessment ratings.
    """
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
        whisper_result = whisper.transcribe_audio(temp_file_path, original_filename=file.filename)

        # 2. Run Acoustic classifier with actual audio file path to detect shouting/RMS volume
        tone_conf = tone.classify_voice_tone(temp_file_path, original_filename=file.filename, distress_flagged=whisper_result["distress_flagged"])
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

    # 3. Context Scorer calculation using new weights:
    # Distress Confidence (50%), Threat Level (20%), Isolation (10%), Night Time (5%), Motion (10%), Escalation (5%)
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
        "distress": is_distress,
        "confidence": combined_confidence,
        "transcript": transcript,
        "riskScore": risk_rating,
        "risk_score": risk_rating,
        "threatLevel": threat_level,
        "threat_level": threat_level
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
