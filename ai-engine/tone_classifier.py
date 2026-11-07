try:
    import av
except ImportError:
    av = None

try:
    import numpy as np
except ImportError:
    np = None

import os
import time
import statistics
from datetime import datetime
from typing import Optional

CALIBRATION_WINDOW_SECONDS = 60.0
DEFAULT_BASELINE = 400.0
DEFAULT_SHOUTING_THRESHOLD = 1800.0
MIN_SHOUTING_THRESHOLD = 1800.0
MAX_SHOUTING_THRESHOLD = 2400.0
SHOUTING_DELTA_OVER_BASELINE = 800.0
SESSION_MAX_AGE_SECONDS = 3600.0
MAX_CALIBRATED_BASELINE = 1200.0
MAX_AMBIENT_SAMPLE_RMS = 2000.0

class ToneClassifier:
    def __init__(self):
        # Maps session_id -> { start_time, last_seen, samples, baseline, is_calibrated }
        self.sessions = {}

    def _prune_stale_sessions(self, current_time: float):
        stale = [
            sid for sid, data in self.sessions.items()
            if (current_time - data.get("last_seen", current_time)) > SESSION_MAX_AGE_SECONDS
        ]
        for sid in stale:
            self.sessions.pop(sid, None)

    def reset_session(self, session_id: Optional[str] = None):
        """
        Resets calibration data for a specific session, or all sessions if session_id is None.
        """
        if session_id:
            self.sessions.pop(session_id, None)
            print(f"[TONE CLASSIFIER] Reset calibration for session: {session_id}")
        else:
            self.sessions.clear()
            print("[TONE CLASSIFIER] Reset all session calibrations.")

    def get_baseline(self, session_id: str) -> Optional[float]:
        """Returns the current calibrated baseline for a session, or None."""
        if session_id in self.sessions:
            b = self.sessions[session_id].get("baseline")
            return b if b is not None else DEFAULT_BASELINE
        return None

    def get_session_info(self, session_id: str) -> Optional[dict]:
        """Returns diagnostic info for a session."""
        if session_id in self.sessions:
            s = self.sessions[session_id]
            return {
                "start_time": s.get("start_time"),
                "samples_count": len(s.get("samples", [])),
                "baseline": s.get("baseline"),
                "is_calibrated": s.get("is_calibrated")
            }
        return None

    def evaluate_rms(
        self,
        rms_val: Optional[float],
        distress_flagged: bool = False,
        session_id: Optional[str] = None,
        timestamp: Optional[str] = None
    ) -> dict:
        """
        Evaluates pre-computed RMS volume against personal background calibration baseline.
        """
        # When audio cannot be measured: return no score and a flag saying the measurement failed.
        if rms_val is None:
            print("[TONE CLASSIFIER] Acoustic measurement failed. Returning no score and measured=False.")
            return {
                "measured": False,
                "confidence": None,
                "rms": None,
                "status": "measurement_failed",
                "is_shouting": False,
                "baseline": None,
                "calibration_status": "unavailable"
            }

        # Pure digital silence: measured successfully, volume is 0
        if rms_val == 0.0:
            return {
                "measured": True,
                "confidence": 0.0,
                "rms": 0.0,
                "status": "OK",
                "is_shouting": False,
                "baseline": None,
                "calibration_status": "calibrated" if (session_id and self.sessions.get(session_id, {}).get("is_calibrated")) else "unavailable"
            }

        # ── Calibration Processing ──────────────────────────────────────────
        current_time = time.time()
        if timestamp:
            try:
                dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                current_time = dt.timestamp()
            except Exception:
                pass

        self._prune_stale_sessions(current_time)

        baseline = None
        calibration_status = "unavailable"
        shouting_threshold = DEFAULT_SHOUTING_THRESHOLD

        if session_id:
            if session_id not in self.sessions:
                self.sessions[session_id] = {
                    "start_time": current_time,
                    "last_seen": current_time,
                    "samples": [],
                    "baseline": None,
                    "is_calibrated": False
                }

            session = self.sessions[session_id]
            session["last_seen"] = current_time
            elapsed = current_time - session["start_time"]

            # Initial 60 seconds: calibration window
            if elapsed <= CALIBRATION_WINDOW_SECONDS and not session["is_calibrated"]:
                calibration_status = "calibrating"
                # Only record as ambient baseline if not flagged as distress and not an extreme shouting spike
                if rms_val is not None and rms_val > 0.0:
                    if not distress_flagged and rms_val <= MAX_AMBIENT_SAMPLE_RMS:
                        session["samples"].append(float(rms_val))

                # Median statistical estimator reduces effect of temporary loud noises
                if session["samples"]:
                    raw_baseline = float(statistics.median(session["samples"]))
                    baseline = min(MAX_CALIBRATED_BASELINE, raw_baseline)
                    session["baseline"] = baseline
                else:
                    baseline = DEFAULT_BASELINE

                # During incomplete calibration, use conservative defaults
                effective_baseline = baseline if baseline is not None else DEFAULT_BASELINE
                raw_threshold = max(DEFAULT_SHOUTING_THRESHOLD, effective_baseline + SHOUTING_DELTA_OVER_BASELINE)
                shouting_threshold = min(MAX_SHOUTING_THRESHOLD, raw_threshold)
            else:
                # Past calibration window (> 60s)
                session["is_calibrated"] = True
                calibration_status = "calibrated"
                if session["baseline"] is not None:
                    baseline = min(MAX_CALIBRATED_BASELINE, session["baseline"])
                elif session["samples"]:
                    raw_baseline = float(statistics.median(session["samples"]))
                    baseline = min(MAX_CALIBRATED_BASELINE, raw_baseline)
                    session["baseline"] = baseline
                else:
                    baseline = DEFAULT_BASELINE
                    session["baseline"] = baseline

                raw_threshold = max(MIN_SHOUTING_THRESHOLD, baseline + SHOUTING_DELTA_OVER_BASELINE)
                shouting_threshold = min(MAX_SHOUTING_THRESHOLD, raw_threshold)
        else:
            calibration_status = "unavailable"
            baseline = None
            shouting_threshold = DEFAULT_SHOUTING_THRESHOLD

        # ── Shouting Detection ──────────────────────────────────────────────
        is_shouting = rms_val > shouting_threshold

        if is_shouting:
            # Map excess RMS above shouting_threshold to high distress tone confidence range (75% to 99%)
            span = 4200.0
            excess = min(span, max(0.0, rms_val - shouting_threshold))
            tone_confidence = 75.0 + (excess / span) * 24.0
            print(f"[TONE CLASSIFIER] Shouting/High volume detected (threshold={shouting_threshold:.1f}, baseline={baseline}). RMS={rms_val:.2f} -> Confidence={tone_confidence:.2f}%")
        else:
            # Map RMS to normal/low voice tone confidence range (10% to 45%)
            floor = max(50.0, baseline if baseline is not None else 100.0)
            norm_range = max(100.0, shouting_threshold - floor)
            clamped_rms = min(shouting_threshold, max(floor, rms_val))
            tone_confidence = 10.0 + ((clamped_rms - floor) / norm_range) * 35.0
            print(f"[TONE CLASSIFIER] Normal voice level (threshold={shouting_threshold:.1f}, baseline={baseline}). RMS={rms_val:.2f} -> Confidence={tone_confidence:.2f}%")

        # Boost tone confidence if whisper flagged linguistic distress
        if distress_flagged:
            tone_confidence = max(85.0, tone_confidence)
            print(f"[TONE CLASSIFIER] Boosting confidence to {tone_confidence:.2f}% due to distress keywords.")

        return {
            "measured": True,
            "confidence": round(tone_confidence, 2),
            "rms": round(rms_val, 2),
            "status": "OK",
            "is_shouting": bool(is_shouting),
            "baseline": round(baseline, 2) if baseline is not None else None,
            "calibration_status": calibration_status,
            "threshold": round(shouting_threshold, 2)
        }

    def classify_voice_tone(
        self,
        file_path: str,
        original_filename: str = None,
        distress_flagged: bool = False,
        session_id: Optional[str] = None,
        timestamp: Optional[str] = None
    ) -> dict:
        """
        Analyzes physical voice tone metrics (pitch, loudness/RMS, and variations).
        Detects if the user is shouting (high RMS/amplitude above baseline) or speaking normally.
        
        Returns a dictionary:
        {
            "measured": bool,         # Flag indicating if acoustic measurement succeeded
            "confidence": float|None, # Confidence score (0.0 to 100.0) or None if measurement failed
            "rms": float|None,        # Raw calculated RMS amplitude or None
            "status": str,            # "OK" or "measurement_failed"
            "is_shouting": bool,      # True if RMS exceeds personalized threshold
            "baseline": float|None,   # Measured baseline background RMS
            "calibration_status": str # "calibrating", "calibrated", or "unavailable"
        }
        """
        rms_val = 0.0
        try:
            if os.path.exists(file_path):
                if av is not None:
                    container = av.open(file_path)
                    audio_streams = [s for s in container.streams if s.type == 'audio']
                    if audio_streams:
                        stream = audio_streams[0]
                        # Resample to s16 (16-bit integer) mono to measure amplitude consistently
                        resampler = av.AudioResampler(format='s16', layout='mono')
                        amplitudes = []
                        
                        for frame in container.decode(stream):
                            resampled_frames = resampler.resample(frame)
                            for r_frame in resampled_frames:
                                data = r_frame.to_ndarray()
                                if data.size > 0:
                                    amplitudes.append(data.flatten())
                                    
                        if amplitudes and np is not None:
                            all_samples = np.concatenate(amplitudes)
                            if len(all_samples) > 0:
                                # RMS of the PCM 16-bit signal (values range -32768 to 32767)
                                rms_val = float(np.sqrt(np.mean(all_samples.astype(np.float32) ** 2)))
                                print(f"[TONE CLASSIFIER] Calculated Audio RMS Amplitude: {rms_val:.2f}")
                            else:
                                rms_val = None
                        else:
                            rms_val = None
                    else:
                        rms_val = None
                else:
                    print("[TONE CLASSIFIER] PyAV not available for audio decoding.")
                    rms_val = None
            else:
                rms_val = None
        except Exception as e:
            print(f"[TONE CLASSIFIER] Failed to calculate real audio RMS: {e}")
            rms_val = None

        return self.evaluate_rms(
            rms_val=rms_val,
            distress_flagged=distress_flagged,
            session_id=session_id,
            timestamp=timestamp
        )
