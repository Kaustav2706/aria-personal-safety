import random
from language_support import scan_text_for_distress

class WhisperDetector:
    def __init__(self):
        # Setup mock candidates for demo randomization
        self.distress_candidates = [
            "Help me please! Stop!",
            "Bachao! Mujhse door raho!",
            "Leave me alone, help!",
            "Madad karo! Koi hai?",
            "No, stop it! Don't touch me!"
        ]
        self.safe_candidates = [
            "Hello, I am on my way home now.",
            "Yes, I will reach in about ten minutes.",
            "The weather is quite pleasant tonight.",
            "I'm just walking down the main street."
        ]

    def transcribe_audio(self, file_name: str) -> dict:
        """
        Mock Whisper audio transcription engine.
        Inspects filename parameters to adapt results dynamically for hackathon scripting.
        """
        file_name_lower = file_name.lower()
        
        # Check if the filename explicitly guides the simulator response
        if "distress" in file_name_lower or "sos" in file_name_lower or "bachao" in file_name_lower or "help" in file_name_lower:
            transcript = random.choice(self.distress_candidates)
        elif "safe" in file_name_lower:
            transcript = random.choice(self.safe_candidates)
        else:
            # Random fallback
            transcript = random.choice(self.distress_candidates + self.safe_candidates)

        is_distress = scan_text_for_distress(transcript)
        
        return {
            "transcript": transcript,
            "distress_flagged": is_distress,
            "confidence": round(random.uniform(85.0, 96.0), 2) if is_distress else round(random.uniform(10.0, 30.0), 2)
        }
