import os
import tempfile
from pathlib import Path
from threading import Lock
from typing import Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
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

# Do not queue stale real-time audio while CPU inference is still running.
analysis_request_lock = Lock()

def acquire_analysis_slot(x_internal_secret: Optional[str] = Header(None)):
    if x_internal_secret != AI_ENGINE_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not analysis_request_lock.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="AI analysis is busy; retry with a fresh audio window.")
    try:
        yield
    finally:
        analysis_request_lock.release()

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

@app.post("/session/reset")
def reset_session(
    session_id: Optional[str] = Form(None),
    x_internal_secret: Optional[str] = Header(None)
):
    if x_internal_secret != AI_ENGINE_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    tone.reset_session(session_id)
    return {"status": "OK", "message": f"Session {session_id or 'all'} calibration reset."}

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
    # When null/omitted, Whisper auto-detects the language from the recording.
    language: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    x_internal_secret: Optional[str] = Header(None),
    _analysis_slot: None = Depends(acquire_analysis_slot)
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
    print(f"[AI ENGINE] Session ID: {session_id or 'N/A'}")

    # Save the uploaded file to a temporary file, and pass its path to whisper.transcribe_audio
    _, ext = os.path.splitext(file.filename or "audio.webm")
    temp_file_path = None
    whisper_result = None
    tone_conf = 0.0
    tone_result = None
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
            language=language if (language and language != 'auto') else None
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
            distress_flagged=whisper_result.get("distress_flagged", False),
            session_id=session_id,
            timestamp=timestamp
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

    return evaluate_incident_analysis(
        whisper_result=whisper_result,
        tone_result=tone_result,
        motion_anomaly=motion_anomaly,
        is_isolated=is_isolated,
        timestamp=timestamp,
        scorer_instance=scorer
    )


def evaluate_incident_analysis(
    whisper_result: Optional[dict],
    tone_result: Optional[dict],
    motion_anomaly: bool = False,
    is_isolated: bool = False,
    timestamp: Optional[str] = None,
    scorer_instance: Optional[ContextScorer] = None
) -> dict:
    """
    Evaluates multimodal threat indicators, applies volume-alone safety caps,
    and calculates contextual risk score. This is the single production source of
    truth for incident classification.
    """
    active_scorer = scorer_instance if scorer_instance is not None else scorer

    tone_measured = tone_result.get("measured", False) if isinstance(tone_result, dict) else False
    tone_conf = tone_result.get("confidence") if isinstance(tone_result, dict) else None

    transcript = whisper_result.get("transcript", "") if whisper_result else ""
    whisper_flag = bool(
        whisper_result.get("distress_flagged", False) or
        whisper_result.get("distress", False)
    ) if whisper_result else False
    whisper_conf = float(whisper_result.get("confidence", 0.0)) if whisper_result else 0.0
    raw_whisper_threat = (
        whisper_result.get("threatLevel") or
        whisper_result.get("threat_level") or
        "SAFE"
    ) if whisper_result else "SAFE"
    threat_level = raw_whisper_threat

    # ── Independent Distress Validation ───────────────────────────────────────
    # Truly independent distress signals:
    # 1. Linguistic distress keywords confirmed by Whisper (whisper_flag == True)
    # 2. Independent threat rating from speech analysis (CONCERN, WARNING, CRITICAL)
    #
    # CRITICAL SAFETY PRINCIPLE:
    # - tone_conf reflects RMS loudness relative to baseline, NOT confirmed distress.
    #   Loudness alone can be caused by environmental sounds (thunder, traffic, slamming doors).
    # - Motion anomaly reflects physical movement/acceleration, NOT confirmed distress.
    #   Movement alone can be caused by jogging, running, jumping, or phone handling.
    # - Neither loudness alone, motion alone, nor the combination of loudness + motion
    #   constitutes independently validated distress.
    has_validated_distress = bool(
        whisper_flag or
        raw_whisper_threat in ["CONCERN", "WARNING", "CRITICAL"]
    )

    is_shouting_volume = bool(
        tone_measured and tone_conf is not None and tone_conf >= 75.0
    )

    # ── Threat Level & Distress Evaluation ───────────────────────────────────
    if has_validated_distress:
        # Confirmed linguistic or independent distress signal is present.
        # Genuine shouting (high acoustic volume) and motion anomaly act as valid emergency amplifiers.
        if is_shouting_volume:
            if tone_conf >= 85.0 or motion_anomaly:
                threat_level = "CRITICAL"
                print(f"[AI ENGINE] Threat level elevated to CRITICAL based on genuine shouting + validated distress (tone_conf={tone_conf}%)")
            elif threat_level not in ["WARNING", "CRITICAL"]:
                threat_level = "WARNING"
                print(f"[AI ENGINE] Threat level elevated to WARNING based on shouting + validated distress (tone_conf={tone_conf}%)")
        else:
            threat_level = raw_whisper_threat if raw_whisper_threat in ["CONCERN", "WARNING", "CRITICAL"] else "WARNING"
        is_distress = True

    else:
        # NO independently validated distress (audio is calm speech, silence, or non-speech background).
        # Neither high volume (environmental noise) nor motion anomaly (running/movement)
        # nor the combination of both can be treated as definitive proof of an emergency.
        is_distress = False

        if is_shouting_volume:
            # High acoustic volume without distress speech: record as WARNING for acoustic monitoring,
            # but NEVER elevate to CRITICAL and NEVER confirm distress.
            threat_level = "WARNING"
            print(f"[AI ENGINE] Loud acoustic volume detected without speech distress (environmental noise). Threat level capped at WARNING.")
        else:
            threat_level = "SAFE"

    # ── Combining Confidence Scores ──────────────────────────────────────────
    if has_validated_distress:
        if tone_measured and tone_conf is not None:
            if is_shouting_volume:
                combined_confidence = min(100.0, max(whisper_conf, tone_conf) + 10.0)
            else:
                combined_confidence = max(whisper_conf, tone_conf)
        else:
            combined_confidence = whisper_conf
    else:
        # No validated speech distress
        if is_shouting_volume:
            # Volume alone / environmental noise: reflects acoustic loudness, capped at 75
            combined_confidence = min(75.0, tone_conf) if tone_conf is not None else 0.0
        elif motion_anomaly:
            calm_conf = whisper_conf if whisper_conf > 0 else (tone_conf if (tone_measured and tone_conf is not None) else 0.0)
            combined_confidence = min(50.0, float(calm_conf))
        elif tone_measured and tone_conf is not None:
            combined_confidence = round((whisper_conf + tone_conf) / 2.0, 2)
        else:
            combined_confidence = whisper_conf

    # 3. Context Scorer calculation using weights:
    # Distress Confidence (55%), Threat Level (25%), Isolation (10%), Night Time (5%), Escalation (5%)
    risk_rating = active_scorer.calculate_risk_score(
        audio_distress=is_distress,
        is_isolated=is_isolated,
        has_motion_anomaly=motion_anomaly,
        timestamp_str=timestamp,
        distress_confidence=combined_confidence,
        threat_level=threat_level,
        transcript=transcript
    )

    # ── Safety Boundaries: Explicit Protection for Unsafe Combinations ──────────
    # Automatic monitoring (POST /api/monitoring/chunk) creates an incident when:
    #   (distress == True and confidence >= 60) OR riskScore >= 60
    #
    # We explicitly identify the four non-emergency combinations that must NEVER
    # cross 50% risk or trigger automatic incident creation:
    #   1. Loudness alone (high acoustic volume/RMS without validated distress)
    #   2. Motion anomaly alone (sensor movement/running/handling without distress)
    #   3. Loudness + motion anomaly (ambient noise + movement without distress)
    #   4. Contextual risk alone (nighttime / isolated location without audio/movement/distress)
    is_loudness_alone = bool(is_shouting_volume and not motion_anomaly and not has_validated_distress)
    is_motion_alone = bool(motion_anomaly and not is_shouting_volume and not has_validated_distress)
    is_loudness_and_motion = bool(is_shouting_volume and motion_anomaly and not has_validated_distress)
    is_context_alone = bool(not is_shouting_volume and not motion_anomaly and not has_validated_distress)

    is_unsafe_combination = (
        is_loudness_alone or
        is_motion_alone or
        is_loudness_and_motion or
        is_context_alone
    )
    if is_unsafe_combination:
        max_unvalidated_score = 50
        if risk_rating > max_unvalidated_score:
            print(f"[AI ENGINE] Capping risk score from {risk_rating}% to {max_unvalidated_score}% (unsafe combination: loudness_alone={is_loudness_alone}, motion_alone={is_motion_alone}, noise+motion={is_loudness_and_motion}, context_alone={is_context_alone})")
            risk_rating = max_unvalidated_score

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
        "tone_confidence": float(tone_conf) if (tone_measured and tone_conf is not None) else None,
        "baseline": tone_result.get("baseline") if isinstance(tone_result, dict) else None,
        "calibration_status": tone_result.get("calibration_status") if isinstance(tone_result, dict) else "unavailable"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
