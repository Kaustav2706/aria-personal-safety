import re

class TranscriptAnalyzer:
    def __init__(self):
        # Critical Phrases (+85 base)
        self.critical_phrases = [
            "leave me alone", "dont touch me", "don't touch me", "call police", "call the police",
            "call 911", "call 100", "let me go", "stop following me", "stay away", "back off",
            "bachao", "madad karo", "chodo mujhe", "mujhe chodo", "door raho", "police ko bulao",
            "get off me", "let go of me", "let go"
        ]
        
        # Warning Phrases (+65 base)
        self.warning_phrases = [
            "help me", "help me please", "somebody help", "i need help", "im in danger", 
            "i am in danger", "i am hurt", "im hurt", "it hurts", "please stop", "stop it",
            "madad", "bachao mujhe", "ruk jao", "mat maro", "koi hai", "help help"
        ]
        
        # Concern Phrases (+35 base)
        self.concern_phrases = [
            "someone is following me", "following me", "i think someone is following",
            "feel unsafe", "im scared", "i am scared", "too dark", "is anyone there",
            "who is that", "creepy", "suspicious", "koi peecha kar raha", "dar lag raha",
            "andhera hai", "sunsan", "scared"
        ]
        
        # Safe Phrases (0-25)
        self.safe_phrases = [
            "walking home", "going home", "on my way", "weather is", "pleasant", "fine",
            "reach in", "hello", "hi", "yes", "i am just walking", "everything is fine",
            "going back", "apartment", "the weather"
        ]
        
        # Aggressive/Threat terms (+15 bonus)
        self.aggressive_terms = [
            "kill", "die", "attack", "hurt", "gun", "knife", "rape", "grab", "force", "steal"
        ]

    def analyze(self, text: str) -> dict:
        if not text:
            return {
                "distress": False,
                "confidence": 10.0,
                "threatLevel": "SAFE"
            }
            
        text_lower = text.lower().strip()
        # Clean punctuation for matching
        clean_text = re.sub(r'[^\w\s]', '', text_lower)
        
        # 1. Match phrases and find highest match level
        matched_level = "SAFE"
        score = 10.0
        
        # Check Critical
        for phrase in self.critical_phrases:
            if phrase in clean_text:
                matched_level = "CRITICAL"
                score = 85.0
                break
                
        # Check Warning if not Critical
        if matched_level != "CRITICAL":
            for phrase in self.warning_phrases:
                if phrase in clean_text:
                    matched_level = "WARNING"
                    score = 65.0
                    break
                    
        # Check Concern if not Warning/Critical
        if matched_level not in ["CRITICAL", "WARNING"]:
            for phrase in self.concern_phrases:
                if phrase in clean_text:
                    matched_level = "CONCERN"
                    score = 35.0
                    break
                    
        # If still SAFE, check if safe keywords are matched to adjust base score
        if matched_level == "SAFE":
            score = 12.0
            
        # 2. Check for Repeated Phrases (+10 bonus)
        words = clean_text.split()
        repeated = False
        for i in range(len(words) - 1):
            if words[i] == words[i+1] and len(words[i]) > 2:
                repeated = True
                break
                
        for word in ["help", "bachao", "stop", "please", "madad"]:
            if clean_text.count(word) >= 2:
                repeated = True
                break
                
        if repeated:
            score += 10.0
            if matched_level == "SAFE":
                matched_level = "CONCERN"
            elif matched_level == "CONCERN":
                matched_level = "WARNING"
            elif matched_level == "WARNING":
                matched_level = "CRITICAL"
                
        # 3. Check for Negative/Aggressive terms (+15 bonus)
        has_aggressive = False
        for term in self.aggressive_terms:
            if term in clean_text:
                has_aggressive = True
                break
                
        if has_aggressive:
            score += 15.0
            if matched_level == "SAFE":
                matched_level = "CONCERN"
            elif matched_level == "CONCERN":
                matched_level = "WARNING"
            elif matched_level == "WARNING":
                matched_level = "CRITICAL"

        # 4. Cap and normalize score based on threatLevel bounds
        if matched_level == "SAFE":
            score = max(0.0, min(25.0, score))
        elif matched_level == "CONCERN":
            score = max(26.0, min(50.0, score))
        elif matched_level == "WARNING":
            score = max(51.0, min(80.0, score))
        elif matched_level == "CRITICAL":
            score = max(81.0, min(100.0, score))
            
        # distress is True if threatLevel is WARNING or CRITICAL
        distress_flag = matched_level in ["WARNING", "CRITICAL"]
        
        return {
            "distress": distress_flag,
            "confidence": round(score, 2),
            "threatLevel": matched_level
        }
