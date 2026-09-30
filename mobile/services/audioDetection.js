import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { session } from '../app/index.jsx';

// Backend URL — mirrors the web app's monitoring chunk upload endpoint.
const BACKEND_URL = 'http://localhost:5000/api';

// How long each audio chunk is before it is uploaded (milliseconds).
// Matches the web app's 5-second cadence.
const CHUNK_DURATION_MS = 5000;

let recordingRef = null;
let chunkTimerRef = null;
let isListening = false;

export const AudioDetection = {
  /**
   * Starts real background audio monitoring.
   * Records a chunk every CHUNK_DURATION_MS, uploads it to the backend
   * AI analysis endpoint, and calls onTriggerDetected if distress is found.
   *
   * @param {(result: { distress: boolean, confidence: number, transcript: string }) => void} onTriggerDetected
   * @param {{ sessionId?: string, latitude?: number, longitude?: number }} options
   */
  async startListening(onTriggerDetected, options = {}) {
    if (isListening) return;
    isListening = true;
    console.log('[AUDIO DETECTOR] Real audio monitoring started.');

    // Request microphone permission
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      console.warn('[AUDIO DETECTOR] Microphone permission denied — cannot start audio monitoring.');
      isListening = false;
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recordAndUpload = async () => {
      if (!isListening) return;

      try {
        // Start a new recording
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef = recording;

        // Record for CHUNK_DURATION_MS then stop and upload
        chunkTimerRef = setTimeout(async () => {
          if (!recordingRef) return;
          try {
            await recordingRef.stopAndUnloadAsync();
            const uri = recordingRef.getURI();
            recordingRef = null;

            if (uri) {
              await this._uploadChunk(uri, onTriggerDetected, options);
            }
          } catch (stopErr) {
            console.warn('[AUDIO DETECTOR] Error stopping recording chunk:', stopErr.message);
          }

          // Loop: record the next chunk
          if (isListening) recordAndUpload();
        }, CHUNK_DURATION_MS);
      } catch (err) {
        console.warn('[AUDIO DETECTOR] Error starting recording:', err.message);
        // Back off 2s before retrying to avoid a tight error loop
        if (isListening) chunkTimerRef = setTimeout(recordAndUpload, 2000);
      }
    };

    recordAndUpload();
  },

  stopListening() {
    isListening = false;
    if (chunkTimerRef) {
      clearTimeout(chunkTimerRef);
      chunkTimerRef = null;
    }
    if (recordingRef) {
      recordingRef.stopAndUnloadAsync().catch(() => {});
      recordingRef = null;
    }
    console.log('[AUDIO DETECTOR] Audio monitoring stopped.');
  },

  /**
   * Uploads a recorded chunk to the backend monitoring endpoint.
   * Mirrors the web app's MonitoringView uploadChunk() logic exactly.
   * @private
   */
  async _uploadChunk(fileUri, onTriggerDetected, options) {
    try {
      const token = session?.token;
      if (!token) {
        console.warn('[AUDIO DETECTOR] No auth token — skipping chunk upload.');
        return;
      }

      const fileName = `chunk_${Date.now()}.m4a`;
      const lat = options.latitude ?? 0;
      const lng = options.longitude ?? 0;
      const locationUnavailable = options.latitude == null;

      const uploadResult = await FileSystem.uploadAsync(
        `${BACKEND_URL}/monitoring/chunk`,
        fileUri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: 'audio/m4a',
          parameters: {
            latitude: String(lat),
            longitude: String(lng),
            location_unavailable: String(locationUnavailable),
            isIsolated: 'false',
            motion_anomaly: String(options.motionAnomaly || false),
            ...(options.sessionId ? { sessionId: options.sessionId } : {}),
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = JSON.parse(uploadResult.body);

      if (data.success && data.distress && onTriggerDetected) {
        console.log(`[AUDIO DETECTOR] Distress confirmed by backend — confidence: ${data.confidence}%`);
        onTriggerDetected({
          distress: true,
          confidence: data.confidence,
          transcript: data.transcript || '',
          autoIncident: data.autoIncident || null,
        });
      }
    } catch (err) {
      console.warn('[AUDIO DETECTOR] Chunk upload failed:', err.message);
    }
  },
};

export default AudioDetection;
