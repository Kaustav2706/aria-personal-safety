import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ShieldCheck, Activity, Search, ShieldAlert, Cpu, Check, Compass, Ear, RefreshCw, Mic, MicOff, AlertTriangle, Square } from 'lucide-react';
import { monitoringService } from '../services/api';
import { ChunkAnalysis, BackendIncident } from '../types';

interface MonitoringViewProps {
  onMonitoringChange: (active: boolean) => void;
  onRiskScoreChange: (score: number) => void;
  onIncidentCreated: (incident: BackendIncident) => void;
}

export default function MonitoringView({ onMonitoringChange, onRiskScoreChange, onIncidentCreated }: MonitoringViewProps) {
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // Analysis results from backend
  const [confidence, setConfidence] = useState(0);
  const [riskScore, setRiskScore] = useState(0);
  const [transcript, setTranscript] = useState('Waiting for analysis...');
  const [distressDetected, setDistressDetected] = useState(false);
  const [chunkCount, setChunkCount] = useState(0);

  // Recording state
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  // Refs for cleanup
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // GPS state
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number }>({ lat: 0, lng: 0 });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setGpsCoords({ lat: 37.7749, lng: -122.4194 })
      );
    }
  }, []);

  // ── Start Monitoring ──────────────────────────────────────────────────────
  const handleStart = async () => {
    setError('');
    setIsStarting(true);

    try {
      // 1. Start backend session
      const res = await monitoringService.startSession();
      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to start session.');
      }
      const sid = res.data.sessionId;
      setSessionId(sid);

      // 2. Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 3. Start recording
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();

      // 4. Every 5 seconds: stop, upload chunk, restart
      chunkIntervalRef.current = setInterval(async () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          // Wait for the last dataavailable
          await new Promise<void>((resolve) => {
            mediaRecorderRef.current!.onstop = () => resolve();
          });

          // Upload collected chunks
          if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            chunksRef.current = [];
            await uploadChunk(blob, sid);
          }

          // Restart recording
          if (streamRef.current && streamRef.current.active) {
            mediaRecorderRef.current!.start();
          }
        }
      }, 5000);

      // 5. Duration timer
      setRecordingDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      setIsActive(true);
      onMonitoringChange(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow microphone access.');
      } else {
        setError(err.message || 'Failed to start monitoring.');
      }
    } finally {
      setIsStarting(false);
    }
  };

  // ── Upload Chunk ──────────────────────────────────────────────────────────
  const uploadChunk = async (blob: Blob, sid: string) => {
    setUploading(true);
    try {
      // Get latest GPS
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
        );
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // use existing coords
      }

      const formData = new FormData();
      formData.append('file', blob, `chunk_${Date.now()}.webm`);
      formData.append('latitude', gpsCoords.lat.toString());
      formData.append('longitude', gpsCoords.lng.toString());
      formData.append('isIsolated', 'false');
      formData.append('sessionId', sid);

      const res = await monitoringService.uploadChunk(formData);
      const data = res.data as ChunkAnalysis;

      if (data.success) {
        setConfidence(data.confidence);
        setRiskScore(data.riskScore);
        setTranscript(data.transcript || 'No speech detected.');
        setDistressDetected(data.distress);
        setChunkCount((prev) => prev + 1);
        onRiskScoreChange(data.riskScore);

        // If auto-incident was created
        if (data.autoIncident) {
          onIncidentCreated({
            id: data.autoIncident.incidentId,
            userId: '',
            status: 'active',
            triggerType: data.autoIncident.triggerType,
            latitude: gpsCoords.lat,
            longitude: gpsCoords.lng,
            riskScore: data.autoIncident.riskScore,
            audioTranscript: data.transcript,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch (err: any) {
      console.warn('[MONITORING] Chunk upload failed:', err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Stop Monitoring ───────────────────────────────────────────────────────
  const handleStop = async () => {
    setIsStopping(true);

    // Clear intervals
    if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);

    // Stop MediaRecorder
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Stop backend session
    if (sessionId) {
      try {
        await monitoringService.stopSession(sessionId);
      } catch (err) {
        console.warn('[MONITORING] Failed to stop backend session:', err);
      }
    }

    setIsActive(false);
    setSessionId(null);
    onMonitoringChange(false);
    setIsStopping(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="pt-20 pb-32 px-6 font-sans select-none">
      
      {/* Top Title Section */}
      <header className="mb-6 space-y-1">
        <div className="flex items-center gap-2">
          {/* Pulsing indicator dot */}
          <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-[#72d4ef] animate-pulse'}`} />
          <span className={`font-bold text-xs uppercase tracking-widest ${isActive ? 'text-red-400' : 'text-[#72d4ef]'}`}>
            {isActive ? 'Recording Live' : 'Standby'}
          </span>
        </div>
        <h2 className="text-3xl font-black text-on-surface">System Monitoring</h2>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-error-container/20 border border-error/30 mb-4 animate-in fade-in duration-200">
          <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" />
          <p className="text-xs text-error font-medium leading-relaxed">{error}</p>
        </div>
      )}

      {/* Start / Stop Button */}
      <div className="mb-6">
        {!isActive ? (
          <button
            onClick={handleStart}
            disabled={isStarting}
            className="w-full h-14 bg-secondary-container text-white font-bold text-title-md rounded-2xl shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
          >
            {isStarting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Mic className="w-5 h-5" />
                Start Monitoring
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={isStopping}
            className="w-full h-14 bg-primary-container text-white font-bold text-title-md rounded-2xl shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
          >
            {isStopping ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Square className="w-5 h-5" />
                Stop Monitoring
              </>
            )}
          </button>
        )}
      </div>

      {/* Recording Status Bar */}
      {isActive && (
        <div className="flex items-center justify-between px-4 py-3 glass-card rounded-xl border border-red-500/20 bg-red-500/5 mb-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Recording</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-on-surface-variant">
            <span>{formatDuration(recordingDuration)}</span>
            <span>{chunkCount} chunks</span>
            {uploading && <span className="text-secondary animate-pulse">↑ Uploading...</span>}
          </div>
        </div>
      )}

      {/* Grid container */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* Voice Distress card */}
        <div className="glass-card col-span-2 p-5 rounded-2xl space-y-3 relative overflow-hidden border border-white/5 shadow-md">
          {/* Subtle decoration light glow */}
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#72d4ef]/10 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <Ear className="w-5 h-5 text-[#72d4ef]" />
              <span className="text-[12px] font-bold text-on-surface-variant">Voice Distress Confidence</span>
            </div>
            <span className={`text-xl font-black ${distressDetected ? 'text-primary' : 'text-[#72d4ef]'}`}>
              {confidence}%
            </span>
          </div>

          <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${distressDetected ? 'bg-gradient-to-r from-primary to-red-500' : 'bg-gradient-to-r from-secondary to-tertiary'}`}
              style={{ width: `${Math.min(confidence, 100)}%` }} 
            />
          </div>

          <p className="text-body-sm text-on-surface-variant opacity-80 leading-relaxed font-medium">
            {isActive ? transcript : 'Start monitoring to analyze voice patterns.'}
          </p>

          {/* Distress Alert */}
          {distressDetected && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/25 animate-in fade-in duration-300">
              <AlertTriangle className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Threat Detected</span>
            </div>
          )}
        </div>

        {/* Motion risk block */}
        <div className="glass-card p-4 rounded-2xl flex flex-col justify-between aspect-square border border-white/5">
          <div className="space-y-1">
            <Activity className="w-6 h-6 text-secondary" />
            <h3 className="text-label-md text-on-surface-variant font-bold uppercase tracking-wider">Risk Score</h3>
          </div>
          <div>
            <div className={`text-xl font-bold ${riskScore >= 50 ? 'text-primary' : 'text-secondary'}`}>
              {riskScore}%
            </div>
            <p className="text-[10px] text-on-surface-variant opacity-75 font-semibold uppercase tracking-wider mt-0.5">
              AI Analysis
            </p>
          </div>
        </div>

        {/* Isolation environment block */}
        <div className="glass-card p-4 rounded-2xl flex flex-col justify-between aspect-square border border-white/5">
          <div className="space-y-1">
            <Search className="w-6 h-6 text-tertiary" />
            <h3 className="text-label-md text-on-surface-variant font-bold uppercase tracking-wider">Status</h3>
          </div>
          <div>
            <div className={`text-xl font-bold ${distressDetected ? 'text-primary' : 'text-tertiary'}`}>
              {distressDetected ? 'Alert' : 'Safe'}
            </div>
            <p className="text-[10px] text-on-surface-variant opacity-75 font-semibold uppercase tracking-wider mt-0.5">
              Threat Level
            </p>
          </div>
        </div>

        {/* Risk Trend Curve Container */}
        <div className="glass-card col-span-2 p-5 rounded-2xl space-y-4 border border-white/5 shadow-md">
          <div className="flex justify-between items-center">
            <h3 className="text-[15px] font-black text-on-surface">AI Risk Trend</h3>
            <span className="text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">
              {isActive ? 'Live' : 'Idle'}
            </span>
          </div>

          {/* Styled vector chart path representing risk metric standard line */}
          <div className="relative h-20 w-full pt-2">
            <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#72d4ef" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#72d4ef" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid guide line */}
              <line x1="0" y1="80" x2="400" y2="80" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
              <line x1="0" y1="40" x2="400" y2="40" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
              
              {/* Safety curve path */}
              <path 
                d={`M0,${100 - riskScore} Q50,${100 - riskScore * 0.8} 100,${100 - riskScore * 0.9} T200,${100 - riskScore} T300,${100 - riskScore * 0.85} T400,${100 - riskScore * 0.95}`}
                fill="url(#chartGrad)" 
              />
              <path 
                d={`M0,${100 - riskScore} Q50,${100 - riskScore * 0.8} 100,${100 - riskScore * 0.9} T200,${100 - riskScore} T300,${100 - riskScore * 0.85} T400,${100 - riskScore * 0.95}`}
                fill="none" 
                stroke={distressDetected ? '#ff544c' : '#72d4ef'}
                strokeWidth="3.5" 
              />
              
              {/* Highlight score dot */}
              <circle cx="200" cy={100 - riskScore} r="5" fill={distressDetected ? '#ff544c' : '#72d4ef'} />
              {isActive && (
                <circle cx="200" cy={100 - riskScore} r="10" fill={distressDetected ? '#ff544c' : '#72d4ef'} className="animate-ping opacity-40" />
              )}
            </svg>
          </div>
        </div>

        {/* Sensor Health lists */}
        <div className="col-span-2 space-y-3 pt-2">
          <h3 className="text-label-md font-black text-on-surface-variant uppercase tracking-widest pl-1">
            Sensor Health
          </h3>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3.5 bg-surface-container/40 rounded-xl border border-white/5 shadow-sm transition-transform active:scale-[0.99] duration-150">
              <div className="flex items-center gap-3">
                <Compass className="w-5 h-5 text-on-surface-variant opacity-75 animate-spin" style={{ animationDuration: '8s' }} />
                <span className="font-semibold text-[15px] text-on-surface">GNSS Tracking</span>
              </div>
              <span className="text-[10px] font-black uppercase text-secondary tracking-widest bg-secondary/15 px-3 py-1 rounded-full border border-secondary/20">
                ACTIVE
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-surface-container/40 rounded-xl border border-white/5 shadow-sm transition-transform active:scale-[0.99] duration-150">
              <div className="flex items-center gap-3">
                <Ear className="w-5 h-5 text-on-surface-variant opacity-75" />
                <span className="font-semibold text-[15px] text-on-surface">Biometric Audio</span>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                isActive 
                  ? 'text-red-400 bg-red-500/15 border-red-500/20' 
                  : 'text-secondary bg-secondary/15 border-secondary/20'
              }`}>
                {isActive ? 'RECORDING' : 'IDLE'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-surface-container/40 rounded-xl border border-white/5 shadow-sm transition-transform active:scale-[0.99] duration-150">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-on-surface-variant opacity-75 animate-bounce" style={{ animationDuration: '3s' }} />
                <span className="font-semibold text-[15px] text-on-surface">Cloud Sync</span>
              </div>
              <span className="text-[10px] font-black uppercase text-[#72d4ef] tracking-widest bg-[#72d4ef]/15 px-3 py-1 rounded-full border border-[#72d4ef]/20">
                STABLE
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
