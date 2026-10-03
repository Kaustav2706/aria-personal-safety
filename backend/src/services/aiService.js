import axios from 'axios';

const getAIEngineUrl = () => {
  if (process.env.AI_ENGINE_URL && process.env.AI_ENGINE_URL.trim()) {
    return process.env.AI_ENGINE_URL.trim().replace(/\/$/, '');
  }
  return 'http://localhost:8000';
};

const AI_ENGINE_URL = getAIEngineUrl();
const DEFAULT_AI_TIMEOUT_MS = 4000; // Shorter than the 5-second chunk interval to prevent connection pileups

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
  static async analyzeAudioIncident({ fileBuffer, fileName, latitude, longitude, isIsolated = false, motionAnomaly = false, language = null, timeoutMs = DEFAULT_AI_TIMEOUT_MS }) {
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
        distress: res.data.distress,
        confidence: res.data.confidence,
        transcript: res.data.transcript,
        riskScore: res.data.risk_score ?? res.data.riskScore ?? 50
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
