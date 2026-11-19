import os
import struct
import wave
import contextlib
from transcript_analyzer import TranscriptAnalyzer
from threading import Lock

from audio_metrics import audio_metrics

try:
    from faster_whisper import WhisperModel
except (ImportError, OSError):
    WhisperModel = None

WHISPER_MODEL_NAME = os.environ.get("WHISPER_MODEL_NAME", "base")
WHISPER_MODEL_DIR = os.environ.get("WHISPER_MODEL_DIR", "/app/models/whisper-small")

class WhisperDetector:
    def __init__(self):
        # Initialize WhisperModel
        print("[WHISPER DETECTOR] Initializing Whisper model...")
        try:
            if WhisperModel:
                model_name = os.environ.get("WHISPER_MODEL_NAME", "base")
                threads = max(2, (os.cpu_count() or 4) - 1)
                # 1. Prefer pre-baked offline model directory (baked during Docker build)
                if os.path.isdir(WHISPER_MODEL_DIR) and os.listdir(WHISPER_MODEL_DIR):
                    print(f"[WHISPER DETECTOR] Loading pre-baked offline Whisper model from '{WHISPER_MODEL_DIR}'...")
                    self.model = WhisperModel(WHISPER_MODEL_DIR, device="cpu", compute_type="int8", local_files_only=True, cpu_threads=threads)
                else:
                    # 2. Fallback to model name (for local development outside Docker)
                    print(f"[WHISPER DETECTOR] Pre-baked model not found at '{WHISPER_MODEL_DIR}'. Loading '{model_name}' with {threads} CPU threads...")
                    self.model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=threads)

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
        # Silence floor: clips whose RMS amplitude is below this fraction of the
        # int16 max are skipped without acquiring the transcription lock.
        # Configurable via WHISPER_SILENCE_RMS_THRESHOLD (default 0.002 ≈ -54 dBFS).
        self._silence_rms_threshold = float(
            os.environ.get("WHISPER_SILENCE_RMS_THRESHOLD", "0.002")
        )

    def is_available(self) -> bool:
        return self.model is not None

    def _is_silent(self, file_path: str) -> bool:
        """
        Return True when the WAV file's RMS amplitude is below the configured
        silence threshold.  Non-WAV files (webm, mp4, etc.) cannot be read
        with the stdlib wave module and are assumed to be non-silent so they
        proceed to Whisper normally.
        """
        try:
            with contextlib.closing(wave.open(file_path, 'rb')) as wf:
                n_frames = wf.getnframes()
                if n_frames == 0:
                    return True
                raw = wf.readframes(n_frames)
                sample_width = wf.getsampwidth()
                if sample_width == 2:  # int16 PCM
                    fmt = f"{len(raw) // 2}h"
                    samples = struct.unpack(fmt, raw)
                    rms = (sum(s * s for s in samples) / len(samples)) ** 0.5
                    normalised = rms / 32768.0
                    return normalised < self._silence_rms_threshold
        except Exception:
            pass
        return False  # Cannot determine — let Whisper decide

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

        # N26 fix: skip transcription entirely for silent clips so the global
        # lock is never acquired for the most common (and cheapest to detect) case.
        # This eliminates the previous double-transcription pattern where VAD pass
        # and non-VAD pass both held the lock sequentially for every silent clip.
        if self._is_silent(file_path):
            print(f"[WHISPER DETECTOR] Clip below silence floor — skipping transcription: {file_path}")
            audio_metrics.record_success()
            return {
                "available": True,
                "status": "OK",
                "transcript": "",
                "distress_flagged": False,
                "confidence": 0.0,
                "threatLevel": "SAFE",
                "risk_score": 0
            }

        # 1. Transcription — single pass with VAD filter.
        # Genuine cries/screams are loud enough that VAD will pass them through.
        # The silence pre-check above already handles truly quiet clips without
        # ever entering Whisper, so the double-transcription fallback is removed.
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
