import os
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

    # 1. Run Whisper transcription stub
    whisper_result = whisper.transcribe_audio(file.filename)
    transcript = whisper_result["transcript"]
    whisper_flag = whisper_result["distress_flagged"]
    whisper_conf = whisper_result["confidence"]

    # 2. Run Acoustic classifier stub
    tone_conf = tone.classify_voice_tone(file.filename, whisper_flag)

    # Combined distress status check
    is_distress = whisper_flag or tone_conf >= 75.0
    combined_confidence = round((whisper_conf + tone_conf) / 2.0, 2)

    # 3. Context Scorer calculation using new weights:
    # Voice Distress (40), Night Time (20), Isolation Score (20), Motion Anomaly (20)
    risk_rating = scorer.calculate_risk_score(
        audio_distress=is_distress,
        is_isolated=is_isolated,
        has_motion_anomaly=motion_anomaly,
        timestamp_str=timestamp
    )

    print(f"[AI ENGINE] Result -> distress={is_distress}, conf={combined_confidence}%, risk={risk_rating}%\n")

    return {
        "distress": is_distress,
        "confidence": combined_confidence,
        "transcript": transcript,
        "riskScore": risk_rating,
        "risk_score": risk_rating
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
