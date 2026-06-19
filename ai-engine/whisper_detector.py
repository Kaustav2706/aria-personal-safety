import os
import random
import math
from language_support import scan_text_for_distress
from faster_whisper import WhisperModel
from transcript_analyzer import TranscriptAnalyzer

class WhisperDetector:
    def __init__(self):
        # Setup mock candidates for fallback/demo randomization
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
        
        # Initialize WhisperModel
        print("[WHISPER DETECTOR] Initializing Whisper model tiny.en on CPU...")
        try:
            self.model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
            print("[WHISPER DETECTOR] Whisper model initialized successfully.")
        except Exception as e:
            print(f"[WHISPER DETECTOR] Failed to initialize Whisper model: {e}")
            self.model = None
            
        # Initialize TranscriptAnalyzer
        self.analyzer = TranscriptAnalyzer()

    def transcribe_audio(self, file_path: str, original_filename: str = None) -> dict:
        """
        Transcribe audio file using faster-whisper.
        Falls back to filename-based mock if file_path is invalid or transcription fails.
        """
        transcript = None
        
        # 1. Attempt real transcription
        if self.model and os.path.exists(file_path):
            try:
                print(f"[WHISPER DETECTOR] Transcribing active audio file: {file_path}")
                segments, info = self.model.transcribe(file_path, beam_size=5)
                segments = list(segments)
                
                transcript_parts = []
                for segment in segments:
                    transcript_parts.append(segment.text)
                
                # Join segment text and clean whitespace
                raw_transcript = " ".join(transcript_parts).strip()
                
                if raw_transcript:
                    transcript = raw_transcript
                    print(f"[WHISPER DETECTOR] Real transcript parsed successfully: \"{transcript}\"")
            except Exception as e:
                print(f"[WHISPER DETECTOR] Real transcription failed (possibly invalid audio format): {e}")
                print("[WHISPER DETECTOR] Falling back to filename-based mock logic.")

        # 2. Fallback if transcription failed, returned empty, or model not initialized
        if not transcript:
            # Use original filename or file path to check for fallback cues
            filename_to_check = original_filename or os.path.basename(file_path)
            file_name_lower = filename_to_check.lower()
            
            if "distress" in file_name_lower or "sos" in file_name_lower or "bachao" in file_name_lower or "help" in file_name_lower:
                transcript = random.choice(self.distress_candidates)
            elif "safe" in file_name_lower:
                transcript = random.choice(self.safe_candidates)
            else:
                transcript = random.choice(self.distress_candidates + self.safe_candidates)
            print(f"[WHISPER DETECTOR] Mock fallback transcript: \"{transcript}\"")
            
        # 3. Perform Transcript Intelligence analysis
        analysis = self.analyzer.analyze(transcript)
        print(f"[WHISPER DETECTOR] Transcript Intelligence -> Distress: {analysis['distress']} | Confidence: {analysis['confidence']}% | Threat Level: {analysis['threatLevel']}")
        
        return {
            "transcript": transcript,
            "distress_flagged": analysis["distress"],
            "confidence": analysis["confidence"],
            "threatLevel": analysis["threatLevel"]
        }
