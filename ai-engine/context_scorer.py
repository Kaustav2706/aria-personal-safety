from datetime import datetime

class ContextScorer:
    def __init__(self):
        pass

    def calculate_risk_score(self, 
                              audio_distress: bool, 
                              is_isolated: bool = False, 
                              has_motion_anomaly: bool = False,
                              timestamp_str: str = None) -> int:
        """
        Calculates cumulative safety risk rating based on weighted factors:
        Voice Distress = 40
        Night Time = 20
        Isolation Score = 20
        Motion Anomaly = 20
        Maximum = 100
        """
        score = 0

        # 1. Voice Distress Check (+40)
        if audio_distress:
            score += 40
            print("[CONTEXT SCORER] Voice distress cues matches (+40 risk points)")

        # 2. Night Time Check (+20)
        # Parse timestamp string or default to current local system time
        hour = None
        if timestamp_str:
            try:
                # Expect ISO-8601 formatting, e.g., "2026-06-12T19:10:25Z"
                dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                hour = dt.hour
            except Exception as e:
                print(f"[CONTEXT SCORER] Timestamp parsing failed ({e}), falling back to local time.")
        
        if hour is None:
            hour = datetime.now().hour
            
        # Night defined as 8 PM (20) to 5 AM (5)
        if hour >= 20 or hour < 5:
            score += 20
            print("[CONTEXT SCORER] Night time condition matches (+20 risk points)")

        # 3. Isolation Area Check (+20)
        if is_isolated:
            score += 20
            print("[CONTEXT SCORER] Isolated area condition matches (+20 risk points)")

        # 4. Motion Anomaly / Fall sensor Check (+20)
        if has_motion_anomaly:
            score += 20
            print("[CONTEXT SCORER] Motion fall sensor anomaly matches (+20 risk points)")

        final_score = min(score, 100)
        print(f"[CONTEXT SCORER] Final calculated risk rating: {final_score}/100")
        
        return final_score
export_scorer = ContextScorer()
