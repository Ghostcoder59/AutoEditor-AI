import whisper
import os
import torch

class TranscriptionEngine:
    def __init__(self, model_name="tiny"):
        """
        Initializes the Whisper model. 'tiny' or 'base' are recommended for speed.
        """
        device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = whisper.load_model(model_name, device=device)
        self.cached_segments = []
        
        # High-energy sports terms to look for
        self.excitement_keywords = [
            "goal", "score", "incredible", "unbelievable", "amazing", 
            "what a hit", "touchdown", "home run", "winner", "shocker", "omg"
        ]

    def load_full_transcription(self, audio_path):
        """
        Transcribes the entire video once and caches segments for fast lookup.
        """
        try:
            print(f"[Turbo] Pre-transcribing full audio: {audio_path}")
            result = self.model.transcribe(audio_path, fp16=False)
            self.cached_segments = result.get("segments", [])
            print(f"[Turbo] Cached {len(self.cached_segments)} transcription segments.")
        except Exception as e:
            print(f"Full transcription error: {e}")
            self.cached_segments = []

    def analyze_segment(self, start_time, end_time):
        """
        Queries cached segments to find text within the 2-second window.
        """
        if not self.cached_segments:
            return {"text": "", "score": 0, "words_found": []}

        try:
            # Find all segments that overlap with [start_time, end_time]
            overlapping_text = []
            for seg in self.cached_segments:
                s_start = seg.get("start", 0)
                s_end = seg.get("end", 0)
                
                # Overlap check
                if s_start < end_time and s_end > start_time:
                    overlapping_text.append(seg.get("text", "").strip())
            
            text = " ".join(overlapping_text).lower()
            
            # Count occurrences of keywords
            count = 0
            for word in self.excitement_keywords:
                if word in text:
                    count += 1
            
            score = min(1.0, count / 2.0) if count > 0 else 0
            
            return {
                "text": text,
                "score": score,
                "words_found": [w for w in self.excitement_keywords if w in text]
            }
        except Exception as e:
            print(f"Transcription lookup error: {e}")
            return {"text": "", "score": 0, "words_found": []}
