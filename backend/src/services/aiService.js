import axios from 'axios';

const getAIEngineUrl = () => {
  if (process.env.AI_ENGINE_URL && process.env.AI_ENGINE_URL.trim()) {
    return process.env.AI_ENGINE_URL.trim().replace(/\/$/, '');
  }
  return 'http://localhost:8000';
};

const AI_ENGINE_URL = getAIEngineUrl();

export class AIService {
  static async analyzeAudioIncident({ fileBuffer, fileName, latitude, longitude, isIsolated = false, motionAnomaly = false, language = null, timeoutMs = 8000 }) {
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

      const res = await axios.post(`${AI_ENGINE_URL}/analyze`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Internal-Secret': process.env.AI_ENGINE_SECRET
        },
        timeout: timeoutMs
      });

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
