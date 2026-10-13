import os
from transcript_analyzer import TranscriptAnalyzer
from threading import Lock

from audio_metrics import audio_metrics

try:
    from faster_whisper import WhisperModel
except (ImportError, OSError):
    WhisperModel = None

WHISPER_MODEL_NAME = os.environ.get("WHISPER_MODEL_NAME", "small")
WHISPER_MODEL_DIR = os.environ.get("WHISPER_MODEL_DIR", "/app/models/whisper-small")

class WhisperDetector:
    def __init__(self):
        # Initialize WhisperModel
        print("[WHISPER DETECTOR] Initializing Whisper model...")
        try:
            if WhisperModel:
                # 1. Prefer pre-baked offline model directory (baked during Docker build)
                if os.path.isdir(WHISPER_MODEL_DIR) and os.listdir(WHISPER_MODEL_DIR):
                    print(f"[WHISPER DETECTOR] Loading pre-baked offline Whisper model from '{WHISPER_MODEL_DIR}'...")
                    self.model = WhisperModel(WHISPER_MODEL_DIR, device="cpu", compute_type="int8", local_files_only=True)
                else:
                    # 2. Fallback to model name (for local development outside Docker)
                    print(f"[WHISPER DETECTOR] Pre-baked model not found at '{WHISPER_MODEL_DIR}'. Loading '{WHISPER_MODEL_NAME}'...")
                    self.model = WhisperModel(WHISPER_MODEL_NAME, device="cpu", compute_type="int8")

                if self.model:
                    print("[WHISPER DETECTOR] Whisper model initialized successfully.")
                else:
                    print("[WHISPER DETECTOR] faster-whisper is not installed; analysis is unavailable.")
            else:
                self.model = None
                print("[WHISPER DETECTOR] faster-whisper is not installed; analysis is unavailable.")
        except Exception as e:
            print(f"[WHISPER DETECTOR] Failed to initialize Whisper model: {e}")
            self.model = None

        # Initialize TranscriptAnalyzer
        self.analyzer = TranscriptAnalyzer()
        self._transcription_lock = Lock()

    def is_available(self) -> bool:
        return self.model is not None

    def transcribe_audio(self, file_path: str, original_filename: str = None, language: str = None) -> dict:
        """
        Transcribe audio file using faster-whisper.

        Args:
            file_path:         Path to the temporary audio file.
            original_filename: Original client filename, used for diagnostic logging only.
            language:          Optional explicit BCP-47 hint. None lets the multilingual
                               model detect the spoken language from the audio itself.
        """
        transcript = ''

        if not self.model:
            return {
                "available": False,
                "status": "model_unavailable",
                "transcript": "",
                "distress_flagged": False,
                "confidence": 0.0,
                "threatLevel": "SAFE",
                "risk_score": 0
            }

        if not os.path.exists(file_path):
            audio_metrics.record_failure("file_not_found")
            return {
                "available": True,
                "status": "could_not_be_read",
                "error": "Audio file does not exist on disk.",
                "transcript": "",
                "distress_flagged": False,
                "confidence": 0.0,
                "threatLevel": "SAFE",
                "risk_score": 0
            }

        # 1. Attempt real transcription
        try:
            lang_hint = language if language else None
            print(f"[WHISPER DETECTOR] Transcribing: {file_path} | language hint: {lang_hint or 'auto'}")
            with self._transcription_lock:
                segments, info = self.model.transcribe(
                    file_path,
                    beam_size=1,
                    language=lang_hint,
                    vad_filter=True,
                    condition_on_previous_text=False
                )
                segments = list(segments)
                # If VAD filter yielded 0 segments, retry without VAD filter to catch quiet or short cries
                if not segments:
                    segments, info = self.model.transcribe(
                        file_path,
                        beam_size=1,
                        language=lang_hint,
                        vad_filter=False,
                        condition_on_previous_text=False
                    )
                    segments = list(segments)
            print(
                f"[WHISPER DETECTOR] Detected language: {info.language} "
                f"(confidence={info.language_probability:.2f})"
            )
            
            transcript_parts = []
            for segment in segments:
                transcript_parts.append(segment.text)
            
            # Join segment text and clean whitespace
            raw_transcript = " ".join(transcript_parts).strip()
            
            if raw_transcript:
                transcript = raw_transcript
                print(f"[WHISPER DETECTOR] Real transcript parsed successfully: {ascii(transcript)}")
            else:
                print("[WHISPER DETECTOR] No speech detected in audio (silence or non-speech background).")

            audio_metrics.record_success()
        except Exception as e:
            print(f"[WHISPER DETECTOR] Real transcription failed (possibly invalid audio format): {e}")
            audio_metrics.record_failure(f"transcription_decode_error: {e}")
            return {
                "available": True,
                "status": "could_not_be_read",
                "error": f"Audio could not be read: {e}",
                "transcript": "",
                "distress_flagged": False,
                "confidence": 0.0,
                "threatLevel": "SAFE",
                "risk_score": 0
            }
            
        # Perform transcript intelligence analysis using only recognized audio.
        if transcript:
            analysis = self.analyzer.analyze(transcript)
            print(f"[WHISPER DETECTOR] Transcript Intelligence -> Distress: {analysis['distress']} | Confidence: {analysis['confidence']}% | Threat Level: {analysis['threatLevel']}")
            return {
                "available": True,
                "status": "OK",
                "transcript": transcript,
                "distress_flagged": analysis["distress"],
                "confidence": analysis["confidence"],
                "threatLevel": analysis["threatLevel"]
            }
        else:
            # Silent room / no speech detected: honest safe result with 0 risk score
            return {
                "available": True,
                "status": "OK",
                "transcript": "",
                "distress_flagged": False,
                "confidence": 0.0,
                "threatLevel": "SAFE",
                "risk_score": 0
            }
