import React, { useEffect, useState, useRef } from 'react';
import { Mic, ArrowRight, Shield, ShieldCheck, MapPin, Bell, Activity, Play, Zap } from 'lucide-react';

interface DashboardViewProps {
  onTriggerSOS: () => void;
  onGoToScreen: (screen: any) => void;
  userName: string;
  userAvatar: string;
  riskScore: number;
  backendOnline: boolean;
  monitoringActive: boolean;
}

export default function DashboardView({ 
  onTriggerSOS, 
  onGoToScreen,
  userName, 
  userAvatar,
  riskScore,
  backendOnline,
  monitoringActive,
}: DashboardViewProps) {
  // Wave heights state for ambient voice feed representation
  const [waveHeights, setWaveHeights] = useState([8, 16, 24, 12, 10, 4]);
  // Ref & Timer state for holds
  const [holdPercent, setHoldProgress] = useState(0);
  const isPressing = useRef(false);
  const animationFrameId = useRef<number | null>(null);

  // Live GPS coordinates
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const waveInterval = setInterval(() => {
      setWaveHeights([
        Math.floor(Math.random() * 16) + 4,
        Math.floor(Math.random() * 24) + 6,
        Math.floor(Math.random() * 20) + 5,
        Math.floor(Math.random() * 16) + 4,
        Math.floor(Math.random() * 26) + 8,
        Math.floor(Math.random() * 12) + 3,
      ]);
    }, 150);

    return () => clearInterval(waveInterval);
  }, []);

  // Get live GPS
  useEffect(() => {
    let watchId: number;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // GPS unavailable — use fallback
          setGpsCoords({ lat: 37.7749, lng: -122.4194 });
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, []);

  // Custom long press implementation for SOS activation (3 seconds)
  const startPress = () => {
    isPressing.current = true;
    setHoldProgress(0);
    const startTime = Date.now();

    const updateFrame = () => {
      if (!isPressing.current) return;
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / 3000) * 100);
      setHoldProgress(pct);

      if (pct < 100) {
        animationFrameId.current = requestAnimationFrame(updateFrame);
      } else {
        triggerSOS();
      }
    };

    animationFrameId.current = requestAnimationFrame(updateFrame);
  };

  const endPress = () => {
    isPressing.current = false;
    setHoldProgress(0);
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
  };

  const triggerSOS = () => {
    endPress();
    onTriggerSOS();
  };

  const safeStatus = riskScore < 50;

  // SVG arc gauge calculations
  const gaugeRadius = 44;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeProgress = (riskScore / 100) * gaugeCircumference;  return (
    <div className="pt-24 pb-48 px-6 font-sans relative overflow-x-hidden animate-fade-in-scale">
      {/* Background Neon Orbs */}
      <div className="absolute top-1/4 -left-12 w-48 h-48 bg-primary/5 rounded-full blur-[80px] pointer-events-none animate-glow-pulse" />
      <div className="absolute top-2/3 -right-12 w-48 h-48 bg-secondary/5 rounded-full blur-[80px] pointer-events-none animate-glow-pulse" style={{ animationDelay: '1.5s' }} />

      {/* Top Banner Safety Status Card */}
      <section className="relative rounded-3xl p-8 flex flex-col items-center justify-center text-center overflow-hidden animate-fade-in-scale glass-card-elevated gradient-border hover-lift">
        {/* Background gradient layers */}
        <div className={`absolute inset-0 rounded-3xl opacity-50 ${safeStatus ? 'bg-gradient-to-br from-secondary/[0.12] via-transparent to-tertiary/[0.08]' : 'bg-gradient-to-br from-primary/[0.18] via-transparent to-red-500/[0.1]'}`} />
        {/* Ambient dynamic glow orbs */}
        <div className={`absolute w-36 h-36 rounded-full blur-[50px] pointer-events-none animate-glow-pulse ${safeStatus ? 'bg-secondary/20 -top-8 -right-8' : 'bg-primary/25 -top-8 -left-8'}`} />
        <div className={`absolute w-32 h-32 rounded-full blur-[40px] pointer-events-none animate-glow-pulse ${safeStatus ? 'bg-tertiary/10 -bottom-8 -left-8' : 'bg-red-500/10 -bottom-8 -right-8'}`} style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
        
        <div className="relative z-10 space-y-4">
          <div className={`w-16 h-16 rounded-full ${safeStatus ? 'bg-secondary/[0.08] border-secondary/20' : 'bg-primary/[0.08] border-primary/20'} border flex items-center justify-center mx-auto relative`}>
            {/* Glow ring */}
            <div className={`absolute inset-0 rounded-full ${safeStatus ? 'shadow-[0_0_15px_rgba(162,201,255,0.25)]' : 'shadow-[0_0_15px_rgba(255,180,172,0.3)]'}`} />
            <ShieldCheck className={`w-9 h-9 ${safeStatus ? 'text-secondary' : 'text-primary'} relative z-10`} />
          </div>
          
          <div className="space-y-1">
            <h2 className={`text-4.5xl font-black tracking-widest select-none text-gradient bg-gradient-to-r ${safeStatus ? 'from-secondary via-white to-secondary animate-gradient-shift' : 'from-primary via-white to-primary animate-gradient-shift'}`}>
              {safeStatus ? 'SAFE' : 'ELEVATED'}
            </h2>
            <p className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant/80 select-none">
              {safeStatus ? 'Your environment is currently stable' : `Risk level elevated • score: ${riskScore}`}
            </p>
          </div>
        </div>
      </section>

      {/* Connection Status Chips */}
      <div className="flex flex-wrap gap-2.5 mt-5 overflow-x-auto no-scrollbar py-1.5 relative z-10">
        <div className={`flex items-center gap-2 px-3.5 py-2 rounded-full glass-card border border-white/10 text-[9px] font-black uppercase tracking-[0.12em] whitespace-nowrap hover-lift transition-all duration-200 ${backendOnline ? 'text-secondary' : 'text-red-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? 'bg-secondary shadow-[0_0_8px_rgba(162,201,255,0.6)] animate-pulse' : 'bg-red-500 shadow-[0_0_8px_rgba(255,84,76,0.6)]'}`} />
          <span>{backendOnline ? 'Backend Connected' : 'Backend Offline'}</span>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-full glass-card border border-white/10 text-secondary text-[9px] font-black uppercase tracking-[0.12em] whitespace-nowrap hover-lift transition-all duration-200">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(162,201,255,0.6)] animate-pulse" />
          <span>AI Connected</span>
        </div>
        <div className={`flex items-center gap-2 px-3.5 py-2 rounded-full glass-card border border-white/10 text-[9px] font-black uppercase tracking-[0.12em] whitespace-nowrap hover-lift transition-all duration-200 ${gpsCoords ? 'text-secondary' : 'text-yellow-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${gpsCoords ? 'bg-secondary shadow-[0_0_8px_rgba(162,201,255,0.6)] animate-pulse' : 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]'}`} />
          <span>{gpsCoords ? 'GPS Connected' : 'GPS Pending'}</span>
        </div>
      </div>

      {/* Grid of details */}
      <section className="grid grid-cols-2 gap-3.5 mt-6 relative z-10">
        
        {/* Voice monitoring tile */}
        <div 
          onClick={() => onGoToScreen('MONITORING')}
          className="glass-card rounded-2xl p-4 flex flex-col justify-between h-40 cursor-pointer hover-lift group gradient-border"
        >
          <div className="flex justify-between items-start">
            <div className="w-8 h-8 rounded-lg bg-on-surface-variant/[0.06] flex items-center justify-center">
              <Mic className="w-4 h-4 text-on-surface-variant/80" />
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-1 rounded-full border ${
              monitoringActive 
                ? 'text-secondary bg-secondary/[0.08] border-secondary/15' 
                : 'text-on-surface-variant/60 bg-surface-container/60 border-white/[0.06]'
            }`}>
              {monitoringActive ? 'ACTIVE' : 'IDLE'}
            </span>
          </div>

          <div>
            <p className="text-[9px] text-on-surface-variant/60 font-black uppercase tracking-[0.12em] mb-1.5">Voice Feed</p>
            <div className="flex items-end gap-[3.5px] h-7 pointer-events-none">
              {waveHeights.map((h, i) => (
                <div 
                  key={i} 
                  className={`w-[3.5px] rounded-full transition-all duration-150 bg-gradient-to-t ${monitoringActive ? 'from-secondary to-tertiary shadow-[0_0_6px_rgba(162,201,255,0.4)]' : 'from-on-surface-variant/10 to-on-surface-variant/30'}`}
                  style={{ height: `${h}px` }} 
                />
              ))}
            </div>
          </div>
        </div>

        {/* Motion tile */}
        <div 
          onClick={() => onGoToScreen('MONITORING')}
          className="glass-card rounded-2xl p-4 flex flex-col justify-between h-40 cursor-pointer hover-lift group gradient-border"
        >
          <div className="flex justify-between items-start">
            <div className="w-8 h-8 rounded-lg bg-on-surface-variant/[0.06] flex items-center justify-center">
              <Activity className="w-4 h-4 text-on-surface-variant/80" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-tertiary bg-tertiary/[0.08] px-2 py-1 rounded-full border border-tertiary/15">
              STEADY
            </span>
          </div>

          <div className="space-y-1.5">
            <p className="text-[9px] text-on-surface-variant/60 font-black uppercase tracking-[0.12em]">Motion Patterns</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-white leading-tight">Normal Gait</span>
              <svg className="w-14 h-5 text-tertiary/60 shrink-0" viewBox="0 0 100 30" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M0,15 L20,15 L25,5 L30,25 L35,10 L40,15 L100,15" className="animate-pulse" />
              </svg>
            </div>
          </div>
        </div>

        {/* SVG Arc Risk Gauge */}
        <div 
          onClick={() => onGoToScreen('MONITORING')}
          className="glass-card rounded-2xl p-4 flex flex-col items-center justify-center h-40 cursor-pointer hover-lift gradient-border"
        >
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* Background track */}
              <circle
                cx="50" cy="50" r={gaugeRadius}
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="6"
              />
              {/* Tick marks */}
              {[...Array(24)].map((_, i) => {
                const angle = (i / 24) * 360;
                const rad = (angle * Math.PI) / 180;
                const x1 = 50 + 38 * Math.cos(rad);
                const y1 = 50 + 38 * Math.sin(rad);
                const x2 = 50 + 41 * Math.cos(rad);
                const y2 = 50 + 41 * Math.sin(rad);
                return (
                  <line
                    key={i}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="0.6"
                  />
                );
              })}
              {/* Gradient arc */}
              <defs>
                <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={riskScore >= 50 ? '#ff544c' : '#a2c9ff'} />
                  <stop offset="100%" stopColor={riskScore >= 50 ? '#ffb4ac' : '#72d4ef'} />
                </linearGradient>
              </defs>
              <circle
                cx="50" cy="50" r={gaugeRadius}
                fill="none"
                stroke="url(#gaugeGrad)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={gaugeCircumference}
                strokeDashoffset={gaugeCircumference - gaugeProgress}
                className="transition-all duration-700 ease-out"
                style={{
                  filter: `drop-shadow(0 0 4px ${riskScore >= 50 ? 'rgba(255,84,76,0.35)' : 'rgba(162,201,255,0.25)'})`
                }}
              />
              {/* End dot */}
              {riskScore > 0 && (
                <circle
                  cx={50 + gaugeRadius * Math.cos(((riskScore / 100) * 360 - 90) * Math.PI / 180)}
                  cy={50 + gaugeRadius * Math.sin(((riskScore / 100) * 360 - 90) * Math.PI / 180)}
                  r="3"
                  fill="white"
                  className="opacity-80"
                />
              )}
            </svg>
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-black leading-none ${riskScore >= 50 ? 'text-primary' : 'text-secondary'}`}>{riskScore}</span>
              <span className="text-[8px] uppercase tracking-[0.15em] text-on-surface-variant/60 font-bold mt-1">Risk</span>
            </div>
          </div>
        </div>

        {/* Live Map Tile */}
        <div 
          onClick={() => onGoToScreen('SAFE_RIDE')}
          className="glass-card rounded-2xl p-4 flex flex-col justify-between h-40 relative overflow-hidden cursor-pointer hover-lift group gradient-border"
        >
          {/* Miniature satellite map slice with Sonar Radar Sweep */}
          <div className="absolute inset-0 opacity-[0.25] grayscale contrast-125 z-0 pointer-events-none">
            <img 
              src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=300" 
              alt="Map thumbnail"
              className="w-full h-full object-cover" 
            />
            {/* Glowing radar sweeping effect */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(114,212,239,0.2)_0%,transparent_70%)]" />
            <div className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] bg-gradient-to-r from-tertiary/10 via-transparent to-transparent origin-center" style={{ animation: 'orbit 8s linear infinite' }} />
          </div>
          {/* Gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1e0f0e]/90 via-[#1e0f0e]/40 to-transparent z-[1] pointer-events-none" />

          <div className="relative z-10 flex justify-between items-start">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
              <MapPin className="w-4 h-4 text-on-surface-variant/80" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-tertiary bg-tertiary/[0.1] px-2 py-1 rounded-full border border-tertiary/15">
              LIVE
            </span>
          </div>

          <div className="relative z-10 space-y-0.5">
            <p className="text-[9px] text-on-surface-variant/60 font-black uppercase tracking-[0.12em]">Coordinates</p>
            <p className="text-[11px] font-mono text-white/90 tracking-wide">
              {gpsCoords 
                ? `${gpsCoords.lat.toFixed(4)}° N, ${Math.abs(gpsCoords.lng).toFixed(4)}° W`
                : 'Acquiring GPS...'}
            </p>
          </div>
        </div>
      </section>

      {/* Floating Action SOS triggering panel bottom anchor */}
      <div className="fixed bottom-24 left-0 right-0 max-w-sm mx-auto flex justify-center pointer-events-none z-30 px-6">
        <div className="relative flex items-center justify-center">
          
          {/* Triple ring pulse animation */}
          <div className={`absolute w-36 h-36 rounded-full border border-primary/10 pointer-events-none ${holdPercent > 0 ? 'scale-125 opacity-40' : ''}`} style={{ animation: 'ring-expand 2.5s ease-out infinite' }} />
          <div className="absolute w-32 h-32 rounded-full border border-primary/[0.07] pointer-events-none" style={{ animation: 'ring-expand 2.5s ease-out infinite 0.6s' }} />
          <div className="absolute w-28 h-28 rounded-full border border-primary/[0.05] pointer-events-none" style={{ animation: 'ring-expand 2.5s ease-out infinite 1.2s' }} />

          {/* Core circular physical trigger */}
          <button 
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            onTouchStart={(e) => {
              e.preventDefault();
              startPress();
            }}
            onTouchEnd={endPress}
            className="pointer-events-auto w-[88px] h-[88px] rounded-full bg-gradient-to-br from-primary-container via-[#e63b35] to-primary-container text-white flex flex-col items-center justify-center active:scale-95 transition-transform overflow-hidden relative cursor-pointer shadow-[0_0_24px_rgba(255,84,76,0.35),0_0_60px_rgba(255,84,76,0.12)] z-10"
          >
            {/* Radial fill progress overlay */}
            <div 
              className="absolute inset-0 rounded-full pointer-events-none transition-opacity"
              style={{
                background: `conic-gradient(rgba(255,255,255,0.2) ${holdPercent * 3.6}deg, transparent ${holdPercent * 3.6}deg)`,
                opacity: holdPercent > 0 ? 1 : 0,
              }}
            />
            {/* Standard icon metadata */}
            <Zap className="w-7 h-7 text-white animate-pulse mb-0.5 relative z-10" />
            <span className="text-[8px] font-black tracking-tight text-white/80 relative z-10">HOLD FOR SOS</span>
          </button>
        </div>
      </div>

    </div>
  );
}
