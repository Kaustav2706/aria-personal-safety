import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ShieldCheck, Activity, Search, ShieldAlert, Cpu, Check, Compass, Ear, RefreshCw, Mic, MicOff, AlertTriangle, Square } from 'lucide-react';
import { monitoringService } from '../services/api';
import { ChunkAnalysis, BackendIncident } from '../types';

interface MonitoringViewProps {
  onMonitoringChange: (active: boolean) => void;
  onRiskScoreChange: (score: number) => void;
  onIncidentCreated: (incident: BackendIncident) => void;
  onTriggerSOS: () => void;
}

export default function MonitoringView({ 
  onMonitoringChange, 
  onRiskScoreChange, 
  onIncidentCreated,
  onTriggerSOS
}: MonitoringViewProps) {
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

  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastBackendConfidenceRef = useRef<number>(15);

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

      // Web Audio API setup for live voice level tracking
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const updateVolume = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteTimeDomainData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
          }
          const rms = Math.sqrt(sum / bufferLength);
          
          // Boost and map volume level (up to 85%)
          const liveVoiceLevel = Math.min(Math.round(rms * 400), 85);
          
          // Display live level relative to last backend response with peak-hold/slow-decay smoothing
          setConfidence((prev) => {
            const target = Math.min(lastBackendConfidenceRef.current + liveVoiceLevel, 100);
            if (target > prev) {
              return Math.round(prev * 0.5 + target * 0.5); // Rise relatively quickly
            } else {
              return Math.round(prev * 0.95 + target * 0.05); // Decay slowly to prevent flickering
            }
          });
          
          animationFrameRef.current = requestAnimationFrame(updateVolume);
        };
        
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      } catch (audioErr) {
        console.warn('[MONITORING] Web Audio API setup failed:', audioErr);
      }

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
        lastBackendConfidenceRef.current = data.confidence;
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

    // Stop volume tracking
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (err) {
        console.warn('[MONITORING] Failed to close audio context:', err);
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    lastBackendConfidenceRef.current = 15;
    setConfidence(0);

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
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (e) {}
      }
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
      <header className="mb-6 space-y-1.5 animate-slide-up">
        <div className="flex items-center gap-2">
          {/* Pulsing indicator dot */}
          <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.5)]' : 'bg-tertiary animate-pulse shadow-[0_0_6px_rgba(114,212,239,0.4)]'}`} />
          <span className={`font-bold text-[11px] uppercase tracking-[0.12em] ${isActive ? 'text-red-400' : 'text-tertiary'}`}>
            {isActive ? 'Recording Live' : 'Standby'}
          </span>
        </div>
        <h2 className="text-[28px] font-black text-on-surface tracking-tight">System Monitoring</h2>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-error-container/15 border border-error/20 mb-4 animate-slide-up">
          <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" />
          <p className="text-xs text-error/90 font-medium leading-relaxed">{error}</p>
        </div>
      )}

      {/* Start / Stop Button */}
      <div className="mb-6">
        {!isActive ? (
          <button
            onClick={handleStart}
            disabled={isStarting}
            className="w-full h-14 bg-gradient-to-r from-secondary-container to-[#2578d1] text-white font-bold text-[15px] rounded-2xl shadow-[0_4px_20px_rgba(51,148,241,0.25)] hover:shadow-[0_6px_28px_rgba(51,148,241,0.35)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 relative overflow-hidden"
          >
            <div className="absolute inset-0 shimmer" />
            {isStarting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Mic className="w-5 h-5 relative z-10" />
                <span className="relative z-10">Start Monitoring</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={isStopping}
            className="w-full h-14 bg-gradient-to-r from-primary-container to-[#c41a1f] text-white font-bold text-[15px] rounded-2xl shadow-[0_4px_20px_rgba(255,84,76,0.25)] hover:shadow-[0_6px_28px_rgba(255,84,76,0.35)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 relative overflow-hidden"
          >
            <div className="absolute inset-0 shimmer" />
            {isStopping ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Square className="w-5 h-5 relative z-10" />
                <span className="relative z-10">Stop Monitoring</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Recording Status Bar */}
      {isActive && (
        <div className="flex items-center justify-between px-4 py-3 glass-card rounded-xl mb-4 animate-slide-up" style={{ borderColor: 'rgba(239,68,68,0.12)' }}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
            <span className="text-[11px] font-bold text-red-400 uppercase tracking-[0.1em]">Recording</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-on-surface-variant/60">
            <span>{formatDuration(recordingDuration)}</span>
            <span>{chunkCount} chunks</span>
            {uploading && <span className="text-secondary animate-pulse">↑ Uploading...</span>}
          </div>
        </div>
      )}

      {/* Grid container */}
      <div className="grid grid-cols-2 gap-3.5">
        
        {/* Voice Distress card */}
        <div className="glass-card col-span-2 p-5 rounded-2xl space-y-3 relative overflow-hidden gradient-border shadow-md">
          {/* Subtle decoration light glow */}
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-tertiary/[0.08] rounded-full blur-[40px] pointer-events-none animate-glow-pulse" />
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5 text-on-surface-variant">
              <div className="w-8 h-8 rounded-lg bg-tertiary/[0.08] flex items-center justify-center">
                <Ear className="w-4 h-4 text-tertiary" />
              </div>
              <span className="text-[12px] font-bold text-on-surface-variant/80">Voice Distress Confidence</span>
            </div>
            <div className="flex items-center gap-3">
              {isActive && (
                <button
                  type="button"
                  onClick={() => {
                    lastBackendConfidenceRef.current = 75;
                    setConfidence(75);
                    setDistressDetected(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-tertiary/[0.08] hover:bg-tertiary/[0.15] border border-tertiary/15 text-[9px] uppercase tracking-[0.1em] font-extrabold text-tertiary transition-colors cursor-pointer"
                >
                  Test &gt;50%
                </button>
              )}
              <span className={`text-xl font-black ${distressDetected ? 'text-primary' : 'text-tertiary'}`}>
                {confidence}%
              </span>
            </div>
          </div>

          <div className="h-2 w-full bg-surface-container/60 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 relative ${distressDetected ? 'bg-gradient-to-r from-primary to-red-500' : 'bg-gradient-to-r from-secondary to-tertiary'}`}
              style={{ width: `${Math.min(confidence, 100)}%` }} 
            >
              {/* Glowing edge */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/40 blur-[3px]" />
            </div>
          </div>

          <p className="text-[13px] text-on-surface-variant/60 leading-relaxed font-medium">
            {isActive ? transcript : 'Start monitoring to analyze voice patterns.'}
          </p>

          {/* Distress Alert */}
          {distressDetected && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/[0.08] border border-primary/20 animate-slide-up">
              <AlertTriangle className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-xs font-bold text-primary uppercase tracking-[0.1em]">Threat Detected</span>
            </div>
          )}

          {/* Conditional SOS Trigger when Voice Distress Confidence exceeds 50% */}
          {confidence > 50 && (
            <div className="pt-3 border-t border-white/[0.06] animate-slide-up">
              <button
                onClick={onTriggerSOS}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs uppercase tracking-[0.12em] rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer relative overflow-hidden shadow-[0_0_20px_rgba(220,38,38,0.35)]"
              >
                <div className="absolute inset-0 shimmer" />
                <ShieldAlert className="w-4.5 h-4.5 animate-bounce relative z-10" />
                <span className="relative z-10">Flag SOS Emergency</span>
              </button>
            </div>
          )}
        </div>

        {/* Motion risk block */}
        <div className="glass-card p-4 rounded-2xl flex flex-col justify-between aspect-square gradient-border hover-lift">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-lg bg-secondary/[0.08] flex items-center justify-center">
              <Activity className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-[0.1em]">Risk Score</h3>
          </div>
          <div>
            <div className={`text-2xl font-black ${riskScore >= 50 ? 'text-primary' : 'text-secondary'}`}>
              {riskScore}%
            </div>
            <p className="text-[10px] text-on-surface-variant/40 font-semibold uppercase tracking-[0.1em] mt-0.5">
              AI Analysis
            </p>
          </div>
        </div>

        {/* Isolation environment block */}
        <div className="glass-card p-4 rounded-2xl flex flex-col justify-between aspect-square gradient-border hover-lift">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-lg bg-tertiary/[0.08] flex items-center justify-center">
              <Search className="w-5 h-5 text-tertiary" />
            </div>
            <h3 className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-[0.1em]">Status</h3>
          </div>
          <div>
            <div className={`text-2xl font-black ${distressDetected ? 'text-primary' : 'text-tertiary'}`}>
              {distressDetected ? 'Alert' : 'Safe'}
            </div>
            <p className="text-[10px] text-on-surface-variant/40 font-semibold uppercase tracking-[0.1em] mt-0.5">
              Threat Level
            </p>
          </div>
        </div>

        {/* Risk Trend Curve Container */}
        <div className="glass-card col-span-2 p-5 rounded-2xl space-y-4 gradient-border shadow-md">
          <div className="flex justify-between items-center">
            <h3 className="text-[15px] font-black text-on-surface">AI Risk Trend</h3>
            <span className={`text-[9px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full border ${
              isActive 
                ? 'text-red-400 bg-red-500/[0.08] border-red-500/15' 
                : 'text-on-surface-variant/50 bg-surface-container/60 border-white/[0.06]'
            }`}>
              {isActive ? 'Live' : 'Idle'}
            </span>
          </div>

          {/* Styled vector chart path representing risk metric standard line */}
          <div className="relative h-20 w-full pt-2">
            <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradMonitor" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={distressDetected ? '#ff544c' : '#72d4ef'} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={distressDetected ? '#ff544c' : '#72d4ef'} stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid guide lines */}
              <line x1="0" y1="80" x2="400" y2="80" stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
              <line x1="0" y1="40" x2="400" y2="40" stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
              
              {/* Area fill */}
              <path 
                d={`M0,${100 - riskScore} Q50,${100 - riskScore * 0.8} 100,${100 - riskScore * 0.9} T200,${100 - riskScore} T300,${100 - riskScore * 0.85} T400,${100 - riskScore * 0.95} L400,100 L0,100 Z`}
                fill="url(#chartGradMonitor)" 
              />
              {/* Line */}
              <path 
                d={`M0,${100 - riskScore} Q50,${100 - riskScore * 0.8} 100,${100 - riskScore * 0.9} T200,${100 - riskScore} T300,${100 - riskScore * 0.85} T400,${100 - riskScore * 0.95}`}
                fill="none" 
                stroke={distressDetected ? '#ff544c' : '#72d4ef'}
                strokeWidth="2.5" 
                strokeLinecap="round"
              />
              
              {/* Highlight score dot */}
              <circle cx="200" cy={100 - riskScore} r="4" fill={distressDetected ? '#ff544c' : '#72d4ef'} />
              {isActive && (
                <circle cx="200" cy={100 - riskScore} r="8" fill={distressDetected ? '#ff544c' : '#72d4ef'} className="animate-ping opacity-30" />
              )}
            </svg>
          </div>
        </div>

        {/* Sensor Health lists */}
        <div className="col-span-2 space-y-3 pt-2">
          <h3 className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-[0.12em] pl-1">
            Sensor Health
          </h3>
          
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-3.5 glass-card rounded-xl hover-lift">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary/[0.08] flex items-center justify-center">
                  <Compass className="w-4.5 h-4.5 text-secondary/80 animate-spin" style={{ animationDuration: '8s' }} />
                </div>
                <span className="font-semibold text-[14px] text-on-surface">GNSS Tracking</span>
              </div>
              <span className="text-[9px] font-black uppercase text-secondary tracking-[0.1em] bg-secondary/[0.08] px-3 py-1.5 rounded-full border border-secondary/15">
                ACTIVE
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 glass-card rounded-xl hover-lift">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/[0.06] flex items-center justify-center">
                  <Ear className="w-4.5 h-4.5 text-on-surface-variant/60" />
                </div>
                <span className="font-semibold text-[14px] text-on-surface">Biometric Audio</span>
              </div>
              <span className={`text-[9px] font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-full border ${
                isActive 
                  ? 'text-red-400 bg-red-500/[0.08] border-red-500/15' 
                  : 'text-secondary bg-secondary/[0.08] border-secondary/15'
              }`}>
                {isActive ? 'RECORDING' : 'IDLE'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 glass-card rounded-xl hover-lift">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-tertiary/[0.08] flex items-center justify-center">
                  <RefreshCw className="w-4.5 h-4.5 text-tertiary/80 animate-bounce" style={{ animationDuration: '3s' }} />
                </div>
                <span className="font-semibold text-[14px] text-on-surface">Cloud Sync</span>
              </div>
              <span className="text-[9px] font-black uppercase text-tertiary tracking-[0.1em] bg-tertiary/[0.08] px-3 py-1.5 rounded-full border border-tertiary/15">
                STABLE
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
