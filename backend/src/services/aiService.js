import axios from 'axios';

const getAIEngineUrl = () => {
  if (process.env.AI_ENGINE_URL && process.env.AI_ENGINE_URL.trim()) {
    return process.env.AI_ENGINE_URL.trim().replace(/\/$/, '');
  }
  return 'http://localhost:8000';
};

const AI_ENGINE_URL = getAIEngineUrl();
const DEFAULT_AI_TIMEOUT_MS = 30000; // Allows Whisper inference on CPU to complete safely without premature timeouts

// ── Burst-absorbing Request Queue ───────────────────────────────────────────
// Queues concurrent requests between backend and AI service to absorb bursts
// instead of letting connections stack under heavy load.
class AIRequestQueue {
  constructor(concurrency = 3) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processNext();
    });
  }

  processNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const { task, resolve, reject } = this.queue.shift();
    this.running++;

    task()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.running--;
        this.processNext();
      });
  }
}

const aiRequestQueue = new AIRequestQueue(parseInt(process.env.AI_CONCURRENCY_LIMIT, 10) || 3);

export class AIService {
  static async analyzeAudioIncident({ fileBuffer, fileName, latitude, longitude, isIsolated = false, motionAnomaly = false, language = null, sessionId = null, timeoutMs = DEFAULT_AI_TIMEOUT_MS }) {
    console.log(`[AI SERVICE INTEGRATOR] Dispatching audio to AI Engine: ${fileName}`);

    try {
      const formData = new FormData();
      const audioBlob = new Blob([fileBuffer], { type: 'audio/wav' });
      formData.append('file', audioBlob, fileName);
      formData.append('latitude', String(latitude || 0.0));
      formData.append('longitude', String(longitude || 0.0));
      formData.append('is_isolated', String(isIsolated));
      formData.append('motion_anomaly', String(motionAnomaly));
      formData.append('timestamp', new Date().toISOString());
      if (language) formData.append('language', language);
      if (sessionId) formData.append('session_id', sessionId);

      const res = await aiRequestQueue.enqueue(() =>
        axios.post(`${AI_ENGINE_URL}/analyze`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'X-Internal-Secret': process.env.AI_ENGINE_SECRET
          },
          timeout: timeoutMs
        })
      );

      return {
        available: true,
        status: res.data.status || 'OK',
        audioStatus: res.data.audio_status || res.data.status || 'OK',
        distress: res.data.distress,
        confidence: res.data.confidence,
        transcript: res.data.transcript,
        riskScore: res.data.risk_score ?? res.data.riskScore ?? 0,
        threatLevel: res.data.threat_level || res.data.threatLevel || 'SAFE',
        baseline: res.data.baseline ?? null,
        calibrationStatus: res.data.calibration_status || 'unavailable'
      };
    } catch (err) {
      console.warn(`[AI SERVICE INTEGRATOR] AI analysis unavailable: ${err.message}`);
      return {
        available: false,
        distress: false,
        confidence: 0,
        transcript: '',
        riskScore: null,
        message: 'AI analysis unavailable. Automatic audio detection is not running.'
      };
    }
  }

  static async resetSession(sessionId) {
    try {
      const formData = new FormData();
      if (sessionId) formData.append('session_id', sessionId);
      await axios.post(`${AI_ENGINE_URL}/session/reset`, formData, {
        headers: {
          ...formData.getHeaders(),
          'X-Internal-Secret': process.env.AI_ENGINE_SECRET
        },
        timeout: 5000
      });
      console.log(`[AI SERVICE INTEGRATOR] Calibration reset for session: ${sessionId || 'all'}`);
    } catch (err) {
      console.warn(`[AI SERVICE INTEGRATOR] Could not reset session calibration: ${err.message}`);
    }
  }

  static async checkHealth() {
    try {
      const response = await axios.get(`${AI_ENGINE_URL}/health`, { timeout: 5000 });
      return { status: response.data?.status === 'ONLINE' ? 'ONLINE' : 'DEGRADED' };
    } catch (err) {
      return { status: 'OFFLINE' };
    }
  }
}

export default AIService;
