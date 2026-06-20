import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Phone, CheckCircle, ShieldAlert, X, Mic, MicOff } from 'lucide-react';

interface ActiveSOSProps {
  onCancelSOS: () => void;
  primaryContactName: string;
  incidentId: string | null;
  riskScore: number;
  transcript: string;
}

export default function ActiveSOSView({ onCancelSOS, primaryContactName, incidentId, riskScore, transcript }: ActiveSOSProps) {
  const [timelineIndex, setTimelineIndex] = useState(1);
  const [waveHeights, setWaveHeights] = useState([12, 32, 48, 24, 40, 16, 36, 44, 20]);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState(false);

  // Audio analysis refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const smoothedRmsRef = useRef<number>(0);

  // ── Real-time microphone voice analysis ─────────────────────────────────
  // Captures microphone audio, computes RMS amplitude, and maps it to a
  // risk score: shouting/loud → 70-99, normal speech → 30-60, quiet → 5-25
  const startMicAnalysis = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      setMicActive(true);
      setMicError(false);

      const timeDomainData = new Uint8Array(analyser.fftSize);
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);

      const analyze = () => {
        if (!analyserRef.current) return;

        // Get time-domain data for RMS calculation
        analyserRef.current.getByteTimeDomainData(timeDomainData);
        // Get frequency data for wave visualization
        analyserRef.current.getByteFrequencyData(frequencyData);

        // Calculate RMS amplitude (0.0 to 1.0 scale)
        let sum = 0;
        for (let i = 0; i < timeDomainData.length; i++) {
          const val = (timeDomainData[i] - 128) / 128;
          sum += val * val;
        }
        const rawRms = Math.sqrt(sum / timeDomainData.length);

        // Smooth RMS to avoid jitter (exponential moving average)
        const alpha = rawRms > smoothedRmsRef.current ? 0.4 : 0.08; // Rise fast, decay slow
        smoothedRmsRef.current = smoothedRmsRef.current * (1 - alpha) + rawRms * alpha;
        const rms = smoothedRmsRef.current;

        // ── Map RMS to risk score ──────────────────────────────────────
        // Typical mic RMS values:
        //   Silence:          0.00 - 0.01
        //   Quiet/breathing:  0.01 - 0.03
        //   Normal speech:    0.03 - 0.12
        //   Loud speech:      0.12 - 0.25
        //   Shouting:         0.25 - 0.50+
        let computedScore: number;
        if (rms < 0.01) {
          // Silence / ambient noise → very low risk
          computedScore = Math.round(5 + rms * 500); // 5-10
        } else if (rms < 0.04) {
          // Quiet speech → low risk
          computedScore = Math.round(10 + ((rms - 0.01) / 0.03) * 20); // 10-30
        } else if (rms < 0.12) {
          // Normal conversation → moderate risk
          computedScore = Math.round(30 + ((rms - 0.04) / 0.08) * 25); // 30-55
        } else if (rms < 0.25) {
          // Loud voice → elevated risk
          computedScore = Math.round(55 + ((rms - 0.12) / 0.13) * 20); // 55-75
        } else {
          // Shouting / screaming → high risk
          const clampedRms = Math.min(rms, 0.6);
          computedScore = Math.round(75 + ((clampedRms - 0.25) / 0.35) * 24); // 75-99
        }
        computedScore = Math.max(1, Math.min(99, computedScore));

        setLiveRiskScore(computedScore);

        // ── Drive wave bars from real frequency data ───────────────────
        // Sample 9 frequency bins spread across the spectrum
        const binCount = analyserRef.current.frequencyBinCount;
        const step = Math.floor(binCount / 9);
        const newWaves: number[] = [];
        for (let i = 0; i < 9; i++) {
          const binIndex = Math.min(i * step + Math.floor(step / 2), binCount - 1);
          // Map 0-255 frequency amplitude to 6-64px bar height
          const raw = frequencyData[binIndex];
          const height = Math.max(6, Math.round((raw / 255) * 64));
          newWaves.push(height);
        }
        setWaveHeights(newWaves);

        animationFrameRef.current = requestAnimationFrame(analyze);
      };

      animationFrameRef.current = requestAnimationFrame(analyze);
    } catch (err) {
      console.warn('[ACTIVE_SOS] Microphone access failed:', err);
      setMicError(true);
      setMicActive(false);
    }
  }, []);

  const stopMicAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    smoothedRmsRef.current = 0;
    setMicActive(false);
  }, []);

  // Auto-start mic analysis on mount
  useEffect(() => {
    startMicAnalysis();
    return () => stopMicAnalysis();
  }, [startMicAnalysis, stopMicAnalysis]);

  // Fallback: if mic fails, use prop-based random oscillation like before
  useEffect(() => {
    if (micActive) return; // Real mic is active, skip fallback

    const waveInterval = setInterval(() => {
      setWaveHeights([
        Math.floor(Math.random() * 32) + 8,
        Math.floor(Math.random() * 54) + 12,
        Math.floor(Math.random() * 64) + 16,
        Math.floor(Math.random() * 40) + 10,
        Math.floor(Math.random() * 56) + 14,
        Math.floor(Math.random() * 24) + 6,
        Math.floor(Math.random() * 48) + 12,
        Math.floor(Math.random() * 60) + 16,
        Math.floor(Math.random() * 28) + 8,
      ]);
    }, 150);

    return () => clearInterval(waveInterval);
  }, [micActive]);

  // Slowly roll out timeline items representing automated cloud updates
  useEffect(() => {
    const timer = setInterval(() => {
      setTimelineIndex((prev) => (prev < 4 ? prev + 1 : 4));
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const [liveRiskScore, setLiveRiskScore] = useState(riskScore || 15);

  // Fallback: if mic is not active, oscillate around the prop riskScore
  useEffect(() => {
    if (micActive) return;

    const interval = setInterval(() => {
      setLiveRiskScore((prev) => {
        const base = riskScore || 80;
        const delta = Math.floor(Math.random() * 5) - 2;
        const nextScore = prev + delta;
        if (Math.abs(nextScore - base) > 4) {
          return base + (delta > 0 ? 1 : -1);
        }
        return Math.max(1, Math.min(100, nextScore));
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [riskScore, micActive]);

  const displayId = incidentId ? incidentId.slice(-6).toUpperCase() : 'PENDING';
  const scorePercent = (liveRiskScore / 100) * 565;

  // Dynamic color: low scores get a calmer color, high scores get intense red
  const scoreColor = liveRiskScore >= 70 ? 'text-red-500' : liveRiskScore >= 40 ? 'text-primary' : 'text-orange-400';

  return (
    <div className="fixed inset-0 z-50 bg-[#1e0f0e] text-on-background flex flex-col font-sans select-none overflow-y-auto no-scrollbar">
      
      {/* Heavy Red ambient pulsing flash behind the screen — intensity scales with risk */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
        style={{ 
          backgroundColor: `rgba(105, 0, 6, ${Math.min(0.05 + (liveRiskScore / 100) * 0.25, 0.30)})`,
          animation: liveRiskScore >= 60 ? 'pulse 1.5s ease-in-out infinite' : 'pulse 3s ease-in-out infinite'
        }}
      />

      {/* Top Incident Header */}
      <header className="fixed top-0 left-0 right-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#1e0f0e]/50 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-3.5 h-3.5 bg-primary rounded-full animate-ping" />
            <span className="relative w-3.5 h-3.5 bg-primary rounded-full" />
          </div>
          <span className="text-xl font-black text-primary tracking-tight">SOS ACTIVE</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mic status indicator */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full border ${micActive ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            {micActive ? (
              <Mic className="w-3 h-3 text-green-400" />
            ) : (
              <MicOff className="w-3 h-3 text-red-400" />
            )}
            <span className={`text-[9px] font-bold uppercase tracking-wider ${micActive ? 'text-green-400' : 'text-red-400'}`}>
              {micActive ? 'LIVE' : 'OFF'}
            </span>
          </div>
          <div className="bg-primary/20 px-3 py-1 rounded-full border border-primary/30">
            <span className="text-xs font-black text-primary tracking-wider font-mono">#{displayId}</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mt-16 px-6 pt-6 pb-36 flex flex-col items-center">
        
        {/* Risk Score Circle Gauge */}
        <section className="relative w-60 h-64 flex items-center justify-center mb-4 shrink-0">
          <div 
            className="absolute inset-0 blur-[50px] rounded-full transition-all duration-700"
            style={{ backgroundColor: liveRiskScore >= 70 ? 'rgba(239, 68, 68, 0.15)' : liveRiskScore >= 40 ? 'rgba(255, 84, 76, 0.12)' : 'rgba(255, 165, 0, 0.10)' }}
          />
          
          <svg className="w-full h-full -rotate-90 transform">
            <circle 
              className="text-surface-container-highest" 
              cx="120" 
              cy="128" 
              fill="transparent" 
              r="90" 
              stroke="currentColor" 
              strokeWidth="6" 
            />
            <circle 
              className="transition-all duration-500 ease-out" 
              cx="120" 
              cy="128" 
              fill="transparent" 
              r="90" 
              stroke={liveRiskScore >= 70 ? '#ef4444' : liveRiskScore >= 40 ? '#ff544c' : '#f59e0b'}
              strokeDasharray="565" 
              strokeDashoffset={565 - scorePercent} 
              strokeLinecap="round" 
              strokeWidth="9" 
            />
          </svg>

          {/* Centered Score */}
          <div className="absolute flex flex-col items-center">
            <span className={`text-5xl font-black transition-colors duration-500 ${scoreColor}`}>{liveRiskScore}</span>
            <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest mt-1">
              Risk Score
            </span>
            {micActive && (
              <span className="text-[8px] uppercase font-bold text-green-400/70 tracking-widest mt-0.5 animate-pulse">
                ● Voice Analysis Active
              </span>
            )}
          </div>
        </section>

        {/* Waves Audio streaming indicator — driven by real mic data */}
        <div className="w-full max-w-[280px] flex items-center justify-center gap-1.5 h-14 mb-6">
          {waveHeights.map((h, i) => (
            <div 
              key={i} 
              className={`w-1.5 rounded-full transition-all ${micActive ? 'duration-75' : 'duration-150'}`}
              style={{ 
                height: `${h}px`,
                backgroundColor: liveRiskScore >= 70 ? '#ef4444' : liveRiskScore >= 40 ? '#ff544c' : '#f59e0b',
                opacity: micActive ? 0.9 : 0.6,
              }} 
            />
          ))}
        </div>

        {/* Voice Level Hint */}
        {micActive && (
          <div className="w-full max-w-sm mb-4 text-center animate-in fade-in duration-500">
            <p className="text-[10px] text-on-surface-variant/60 font-semibold uppercase tracking-widest">
              {liveRiskScore >= 70 ? '🔴 HIGH VOLUME DETECTED — POSSIBLE DISTRESS' : 
               liveRiskScore >= 40 ? '🟡 ELEVATED VOICE DETECTED' : 
               '🟢 NORMAL VOICE LEVEL'}
            </p>
          </div>
        )}

        {/* Mic error banner */}
        {micError && (
          <div className="w-full max-w-sm mb-4 glass-card rounded-xl p-3 border border-red-500/25 bg-red-500/5 animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <MicOff className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-300 font-medium">Microphone access denied. Risk score using fallback mode.</p>
            </div>
            <button 
              onClick={() => { setMicError(false); startMicAnalysis(); }}
              className="mt-2 text-[10px] font-bold text-primary uppercase tracking-wider hover:text-white transition-colors cursor-pointer"
            >
              Retry Microphone Access
            </button>
          </div>
        )}

        {/* Transcript Display */}
        {transcript && (
          <div className="w-full max-w-sm mb-6 glass-card rounded-xl p-4 border border-primary/15">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Live Transcript</p>
            <p className="text-xs text-on-surface-variant leading-relaxed italic">"{transcript}"</p>
          </div>
        )}

        {/* Automated Timeline events status list */}
        <section className="w-full space-y-3.5 max-w-sm">
          
          {timelineIndex >= 1 && (
            <div className="glass-card rounded-2xl p-4 flex items-start gap-4 border border-white/5 animate-in fade-in duration-500">
              <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5 fill-primary text-background" />
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-[15px] text-on-surface leading-snug">Incident Created</h4>
                  <span className="text-xs text-on-surface-variant font-medium font-mono">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed mt-0.5">
                  Emergency protocol initiated. ID: {incidentId || 'Pending...'}
                </p>
              </div>
            </div>
          )}

          {timelineIndex >= 2 && (
            <div className="glass-card rounded-2xl p-4 flex items-start gap-4 border border-white/5 animate-in fade-in duration-500">
              <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5 fill-primary text-background" />
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-[15px] text-on-surface leading-snug">Emergency Contacts Alerted</h4>
                  <span className="text-xs text-on-surface-variant font-medium font-mono">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed mt-0.5">
                  Realtime location and active voice telemetry feed shared with your primary network.
                </p>
              </div>
            </div>
          )}

          {timelineIndex >= 3 && (
            <div className="glass-card rounded-2xl p-4 flex items-start gap-4 border border-white/5 animate-in fade-in duration-500">
              <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5 fill-primary text-background" />
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-[15px] text-on-surface leading-snug">Police Dispatch Notified</h4>
                  <span className="text-xs text-on-surface-variant font-medium font-mono">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed mt-0.5">
                  Priority 1 alert routed to municipal dispatcher. Location tracking broadcast active.
                </p>
              </div>
            </div>
          )}

          {timelineIndex >= 4 ? (
            <div className="glass-card rounded-2xl p-4 flex items-start gap-4 border border-primary/25 bg-primary/5 animate-in fade-in duration-500">
              <div className="mt-1 flex items-center justify-center shrink-0">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-[15px] text-primary leading-snug">Biometric Audio Upload</h4>
                  <span className="text-xs text-primary font-black animate-pulse">UPLOADING...</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed mt-0.5">
                  Encrypted black-box stream being safely cached on redundant decentralized servers.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-2 text-center text-xs text-on-surface-variant/40 italic">
              Compiling live evidence stream...
            </div>
          )}
          
        </section>
      </main>

      {/* SOS Active Footer Options panel */}
      <footer className="fixed bottom-0 left-0 right-0 max-w-sm mx-auto p-6 pb-8 bg-gradient-to-t from-background via-background/90 to-transparent z-40">
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => alert(`Connecting Priority Call line with ${primaryContactName}...`)}
            className="w-full h-14 bg-secondary text-on-secondary rounded-xl font-bold text-title-md flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
          >
            <Phone className="w-5 h-5 fill-on-secondary text-secondary" />
            Call Emergency Contact
          </button>
          
          <button 
            onClick={() => setShowConfirmCancel(true)}
            className="w-full h-14 border border-outline/35 bg-white/5 text-on-surface rounded-xl font-bold text-title-md flex items-center justify-center active:scale-95 transition-transform backdrop-blur-md cursor-pointer hover:bg-white/10"
          >
            Cancel False Alarm
          </button>
        </div>
      </footer>

      {/* Custom Cancel False Alarm Confirmation Modal Dialog */}
      {showConfirmCancel && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-xs glass-card p-6 border border-primary/20 space-y-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6 text-primary animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-base font-black text-primary uppercase tracking-wider">Cancel SOS Alert?</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Are you sure you want to cancel the emergency alert? This will notify the dispatch center that you are safe.
              </p>
            </div>

            <div className="space-y-2.5">
              {/* Option 1: Yes, Cancel SOS */}
              <button
                onClick={() => {
                  setShowConfirmCancel(false);
                  stopMicAnalysis();
                  onCancelSOS();
                }}
                className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white border border-red-500/30 rounded-xl font-black text-xs uppercase tracking-wider active:scale-[0.98] transition-all cursor-pointer safe-glow"
                style={{
                  boxShadow: '0 0 15px rgba(220, 38, 39, 0.3)'
                }}
              >
                Yes, Cancel Alert
              </button>

              {/* Option 2: Keep SOS Active */}
              <button
                onClick={() => setShowConfirmCancel(false)}
                className="w-full py-3 px-4 bg-surface-container hover:bg-surface-container-highest text-white border border-white/10 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all cursor-pointer"
              >
                Keep SOS Active
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
