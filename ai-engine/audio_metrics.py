from threading import Lock

class AudioPipelineMetrics:
    def __init__(self):
        self._lock = Lock()
        self.total_requests = 0
        self.failed_requests = 0

    def record_success(self):
        with self._lock:
            self.total_requests += 1
            rate = self.get_failure_rate()
            print(f"[AUDIO PIPELINE METRIC] Audio processed successfully. Failure rate: {rate:.1f}% ({self.failed_requests}/{self.total_requests})")

    def record_failure(self, reason: str = "decode_failure"):
        with self._lock:
            self.total_requests += 1
            self.failed_requests += 1
            rate = self.get_failure_rate()
            print(f"[AUDIO PIPELINE METRIC] Audio transcription/decode failed ({reason}). Failure rate: {rate:.1f}% ({self.failed_requests}/{self.total_requests})")
            if rate > 20.0 and self.total_requests >= 5:
                print(f"[AUDIO PIPELINE WARNING] High audio failure rate detected: {rate:.1f}%. Investigate recording codec or client audio pipeline.")

    def get_failure_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return round((self.failed_requests / self.total_requests) * 100.0, 2)

    def get_stats(self) -> dict:
        with self._lock:
            rate = self.get_failure_rate()
            return {
                "total_requests": self.total_requests,
                "failed_requests": self.failed_requests,
                "successful_requests": self.total_requests - self.failed_requests,
                "failure_rate_percent": rate,
                "status": "HEALTHY" if rate < 20.0 or self.total_requests < 5 else "HIGH_FAILURE_RATE"
            }

audio_metrics = AudioPipelineMetrics()
