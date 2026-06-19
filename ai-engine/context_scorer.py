import re
from datetime import datetime

class ContextScorer:
    def __init__(self):
        self.threat_mapping = {
            "SAFE": 0.0,
            "CONCERN": 25.0,
            "WARNING": 60.0,
            "CRITICAL": 100.0
        }
        self.weapon_violence_terms = [
            "knife", "gun", "attack", "kill", "kidnap", "rape"
        ]
        self.escalation_words = [
            "help", "bachao", "stop", "please", "madad"
        ]

    def calculate_risk_score(self, 
                              audio_distress: bool, 
                              is_isolated: bool = False, 
                              has_motion_anomaly: bool = False,
                              timestamp_str: str = None,
                              distress_confidence: float = None,
                              threat_level: str = None,
                              transcript: str = "") -> int:
        """
        Calculates safety risk rating using an intelligent weighted system:
        - Distress Confidence: 50%
        - Threat Level: 20%
        - Isolation: 10%
        - Night Time: 5%
        - Motion Risk: 10%
        - Repetition / Escalation: 5%
        
        Calibrates the final raw score into expected target ranges:
        - SAFE: 0 - 20
        - CONCERN: 30 - 50
        - WARNING: 55 - 75
        - CRITICAL: 80 - 95
        - CRITICAL + Weapon/Escalation: 95 - 100
        """
        # 1. Handle legacy/fallback inputs
        if threat_level is None:
            threat_level = "WARNING" if audio_distress else "SAFE"
        threat_level = threat_level.upper().strip()
        
        if distress_confidence is None:
            distress_confidence = 75.0 if audio_distress else 10.0
            
        # 2. Check Night Time (5%)
        hour = None
        if timestamp_str:
            try:
                dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                hour = dt.hour
            except Exception as e:
                print(f"[CONTEXT SCORER] Timestamp parsing failed ({e}), falling back to local time.")
        
        if hour is None:
            hour = datetime.now().hour
            
        is_night = (hour >= 20 or hour < 5)

        # 3. Escalation / Repetition Checks (5%)
        has_escalation = False
        text_lower = (transcript or "").lower().strip()
        clean_text = re.sub(r'[^\w\s]', '', text_lower)
        
        # A. Check repeated distress phrases
        words = clean_text.split()
        repeated = False
        for i in range(len(words) - 1):
            if words[i] == words[i+1] and len(words[i]) > 2:
                repeated = True
                break
        for word in self.escalation_words:
            if clean_text.count(word) >= 2:
                repeated = True
                break
        if repeated:
            has_escalation = True
            print("[CONTEXT SCORER] Repeated distress phrases detected (+escalation)")

        # B. Check weapon or violence terms
        has_weapon_violence = False
        for term in self.weapon_violence_terms:
            if term in clean_text:
                has_weapon_violence = True
                break
        if has_weapon_violence:
            has_escalation = True
            print("[CONTEXT SCORER] Weapon / violence terms detected (+escalation)")

        # C. Check multiple monitoring alerts
        if is_isolated and has_motion_anomaly:
            has_escalation = True
            print("[CONTEXT SCORER] Multiple monitoring alerts detected (+escalation)")

        # 4. Compute Weighted Score contributions
        conf_contrib = distress_confidence * 0.50
        
        threat_base = self.threat_mapping.get(threat_level, 0.0)
        threat_contrib = threat_base * 0.20
        
        isolation_contrib = 10.0 if is_isolated else 0.0
        night_contrib = 5.0 if is_night else 0.0
        motion_contrib = 10.0 if has_motion_anomaly else 0.0
        escalation_contrib = 5.0 if has_escalation else 0.0

        raw_weighted_score = (
            conf_contrib +
            threat_contrib +
            isolation_contrib +
            night_contrib +
            motion_contrib +
            escalation_contrib
        )
        
        print(f"[CONTEXT SCORER] Raw components - Conf: {conf_contrib:.2f}, Threat: {threat_contrib:.2f}, "
              f"Iso: {isolation_contrib:.2f}, Night: {night_contrib:.2f}, Motion: {motion_contrib:.2f}, Esc: {escalation_contrib:.2f}")
        print(f"[CONTEXT SCORER] Raw Weighted Score: {raw_weighted_score:.2f}")

        # 5. Target Range Calibration Mapping
        # Clamp ranges strictly based on target bounds
        if threat_level == "SAFE":
            min_target, max_target = 0.0, 20.0
            min_raw, max_raw = 0.0, 42.5
            final_score = raw_weighted_score * (max_target / max_raw) if max_raw > 0 else 0.0
            
        elif threat_level == "CONCERN":
            min_target, max_target = 30.0, 50.0
            min_raw, max_raw = 18.0, 60.0
            if raw_weighted_score <= min_raw:
                final_score = min_target
            elif raw_weighted_score >= max_raw:
                final_score = max_target
            else:
                final_score = min_target + (raw_weighted_score - min_raw) * (max_target - min_target) / (max_raw - min_raw)
                
        elif threat_level == "WARNING":
            min_target, max_target = 55.0, 75.0
            min_raw, max_raw = 37.5, 90.0
            if raw_weighted_score <= min_raw:
                final_score = min_target
            elif raw_weighted_score >= max_raw:
                final_score = max_target
            else:
                final_score = min_target + (raw_weighted_score - min_raw) * (max_target - min_target) / (max_raw - min_raw)
                
        else: # CRITICAL
            if has_escalation:
                min_target, max_target = 95.0, 100.0
                min_raw, max_raw = 65.5, 100.0
            else:
                min_target, max_target = 80.0, 95.0
                min_raw, max_raw = 60.5, 95.0
                
            if raw_weighted_score <= min_raw:
                final_score = min_target
            elif raw_weighted_score >= max_raw:
                final_score = max_target
            else:
                final_score = min_target + (raw_weighted_score - min_raw) * (max_target - min_target) / (max_raw - min_raw)

        # Enforce bounds clamping
        final_score = max(min_target, min(max_target, final_score))
        rounded_score = int(round(final_score))
        
        print(f"[CONTEXT SCORER] Calibrated Risk Score: {rounded_score}/100 (Target bounds: {min_target}-{max_target}%)")
        return rounded_score

export_scorer = ContextScorer()
