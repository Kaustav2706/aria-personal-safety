import axios from 'axios';

const getAIEngineUrl = () => {
  if (process.env.AI_ENGINE_URL && process.env.AI_ENGINE_URL.trim()) {
    return process.env.AI_ENGINE_URL.trim().replace(/\/$/, '');
  }
  return 'http://localhost:8000';
};

const AI_ENGINE_URL = getAIEngineUrl();
const DEFAULT_AI_TIMEOUT_MS = 30000; // Allows Whisper inference on CPU to complete safely without premature timeouts

// ── Per-user newest-only Request Queue ───────────────────────────────────────
// N26 fix: each user gets at most ONE pending clip in the queue at a time.
// When a new clip arrives for a user whose clip is already waiting, the stale
// clip is dropped (rejected with a sentinel) and replaced by the newer one.
// A hard cap (MAX_QUEUE_SIZE) prevents the shared queue from growing unbounded
// when many users are active simultaneously.
const MAX_QUEUE_SIZE = parseInt(process.env.AI_MAX_QUEUE_SIZE, 10) || 10;

class AIRequestQueue {
  constructor(concurrency = 3) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = []; // [{ userId, task, resolve, reject }]
  }

  enqueue(task, userId = null) {
    return new Promise((resolve, reject) => {
      // If a pending entry for this user already exists, drop the stale one.
      if (userId) {
        const staleIdx = this.queue.findIndex(e => e.userId === userId);
        if (staleIdx !== -1) {
          const stale = this.queue.splice(staleIdx, 1)[0];
          stale.reject(Object.assign(new Error('stale_clip_replaced'), { code: 'STALE_CLIP' }));
          console.warn(`[AI QUEUE] Dropped stale pending clip for user ${userId}; replaced by newer clip.`);
        }
      }

      // Hard cap: if queue is full, reject the incoming task immediately.
      if (this.queue.length >= MAX_QUEUE_SIZE) {
        return reject(Object.assign(new Error('queue_full'), { code: 'QUEUE_FULL' }));
      }

      this.queue.push({ userId, task, resolve, reject });
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
  static async analyzeAudioIncident({ fileBuffer, fileName, latitude, longitude, isIsolated = false, motionAnomaly = false, language = null, timeoutMs = DEFAULT_AI_TIMEOUT_MS, userId = null }) {
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
      , userId);

      return {
        available: true,
        status: res.data.status || 'OK',
        audioStatus: res.data.audio_status || res.data.status || 'OK',
        distress: res.data.distress,
        confidence: res.data.confidence,
        transcript: res.data.transcript,
        riskScore: res.data.risk_score ?? res.data.riskScore ?? 0,
        threatLevel: res.data.threat_level || res.data.threatLevel || 'SAFE'
      };
    } catch (err) {
      if (err.code === 'STALE_CLIP') {
        // This clip was replaced by a newer one from the same user — not an error.
        return {
          available: true,
          distress: false,
          confidence: 0,
          transcript: '',
          riskScore: null,
          message: 'Clip superseded by a newer recording from the same user.'
        };
      }
      if (err.code === 'QUEUE_FULL') {
        console.warn(`[AI SERVICE INTEGRATOR] Queue full — dropping clip ${fileName}`);
        return {
          available: false,
          distress: false,
          confidence: 0,
          transcript: '',
          riskScore: null,
          message: 'AI service queue is full. Clip dropped.'
        };
      }
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
