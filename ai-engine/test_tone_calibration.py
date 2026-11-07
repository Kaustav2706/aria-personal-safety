"""
Comprehensive test suite for ARIA AI Engine:
- Personal background noise calibration lifecycle (60s window)
- Robust statistical measure (median) outlier resistance
- Incomplete and missing calibration safety
- Different background level adaptations
- Volume-only severity and incident creation limits (including nighttime)
- Genuine emergency distress escalation preservation
"""

import sys
import types
import unittest
from datetime import datetime

# Provide test doubles for FastAPI types if running in a lightweight test environment
# without modifying or compromising production code in main.py.
if "fastapi" not in sys.modules:
    try:
        import fastapi
    except ImportError:
        fastapi_mock = types.ModuleType("fastapi")
        class MockFastAPI:
            def __init__(self, *args, **kwargs): pass
            def add_middleware(self, *args, **kwargs): pass
            def post(self, *args, **kwargs): return lambda f: f
            def get(self, *args, **kwargs): return lambda f: f
        fastapi_mock.FastAPI = MockFastAPI
        fastapi_mock.UploadFile = type("UploadFile", (), {})
        fastapi_mock.File = lambda default=None: default
        fastapi_mock.Form = lambda default=None: default
        fastapi_mock.Header = lambda default=None: default
        fastapi_mock.Depends = lambda f=None: f
        fastapi_mock.HTTPException = type("HTTPException", (Exception,), {"__init__": lambda self, status_code, detail=None: None})
        sys.modules["fastapi"] = fastapi_mock

        middleware_mock = types.ModuleType("fastapi.middleware.cors")
        middleware_mock.CORSMiddleware = type("CORSMiddleware", (), {})
        sys.modules["fastapi.middleware"] = types.ModuleType("fastapi.middleware")
        sys.modules["fastapi.middleware.cors"] = middleware_mock

        starlette_concurrency = types.ModuleType("starlette.concurrency")
        async def mock_run_in_threadpool(func, *args, **kwargs): return func(*args, **kwargs)
        starlette_concurrency.run_in_threadpool = mock_run_in_threadpool
        sys.modules["starlette"] = types.ModuleType("starlette")
        sys.modules["starlette.concurrency"] = starlette_concurrency

from tone_classifier import ToneClassifier
from context_scorer import ContextScorer
from main import evaluate_incident_analysis, analyze_incident_audio


class MockWhisperResult:
    @staticmethod
    def safe():
        return {
            "available": True,
            "status": "OK",
            "transcript": "just walking back to my apartment",
            "distress_flagged": False,
            "confidence": 12.0,
            "threatLevel": "SAFE",
            "risk_score": 10
        }

    @staticmethod
    def critical_cry():
        return {
            "available": True,
            "status": "OK",
            "transcript": "help me please somebody help",
            "distress_flagged": True,
            "confidence": 88.0,
            "threatLevel": "CRITICAL",
            "risk_score": 88
        }


def simulate_analyze_pipeline(
    tone_classifier: ToneClassifier,
    scorer: ContextScorer,
    rms_val: float,
    whisper_result: dict,
    motion_anomaly: bool = False,
    is_isolated: bool = False,
    timestamp: str = None,
    session_id: str = None
) -> dict:
    """
    Directly exercises the actual production analysis pipeline from ai-engine/main.py.
    """
    tone_result = tone_classifier.evaluate_rms(
        rms_val=rms_val,
        distress_flagged=whisper_result.get("distress_flagged", False),
        session_id=session_id,
        timestamp=timestamp
    )

    analysis = evaluate_incident_analysis(
        whisper_result=whisper_result,
        tone_result=tone_result,
        motion_anomaly=motion_anomaly,
        is_isolated=is_isolated,
        timestamp=timestamp,
        scorer_instance=scorer
    )

    # Backend incident creation trigger condition:
    # (distress === true && confidence >= 60) || riskScore >= 60
    should_trigger_incident = (analysis["distress"] and analysis["confidence"] >= 60) or (analysis["risk_score"] >= 60)

    return {
        **analysis,
        "tone_result": tone_result,
        "should_trigger_incident": should_trigger_incident
    }


class TestToneCalibration(unittest.TestCase):
    def setUp(self):
        self.tone = ToneClassifier()
        self.scorer = ContextScorer()

    # ──────────────────────────────────────────────────────────────────────────
    # 1. Calibration Lifecycle Tests
    # ──────────────────────────────────────────────────────────────────────────

    def test_calibration_lifecycle_window(self):
        """During the first 60 seconds, status is calibrating; after 60s, calibrated."""
        session_id = "test_session_lifecycle"
        base_t = 1700000000.0

        # Samples within first 60 seconds (t = 0s to 50s)
        for offset in [0, 10, 20, 30, 40, 50]:
            iso_ts = datetime.fromtimestamp(base_t + offset).isoformat() + "Z"
            res = self.tone.evaluate_rms(350.0, session_id=session_id, timestamp=iso_ts)
            self.assertEqual(res["calibration_status"], "calibrating")

        # After 60 seconds (t = 65s)
        iso_ts_after = datetime.fromtimestamp(base_t + 65).isoformat() + "Z"
        res_after = self.tone.evaluate_rms(350.0, session_id=session_id, timestamp=iso_ts_after)
        self.assertEqual(res_after["calibration_status"], "calibrated")
        self.assertEqual(res_after["baseline"], 350.0)

    def test_session_reset(self):
        """Resetting a session clears its samples and baseline."""
        session_id = "test_reset_sess"
        self.tone.evaluate_rms(450.0, session_id=session_id)
        self.assertIn(session_id, self.tone.sessions)

        self.tone.reset_session(session_id)
        self.assertNotIn(session_id, self.tone.sessions)
        self.assertIsNone(self.tone.get_baseline(session_id))

    def test_missing_session_id_safe_handling(self):
        """When session_id is None, handles safely without throwing errors."""
        res = self.tone.evaluate_rms(400.0, session_id=None)
        self.assertEqual(res["calibration_status"], "unavailable")
        self.assertIsNone(res["baseline"])
        self.assertEqual(res["threshold"], 1800.0)

    # ──────────────────────────────────────────────────────────────────────────
    # 2. Outlier Resistance During Calibration
    # ──────────────────────────────────────────────────────────────────────────

    def test_sudden_loud_noise_resisted_by_median(self):
        """A sudden loud noise spike during calibration does not inflate ambient baseline."""
        session_id = "test_outlier_rejection"
        base_t = 1700000000.0

        samples = [280.0, 300.0, 310.0, 4200.0, 290.0, 305.0]  # 4200 is car horn/door slam
        for i, val in enumerate(samples):
            iso_ts = datetime.fromtimestamp(base_t + (i * 8)).isoformat() + "Z"
            self.tone.evaluate_rms(val, session_id=session_id, timestamp=iso_ts)

        baseline = self.tone.get_baseline(session_id)
        # Robust filtering and median completely rejected the 4200 spike (yielding ~300)
        # If mean had been used, it would be ~947.
        self.assertAlmostEqual(baseline, 300.0, delta=5.0)
        self.assertLess(baseline, 400.0)

    # ──────────────────────────────────────────────────────────────────────────
    # 3. Incomplete Calibration Safety
    # ──────────────────────────────────────────────────────────────────────────

    def test_incomplete_calibration_uses_conservative_defaults(self):
        """When calibration has only 1 sample or is incomplete, volume alone cannot trigger confirmed distress."""
        session_id = "test_incomplete"
        base_t = 1700000000.0

        # Only one sample collected
        iso_ts = datetime.fromtimestamp(base_t).isoformat() + "Z"
        self.tone.evaluate_rms(300.0, session_id=session_id, timestamp=iso_ts)

        # High volume during incomplete calibration (e.g. t = 15s)
        iso_ts_15 = datetime.fromtimestamp(base_t + 15).isoformat() + "Z"
        analysis = simulate_analyze_pipeline(
            self.tone,
            self.scorer,
            rms_val=3000.0,
            whisper_result=MockWhisperResult.safe(),
            session_id=session_id,
            timestamp=iso_ts_15
        )

        self.assertFalse(analysis["distress"], "Volume alone during incomplete calibration must not be distress")
        self.assertNotEqual(analysis["threat_level"], "CRITICAL")
        self.assertFalse(analysis["should_trigger_incident"], "Incomplete calibration must not trigger an incident")

    # ──────────────────────────────────────────────────────────────────────────
    # 4. Different Background Levels
    # ──────────────────────────────────────────────────────────────────────────

    def test_different_background_levels(self):
        """Noisy ambient environment calibrates higher threshold so ambient noise is not shouting."""
        # Session A: Quiet bedroom (baseline ~250)
        sess_quiet = "sess_quiet"
        base_t = 1700000000.0
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(250.0, session_id=sess_quiet, timestamp=ts)

        # Session B: Busy cafe / noisy street (baseline ~1000)
        sess_noisy = "sess_noisy"
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(1000.0, session_id=sess_noisy, timestamp=ts)

        self.assertAlmostEqual(self.tone.get_baseline(sess_quiet), 250.0, places=1)
        self.assertAlmostEqual(self.tone.get_baseline(sess_noisy), 1000.0, places=1)

        # Evaluation after calibration (> 60s)
        ts_eval = datetime.fromtimestamp(base_t + 70).isoformat() + "Z"

        # In noisy environment, sound at 1400 RMS (normal conversation or cafe clatter)
        res_noisy_ambient = self.tone.evaluate_rms(1400.0, session_id=sess_noisy, timestamp=ts_eval)
        self.assertFalse(res_noisy_ambient["is_shouting"], "Cafe ambient noise (1400) must not be shouting")
        self.assertLess(res_noisy_ambient["confidence"], 50.0)

        # But a real scream at 3500 RMS in the noisy environment IS shouting
        res_noisy_scream = self.tone.evaluate_rms(3500.0, session_id=sess_noisy, timestamp=ts_eval)
        self.assertTrue(res_noisy_scream["is_shouting"], "Scream (3500) above noisy baseline must be shouting")

    # ──────────────────────────────────────────────────────────────────────────
    # 5. Volume-Only Severity & Incident Restrictions
    # ──────────────────────────────────────────────────────────────────────────

    def test_extreme_volume_alone_capped_at_warning(self):
        """Volume alone, even at 5000 RMS, must NEVER produce CRITICAL severity."""
        session_id = "test_vol_alone"
        # Calibrate first
        base_t = 1700000000.0
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(400.0, session_id=session_id, timestamp=ts)

        ts_test = datetime.fromtimestamp(base_t + 70).isoformat() + "Z"
        analysis = simulate_analyze_pipeline(
            self.tone,
            self.scorer,
            rms_val=5000.0,
            whisper_result=MockWhisperResult.safe(),
            session_id=session_id,
            timestamp=ts_test
        )

        self.assertEqual(analysis["threat_level"], "WARNING", "Volume alone must never exceed WARNING")
        self.assertFalse(analysis["distress"], "Volume alone must never set distress=True")
        self.assertLessEqual(analysis["risk_score"], 50, "Volume alone risk score must be <= 50")
        self.assertFalse(analysis["should_trigger_incident"], "Volume alone must NEVER trigger auto-incident")

    # ──────────────────────────────────────────────────────────────────────────
    # 6. Nighttime Loud Noise
    # ──────────────────────────────────────────────────────────────────────────

    def test_loud_noise_during_nighttime(self):
        """Loud environmental noise at 23:30 (night) must not trigger incident or critical severity."""
        session_id = "test_night_noise"
        night_timestamp = "2026-11-07T23:30:00Z"

        analysis = simulate_analyze_pipeline(
            self.tone,
            self.scorer,
            rms_val=4000.0,
            whisper_result=MockWhisperResult.safe(),
            session_id=session_id,
            timestamp=night_timestamp
        )

        self.assertNotEqual(analysis["threat_level"], "CRITICAL", "Night noise alone must not be CRITICAL")
        self.assertLessEqual(analysis["risk_score"], 50, "Night noise alone risk score must not reach 60")
        self.assertFalse(analysis["distress"], "Night noise alone must not be confirmed distress")
        self.assertFalse(analysis["should_trigger_incident"], "Night noise alone must NOT trigger auto-incident")

    # ──────────────────────────────────────────────────────────────────────────
    # 7. Genuine Emergency Escalation Preservation
    # ──────────────────────────────────────────────────────────────────────────

    def test_genuine_distress_with_shouting_escalates_to_critical(self):
        """When shouting is accompanied by distress keywords, severity correctly elevates to CRITICAL."""
        session_id = "test_genuine_distress"
        base_t = 1700000000.0
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(400.0, session_id=session_id, timestamp=ts)

        ts_eval = datetime.fromtimestamp(base_t + 70).isoformat() + "Z"
        analysis = simulate_analyze_pipeline(
            self.tone,
            self.scorer,
            rms_val=3500.0,
            whisper_result=MockWhisperResult.critical_cry(),  # "help me please somebody help"
            session_id=session_id,
            timestamp=ts_eval
        )

        self.assertEqual(analysis["threat_level"], "CRITICAL", "Genuine distress + shouting must reach CRITICAL")
        self.assertTrue(analysis["distress"], "Genuine distress must set distress=True")
        self.assertGreaterEqual(analysis["risk_score"], 85, "Risk score must reach critical range (>= 85%)")
        self.assertTrue(analysis["should_trigger_incident"], "Genuine emergency MUST trigger incident creation")

    def test_loud_environmental_noise_with_motion_anomaly_does_not_trigger_emergency(self):
        """
        Loud environmental noise (e.g. traffic, thunder, door slam at 3500 RMS) combined
        with motion anomaly (jogging/movement) without validated distress speech MUST NOT
        trigger confirmed distress or automatic incident creation.
        """
        session_id = "test_env_noise_motion"
        base_t = 1700000000.0
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(400.0, session_id=session_id, timestamp=ts)

        ts_eval = datetime.fromtimestamp(base_t + 70).isoformat() + "Z"
        analysis = simulate_analyze_pipeline(
            self.tone,
            self.scorer,
            rms_val=3500.0,
            whisper_result=MockWhisperResult.safe(),
            motion_anomaly=True,
            session_id=session_id,
            timestamp=ts_eval
        )

        self.assertFalse(analysis["distress"], "Environmental noise + motion anomaly must NOT be confirmed distress")
        self.assertLessEqual(analysis["risk_score"], 50, "Score must remain capped at <= 50%")
        self.assertFalse(analysis["should_trigger_incident"], "Environmental noise + motion MUST NOT trigger incident")

    def test_direct_production_main_evaluate_incident_analysis(self):
        """Verifies calling production evaluate_incident_analysis in main.py directly."""
        whisper_safe = MockWhisperResult.safe()
        tone_loud = {
            "measured": True,
            "confidence": 95.0,
            "rms": 5000.0,
            "status": "OK",
            "is_shouting": True,
            "baseline": 400.0,
            "calibration_status": "calibrated"
        }
        res = evaluate_incident_analysis(
            whisper_result=whisper_safe,
            tone_result=tone_loud,
            motion_anomaly=False,
            is_isolated=False,
            timestamp="2026-11-07T23:30:00Z",
            scorer_instance=self.scorer
        )
        self.assertFalse(res["distress"], "Volume alone must not be distress")
        self.assertEqual(res["threatLevel"], "WARNING", "Volume alone must be capped at WARNING")
        self.assertLessEqual(res["riskScore"], 50, "Volume alone risk score must be <= 50")

    def test_sustained_loud_noise_and_screams_during_calibration_does_not_suppress_distress(self):
        """
        Verifies that sustained loud ambient noise or screams during the first 60s
        calibration window do not corrupt the baseline or suppress genuine distress.
        """
        session_id = "sess_sustained_loud"
        base_t = 1700000000.0

        # Simulate 6 chunks during calibration:
        # First 3 chunks: very loud ambient environment (2200 RMS)
        # Next 3 chunks: user screams "help me please" (4000 RMS, distress_flagged=True)
        for i in range(3):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(2200.0, distress_flagged=False, session_id=session_id, timestamp=ts)

        for i in range(3, 6):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(4000.0, distress_flagged=True, session_id=session_id, timestamp=ts)

        # Baseline must NOT be inflated to 4000 (distress screams must be excluded)
        # and must be capped at MAX_CALIBRATED_BASELINE (1200.0)
        baseline = self.tone.get_baseline(session_id)
        self.assertIsNotNone(baseline)
        self.assertLessEqual(baseline, 1200.0, "Baseline must never exceed MAX_CALIBRATED_BASELINE (1200)")

        # Now test post-calibration distress detection at T=70s:
        # User screams "help me" (distress keywords + shouting at 3800 RMS)
        ts_eval = datetime.fromtimestamp(base_t + 70).isoformat() + "Z"
        res = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=3800.0,
            whisper_result=MockWhisperResult.critical_cry(),
            motion_anomaly=False,
            is_isolated=False,
            timestamp=ts_eval,
            session_id=session_id
        )

        self.assertTrue(res["distress"], "Genuine distress must be detected")
        self.assertEqual(res["threat_level"], "CRITICAL", "Threat level must escalate to CRITICAL")
        self.assertGreaterEqual(res["risk_score"], 85, "Risk score must be >= 85%")

    def test_sustained_background_noise_at_1800_2200_and_2500_rms(self):
        """
        Tests sustained environmental noise at 1800, 2200, and 2500 RMS.
        Verifies:
        1. Ambient baseline is capped and samples > 2000 are not accepted into baseline.
        2. Sustained high-volume ambient noise alone NEVER creates an automatic incident.
        """
        base_t = 1700000000.0
        test_noise_levels = [1800.0, 2200.0, 2500.0]

        for noise_rms in test_noise_levels:
            session_id = f"sess_sustained_noise_{int(noise_rms)}"
            # Calibrate over 7 chunks with steady environmental noise
            for i in range(7):
                ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
                self.tone.evaluate_rms(noise_rms, session_id=session_id, timestamp=ts)

            baseline = self.tone.get_baseline(session_id)
            if noise_rms <= 2000.0:
                self.assertLessEqual(baseline, 1200.0, f"Baseline for {noise_rms} RMS must be capped at 1200")
            else:
                # For 2200 and 2500 RMS, samples exceeding MAX_AMBIENT_SAMPLE_RMS (2000) are not stored
                self.assertLessEqual(baseline or 400.0, 1200.0)

            # Evaluate continued sustained noise at night (23:30)
            eval_ts = "2026-11-07T23:30:00Z"
            analysis = simulate_analyze_pipeline(
                tone_classifier=self.tone,
                scorer=self.scorer,
                rms_val=noise_rms,
                whisper_result=MockWhisperResult.safe(),
                motion_anomaly=False,
                is_isolated=False,
                timestamp=eval_ts,
                session_id=session_id
            )

            # Volume alone MUST NEVER trigger an incident
            self.assertFalse(analysis["distress"], f"Sustained noise at {noise_rms} RMS must not be distress")
            self.assertNotEqual(analysis["threat_level"], "CRITICAL", f"Sustained noise at {noise_rms} RMS must not be CRITICAL")
            self.assertLessEqual(analysis["risk_score"], 50, f"Sustained noise at {noise_rms} RMS risk score must be <= 50")
            self.assertFalse(analysis["should_trigger_incident"], f"Sustained noise at {noise_rms} RMS must not trigger auto-incident")

    def test_genuine_shouting_at_2500_3000_3500_and_4000_rms(self):
        """
        Tests genuine shouting across multiple volume levels: 2500, 3000, 3500, and 4000 RMS.
        Verifies:
        1. Shouting threshold never exceeds MAX_SHOUTING_THRESHOLD (2400 RMS).
        2. Shouting at all levels (2500 to 4000 RMS) is properly classified as shouting.
        3. When accompanied by distress keywords, genuine shouting creates an emergency incident.
        """
        session_id = "sess_shout_levels"
        base_t = 1700000000.0
        # Calibrate in a moderately loud environment (800 RMS)
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(800.0, session_id=session_id, timestamp=ts)

        shout_levels = [2500.0, 3000.0, 3500.0, 4000.0]
        ts_eval = datetime.fromtimestamp(base_t + 70).isoformat() + "Z"

        for shout_rms in shout_levels:
            # Acoustic measurement alone
            eval_res = self.tone.evaluate_rms(shout_rms, session_id=session_id, timestamp=ts_eval)
            self.assertTrue(eval_res["is_shouting"], f"Shout at {shout_rms} RMS must be classified as shouting")
            self.assertGreaterEqual(eval_res["confidence"], 75.0, f"Confidence for {shout_rms} RMS shout must be >= 75%")

            # When accompanied by linguistic distress keywords
            full_analysis = simulate_analyze_pipeline(
                tone_classifier=self.tone,
                scorer=self.scorer,
                rms_val=shout_rms,
                whisper_result=MockWhisperResult.critical_cry(),
                motion_anomaly=False,
                is_isolated=False,
                timestamp=ts_eval,
                session_id=session_id
            )
            self.assertTrue(full_analysis["distress"], f"Shout at {shout_rms} with keywords must be distress")
            self.assertEqual(full_analysis["threat_level"], "CRITICAL", f"Shout at {shout_rms} with keywords must be CRITICAL")
            self.assertGreaterEqual(full_analysis["risk_score"], 85, f"Risk score for {shout_rms} must be >= 85%")
            self.assertTrue(full_analysis["should_trigger_incident"], f"Incident must trigger for {shout_rms} shout with keywords")

    def test_motion_anomaly_calm_audio_daytime(self):
        """
        Scenario 1: Motion anomaly + calm audio during daytime.
        Must NEVER create an automatic incident or elevate threat level.
        """
        session_id = "sess_motion_day"
        base_t = 1700000000.0
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(400.0, session_id=session_id, timestamp=ts)

        analysis = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=400.0,
            whisper_result=MockWhisperResult.safe(),
            motion_anomaly=True,
            is_isolated=False,
            timestamp="2026-11-07T14:00:00Z",  # Daytime (14:00)
            session_id=session_id
        )

        self.assertFalse(analysis["distress"], "Motion anomaly alone in daytime must NOT be confirmed distress")
        self.assertEqual(analysis["threat_level"], "SAFE", "Threat level must remain SAFE")
        self.assertLessEqual(analysis["risk_score"], 50, "Risk score must be capped at <= 50%")
        self.assertFalse(analysis["should_trigger_incident"], "Motion anomaly alone in daytime MUST NOT trigger incident")

    def test_motion_anomaly_calm_audio_night(self):
        """
        Scenario 2: Motion anomaly + calm audio at night.
        Must NEVER create an automatic incident even with night context.
        """
        session_id = "sess_motion_night"
        base_t = 1700000000.0
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(400.0, session_id=session_id, timestamp=ts)

        analysis = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=400.0,
            whisper_result=MockWhisperResult.safe(),
            motion_anomaly=True,
            is_isolated=False,
            timestamp="2026-11-07T23:30:00Z",  # Nighttime (23:30)
            session_id=session_id
        )

        self.assertFalse(analysis["distress"], "Motion anomaly alone at night must NOT be confirmed distress")
        self.assertEqual(analysis["threat_level"], "SAFE", "Threat level must remain SAFE at night")
        self.assertLessEqual(analysis["risk_score"], 50, "Risk score must be capped at <= 50%")
        self.assertFalse(analysis["should_trigger_incident"], "Motion anomaly alone at night MUST NOT trigger incident")

    def test_motion_anomaly_calm_audio_isolated(self):
        """
        Scenario 3: Motion anomaly + calm audio while isolated.
        Must NEVER create an automatic incident even in isolated areas.
        """
        session_id = "sess_motion_iso"
        base_t = 1700000000.0
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(400.0, session_id=session_id, timestamp=ts)

        analysis = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=400.0,
            whisper_result=MockWhisperResult.safe(),
            motion_anomaly=True,
            is_isolated=True,  # Isolated
            timestamp="2026-11-07T14:00:00Z",  # Daytime
            session_id=session_id
        )

        self.assertFalse(analysis["distress"], "Motion anomaly alone while isolated must NOT be confirmed distress")
        self.assertEqual(analysis["threat_level"], "SAFE", "Threat level must remain SAFE while isolated")
        self.assertLessEqual(analysis["risk_score"], 50, "Risk score must be capped at <= 50%")
        self.assertFalse(analysis["should_trigger_incident"], "Motion anomaly alone while isolated MUST NOT trigger incident")

    def test_motion_anomaly_calm_audio_high_contextual_risk_night_and_isolated(self):
        """
        Scenario 4: Motion anomaly + calm audio with high contextual risk (night + isolated).
        Must NEVER create an automatic incident even under combined high-risk context.
        """
        session_id = "sess_motion_high_ctx"
        base_t = 1700000000.0
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(400.0, session_id=session_id, timestamp=ts)

        analysis = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=400.0,
            whisper_result=MockWhisperResult.safe(),
            motion_anomaly=True,
            is_isolated=True,  # Isolated
            timestamp="2026-11-07T23:30:00Z",  # Nighttime
            session_id=session_id
        )

        self.assertFalse(analysis["distress"], "Motion anomaly alone in high context risk must NOT be confirmed distress")
        self.assertEqual(analysis["threat_level"], "SAFE", "Threat level must remain SAFE in high context risk")
        self.assertLessEqual(analysis["risk_score"], 50, "Risk score must be capped at <= 50%")
        self.assertFalse(analysis["should_trigger_incident"], "Motion anomaly alone under high contextual risk MUST NOT trigger incident")

    def test_motion_anomaly_safety_invariant_with_deliberately_high_contextual_risk(self):
        """
        Safety Invariant Test:
        Motion anomaly without independently validated distress must NEVER create an automatic
        monitoring incident, even if the ContextScorer raw calculation produces a deliberately high score (e.g. 88%).
        The safety cap MUST override and clamp risk_score <= 50% and distress = False.
        """
        # Create a stub ContextScorer that deliberately attempts to return 88%
        class HighRiskStubScorer:
            def calculate_risk_score(self, **kwargs):
                return 88

        stub_scorer = HighRiskStubScorer()

        analysis = evaluate_incident_analysis(
            whisper_result=MockWhisperResult.safe(),  # No validated distress
            tone_result={"measured": True, "confidence": 85.0, "rms": 3500.0, "status": "OK"},
            motion_anomaly=True,  # Motion anomaly + loud noise
            is_isolated=True,     # Isolated area
            timestamp="2026-11-07T23:30:00Z",  # Nighttime
            scorer_instance=stub_scorer
        )

        should_trigger = (analysis["distress"] and analysis["confidence"] >= 60) or (analysis["risk_score"] >= 60)

        self.assertFalse(analysis["distress"], "Unvalidated distress must NEVER produce confirmed distress")
        self.assertNotEqual(analysis["threat_level"], "CRITICAL", "Threat level must not be CRITICAL without speech distress")
        self.assertEqual(analysis["risk_score"], 50, "Risk score must be strictly capped from 88% down to 50%")
        self.assertFalse(should_trigger, "Automatic incident must NEVER trigger without validated distress, regardless of context score")

    def test_loud_environmental_noise_with_motion_anomaly_daytime(self):
        """
        Regression Test: Loud environmental noise (3500 RMS) + motion anomaly during daytime.
        Must NEVER create an automatic incident or confirm distress.
        """
        session_id = "sess_env_motion_day"
        base_t = 1700000000.0
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(400.0, session_id=session_id, timestamp=ts)

        ts_eval = datetime.fromtimestamp(base_t + 70).isoformat() + "Z"
        analysis = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=3500.0,  # Loud noise (e.g. truck, construction)
            whisper_result=MockWhisperResult.safe(),
            motion_anomaly=True,  # Motion anomaly
            is_isolated=False,
            timestamp="2026-11-07T14:00:00Z",
            session_id=session_id
        )

        self.assertFalse(analysis["distress"], "Environmental noise + motion anomaly must NOT be confirmed distress")
        self.assertNotEqual(analysis["threat_level"], "CRITICAL", "Threat level cannot be CRITICAL for environmental noise")
        self.assertLessEqual(analysis["risk_score"], 50, "Risk score must remain capped at <= 50%")
        self.assertFalse(analysis["should_trigger_incident"], "Environmental noise + motion MUST NOT trigger incident")

    def test_loud_environmental_noise_with_motion_anomaly_at_night(self):
        """
        Regression Test: Loud environmental noise (3500 RMS) + motion anomaly at night (23:30).
        Must NEVER create an automatic incident even with nighttime penalty.
        """
        session_id = "sess_env_motion_night"
        base_t = 1700000000.0
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(400.0, session_id=session_id, timestamp=ts)

        analysis = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=3500.0,  # Loud noise (e.g. thunder, slammed door)
            whisper_result=MockWhisperResult.safe(),
            motion_anomaly=True,
            is_isolated=False,
            timestamp="2026-11-07T23:30:00Z",  # Nighttime
            session_id=session_id
        )

        self.assertFalse(analysis["distress"], "Environmental noise + motion at night must NOT be confirmed distress")
        self.assertNotEqual(analysis["threat_level"], "CRITICAL", "Threat level cannot be CRITICAL")
        self.assertLessEqual(analysis["risk_score"], 50, "Risk score must remain capped at <= 50%")
        self.assertFalse(analysis["should_trigger_incident"], "Environmental noise + motion at night MUST NOT trigger incident")

    def test_loud_environmental_noise_with_motion_anomaly_isolated(self):
        """
        Regression Test: Loud environmental noise (3500 RMS) + motion anomaly while isolated.
        Must NEVER create an automatic incident even with isolation penalty.
        """
        session_id = "sess_env_motion_iso"
        base_t = 1700000000.0
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(400.0, session_id=session_id, timestamp=ts)

        analysis = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=3500.0,  # Loud noise
            whisper_result=MockWhisperResult.safe(),
            motion_anomaly=True,
            is_isolated=True,  # Isolated
            timestamp="2026-11-07T14:00:00Z",
            session_id=session_id
        )

        self.assertFalse(analysis["distress"], "Environmental noise + motion while isolated must NOT be confirmed distress")
        self.assertNotEqual(analysis["threat_level"], "CRITICAL", "Threat level cannot be CRITICAL")
        self.assertLessEqual(analysis["risk_score"], 50, "Risk score must remain capped at <= 50%")
        self.assertFalse(analysis["should_trigger_incident"], "Environmental noise + motion while isolated MUST NOT trigger incident")

    def test_loud_environmental_noise_with_motion_anomaly_high_context_risk(self):
        """
        Regression Test: Loud environmental noise (3500 RMS) + motion anomaly with high contextual risk (night + isolated).
        Must NEVER create an automatic incident even under combined high-risk context.
        """
        session_id = "sess_env_motion_high_ctx"
        base_t = 1700000000.0
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(400.0, session_id=session_id, timestamp=ts)

        analysis = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=3500.0,  # Loud noise
            whisper_result=MockWhisperResult.safe(),
            motion_anomaly=True,
            is_isolated=True,  # Isolated
            timestamp="2026-11-07T23:30:00Z",  # Nighttime
            session_id=session_id
        )

        self.assertFalse(analysis["distress"], "Environmental noise + motion under high context risk must NOT be confirmed distress")
        self.assertNotEqual(analysis["threat_level"], "CRITICAL", "Threat level cannot be CRITICAL")
        self.assertLessEqual(analysis["risk_score"], 50, "Risk score must remain capped at <= 50%")
        self.assertFalse(analysis["should_trigger_incident"], "Environmental noise + motion under high context risk MUST NOT trigger incident")

    def test_motion_anomaly_with_genuine_shouting_escalates(self):
        """
        Scenario 5: Motion anomaly + genuine shouting (validated distress keywords + shouting volume).
        Motion anomaly amplifies acoustic and linguistic distress and MUST escalate to CRITICAL emergency alert.
        """
        session_id = "sess_motion_shouting_emergency"
        base_t = 1700000000.0
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(400.0, session_id=session_id, timestamp=ts)

        ts_eval = datetime.fromtimestamp(base_t + 70).isoformat() + "Z"
        analysis = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=3500.0,  # Genuine shouting volume
            whisper_result=MockWhisperResult.critical_cry(),  # "help me please somebody help" (validated distress)
            motion_anomaly=True,  # Motion anomaly + genuine shouting
            is_isolated=False,
            timestamp=ts_eval,
            session_id=session_id
        )

        self.assertTrue(analysis["distress"], "Motion anomaly + genuine shouting MUST be confirmed distress")
        self.assertEqual(analysis["threat_level"], "CRITICAL", "Threat level must elevate to CRITICAL")
        self.assertGreaterEqual(analysis["risk_score"], 85, "Risk score must reach >= 85%")
        self.assertTrue(analysis["should_trigger_incident"], "Motion anomaly + genuine shouting MUST trigger automatic incident")

    def test_motion_anomaly_with_distress_keywords_escalates(self):
        """
        Scenario 6: Motion anomaly + distress keywords.
        Motion anomaly amplifies linguistic distress and MUST escalate to CRITICAL emergency alert.
        """
        session_id = "sess_motion_keywords"
        base_t = 1700000000.0
        for i in range(7):
            ts = datetime.fromtimestamp(base_t + (i * 10)).isoformat() + "Z"
            self.tone.evaluate_rms(400.0, session_id=session_id, timestamp=ts)

        ts_eval = datetime.fromtimestamp(base_t + 70).isoformat() + "Z"
        analysis = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=600.0,  # Normal vocal volume with distress keywords
            whisper_result=MockWhisperResult.critical_cry(),  # "help me please somebody help"
            motion_anomaly=True,  # Motion anomaly + distress keywords
            is_isolated=False,
            timestamp=ts_eval,
            session_id=session_id
        )

        self.assertTrue(analysis["distress"], "Motion anomaly + distress keywords MUST be confirmed distress")
        self.assertEqual(analysis["threat_level"], "CRITICAL", "Threat level must be CRITICAL")
        self.assertGreaterEqual(analysis["risk_score"], 85, "Risk score must be >= 85%")
        self.assertTrue(analysis["should_trigger_incident"], "Motion anomaly + distress keywords MUST trigger automatic incident")

    def test_production_endpoint_delegation(self):
        """
        Verifies that the production analyze_incident_audio endpoint in main.py
        delegates directly to evaluate_incident_analysis().
        """
        import inspect
        import main
        source = inspect.getsource(main.analyze_incident_audio)
        self.assertIn("evaluate_incident_analysis", source, "analyze_incident_audio must delegate to evaluate_incident_analysis")

    # ──────────────────────────────────────────────────────────────────────────
    # 7. Explicit Protection vs Independently Validated Signals Tests
    # ──────────────────────────────────────────────────────────────────────────

    def test_explicit_unsafe_combination_loudness_alone(self):
        """Unsafe combination 1: Loudness alone (high acoustic RMS without motion or distress)."""
        res = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=3500.0,
            whisper_result=MockWhisperResult.safe(),
            motion_anomaly=False,
            is_isolated=False,
            timestamp="2026-11-07T23:30:00Z"
        )
        self.assertFalse(res["distress"], "Loudness alone must NOT be confirmed distress")
        self.assertLessEqual(res["risk_score"], 50, "Loudness alone risk score must be <= 50")
        self.assertFalse(res["should_trigger_incident"], "Loudness alone must not trigger auto-incident")

    def test_explicit_unsafe_combination_motion_anomaly_alone(self):
        """Unsafe combination 2: Motion anomaly alone under high contextual risk."""
        res = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=300.0,
            whisper_result=MockWhisperResult.safe(),
            motion_anomaly=True,
            is_isolated=True,
            timestamp="2026-11-07T23:30:00Z"
        )
        self.assertFalse(res["distress"], "Motion anomaly alone must NOT be confirmed distress")
        self.assertLessEqual(res["risk_score"], 50, "Motion anomaly alone risk score must be <= 50")
        self.assertFalse(res["should_trigger_incident"], "Motion anomaly alone must not trigger auto-incident")

    def test_explicit_unsafe_combination_loudness_and_motion(self):
        """Unsafe combination 3: Loudness + motion anomaly without distress speech."""
        res = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=3500.0,
            whisper_result=MockWhisperResult.safe(),
            motion_anomaly=True,
            is_isolated=True,
            timestamp="2026-11-07T23:30:00Z"
        )
        self.assertFalse(res["distress"], "Loudness + motion must NOT be confirmed distress")
        self.assertLessEqual(res["risk_score"], 50, "Loudness + motion risk score must be <= 50")
        self.assertFalse(res["should_trigger_incident"], "Loudness + motion must not trigger auto-incident")

    def test_explicit_unsafe_combination_contextual_risk_alone(self):
        """Unsafe combination 4: Contextual risk alone (night + isolation without audio/motion distress)."""
        res = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=300.0,
            whisper_result=MockWhisperResult.safe(),
            motion_anomaly=False,
            is_isolated=True,
            timestamp="2026-11-07T23:30:00Z"
        )
        self.assertFalse(res["distress"], "Context alone must NOT be confirmed distress")
        self.assertLessEqual(res["risk_score"], 50, "Context alone risk score must be <= 50")
        self.assertFalse(res["should_trigger_incident"], "Context alone must not trigger auto-incident")

    def test_independently_validated_speech_distress_keywords_not_suppressed(self):
        """Independently validated distress keywords MUST NOT be capped at 50."""
        res = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=500.0,
            whisper_result=MockWhisperResult.critical_cry(),
            motion_anomaly=False,
            is_isolated=False,
            timestamp="2026-11-07T14:00:00Z"
        )
        self.assertTrue(res["distress"], "Distress keywords must confirm distress")
        self.assertGreaterEqual(res["risk_score"], 80, "Distress keywords risk score must not be suppressed")
        self.assertTrue(res["should_trigger_incident"], "Distress keywords must trigger auto-incident")

    def test_independently_validated_speech_threat_warning_not_suppressed(self):
        """Independently validated speech threatLevel WARNING MUST NOT be capped at 50."""
        res = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=500.0,
            whisper_result={
                "status": "OK",
                "available": True,
                "transcript": "i am hurt stop please",
                "distress_flagged": True,
                "confidence": 75.0,
                "threatLevel": "WARNING"
            },
            motion_anomaly=False,
            is_isolated=False,
            timestamp="2026-11-07T14:00:00Z"
        )
        self.assertTrue(res["distress"], "Validated WARNING threat must confirm distress")
        self.assertGreaterEqual(res["risk_score"], 60, "Validated WARNING threat risk score must be >= 60")
        self.assertTrue(res["should_trigger_incident"], "Validated WARNING threat must trigger auto-incident")

    def test_arbitrary_client_flags_ignored_and_cannot_bypass_safety_cap(self):
        """
        Verifies that arbitrary flags (e.g. 'emergency', 'sos') cannot bypass the safety cap.
        Only genuine model detection outputs (whisper_flag or raw_whisper_threat) are trusted.
        """
        res = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=3500.0,  # Loud noise
            whisper_result={
                "status": "OK",
                "available": True,
                "transcript": "hello",  # Safe speech
                "distress_flagged": False,
                "confidence": 10.0,
                "threatLevel": "SAFE",
                "emergency": True,  # Arbitrary untrusted flag
                "sos": True         # Arbitrary untrusted flag
            },
            motion_anomaly=False,
            is_isolated=False,
            timestamp="2026-11-07T23:30:00Z"
        )
        self.assertFalse(res["distress"], "Untrusted arbitrary flags must NOT confirm distress")
        self.assertLessEqual(res["risk_score"], 50, "Untrusted arbitrary flags must NOT bypass 50% cap")
        self.assertFalse(res["should_trigger_incident"], "Untrusted arbitrary flags must NOT trigger auto-incident")

    def test_independently_validated_speech_threat_critical_not_suppressed(self):
        """Independently validated speech threatLevel CRITICAL MUST NOT be capped at 50."""
        res = simulate_analyze_pipeline(
            tone_classifier=self.tone,
            scorer=self.scorer,
            rms_val=500.0,
            whisper_result={
                "status": "OK",
                "available": True,
                "transcript": "call the police",
                "distress_flagged": True,
                "confidence": 88.0,
                "threatLevel": "CRITICAL"
            },
            motion_anomaly=False,
            is_isolated=False,
            timestamp="2026-11-07T14:00:00Z"
        )
        self.assertTrue(res["distress"], "Validated CRITICAL threat must confirm distress")
        self.assertGreaterEqual(res["risk_score"], 80, "Validated CRITICAL threat risk score must be >= 80")
        self.assertTrue(res["should_trigger_incident"], "Validated CRITICAL threat must trigger auto-incident")


if __name__ == "__main__":
    unittest.main()
