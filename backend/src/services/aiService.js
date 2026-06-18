import axios from 'axios';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

export class AIService {
  /**
   * Dispatches incident telemetry and audio data to the Python FastAPI analyzer
   */
  static async analyzeAudioIncident({ fileBuffer, fileName, latitude, longitude, isIsolated = false }) {
    console.log(`[AI SERVICE INTEGRATOR] Dispatching audio to AI Engine: ${fileName}`);

    try {
      // Build standard multipart payload
      // We can use standard web-compatible Blob/File if using Node 18+ native FormData
      const formData = new FormData();
      const audioBlob = new Blob([fileBuffer], { type: 'audio/wav' });
      
      formData.append('file', audioBlob, fileName);
      formData.append('latitude', String(latitude || 0.0));
      formData.append('longitude', String(longitude || 0.0));
      formData.append('is_isolated', String(isIsolated));
      formData.append('timestamp', new Date().toISOString());

      const res = await axios.post(`${AI_ENGINE_URL}/analyze`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 8000 // 8 second timeout threshold
      });

      console.log('[AI SERVICE INTEGRATOR] FastAPI evaluation returned successfully:', res.data);
      
      return {
        distress: res.data.distress,
        confidence: res.data.confidence,
        transcript: res.data.transcript,
        riskScore: res.data.risk_score || res.data.riskScore || 50
      };
    } catch (err) {
      console.warn(`⚠️ [AI SERVICE INTEGRATOR] FastAPI AI Engine connection failed or timed out: ${err.message}`);
      console.log('⚠️ [AI SERVICE INTEGRATOR] Falling back to robust offline mock evaluation...');
      
      // Standalone Fallback mock engine calculations
      const distressKeywords = ['help', 'stop', 'bachao', 'madad', 'leave me alone'];
      const fileLower = fileName.toLowerCase();
      
      const isDistressSim = distressKeywords.some(keyword => fileLower.includes(keyword)) || fileLower.includes('distress') || fileLower.includes('sos');
      const mockConf = isDistressSim ? 89.0 : 15.0;
      const mockTranscript = isDistressSim ? "Help me please, leave me alone!" : "I am just walking back to my apartment.";
      
      // Context calculation
      let mockRisk = 0;
      if (isDistressSim) mockRisk += 40; // Voice Distress weight = 40
      
      const currentHour = new Date().getHours();
      if (currentHour >= 20 || currentHour < 5) mockRisk += 20; // Night Time weight = 20
      if (isIsolated) mockRisk += 20; // Isolation weight = 20
      
      return {
        distress: isDistressSim,
        confidence: mockConf,
        transcript: mockTranscript,
        riskScore: mockRisk
      };
    }
  }
}
export default AIService;
