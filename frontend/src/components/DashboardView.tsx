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

  return (
    <div className="pt-24 pb-36 px-6 font-sans">
      
      {/* Top Banner Safety Status Card */}
      <section className="glass-card rounded-3xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden safe-glow">
        <div className="absolute inset-0 bg-[#3394f1]/5 pointer-events-none" />
        
        <div className="relative z-10 space-y-3">
          <div className={`w-16 h-16 rounded-full ${safeStatus ? 'bg-secondary/10 ring-4 ring-secondary/5' : 'bg-primary/10 ring-4 ring-primary/5'} flex items-center justify-center mx-auto`}>
            <ShieldCheck className={`w-10 h-10 ${safeStatus ? 'text-secondary' : 'text-primary'}`} />
          </div>
          
          <h2 className={`text-display-lg font-black tracking-tighter ${safeStatus ? 'text-secondary' : 'text-primary'} select-none`}>
            {safeStatus ? 'SAFE' : 'ELEVATED'}
          </h2>
          <p className="text-body-sm text-on-surface-variant font-medium opacity-90 select-none">
            {safeStatus ? 'Your environment is currently stable' : `Risk level elevated — score: ${riskScore}`}
          </p>
        </div>
      </section>

      {/* Connection Status Chips */}
      <div className="flex flex-wrap gap-2 mt-4 overflow-x-auto no-scrollbar py-1">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-[10px] font-bold uppercase tracking-wider border border-white/5 whitespace-nowrap ${backendOnline ? 'text-secondary' : 'text-red-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? 'bg-secondary animate-pulse' : 'bg-red-500'}`} />
          <span>{backendOnline ? 'Backend Connected' : 'Backend Offline'}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-secondary text-[10px] font-bold uppercase tracking-wider border border-white/5 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
          <span>AI Connected</span>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-[10px] font-bold uppercase tracking-wider border border-white/5 whitespace-nowrap ${gpsCoords ? 'text-secondary' : 'text-yellow-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${gpsCoords ? 'bg-secondary animate-pulse' : 'bg-yellow-400'}`} />
          <span>{gpsCoords ? 'GPS Connected' : 'GPS Pending'}</span>
        </div>
      </div>

      {/* Grid of details */}
      <section className="grid grid-cols-2 gap-4 mt-6">
        
        {/* Voice monitoring tile */}
        <div 
          onClick={() => onGoToScreen('MONITORING')}
          className="glass-card rounded-2xl p-4 flex flex-col justify-between h-40 cursor-pointer hover:border-secondary/30 transition-colors"
        >
          <div className="flex justify-between items-start">
            <Mic className="w-5 h-5 text-on-surface-variant opacity-80" />
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
              monitoringActive 
                ? 'text-secondary bg-secondary/10 border-secondary/15' 
                : 'text-on-surface-variant bg-surface-container border-white/10'
            }`}>
              {monitoringActive ? 'ACTIVE' : 'IDLE'}
            </span>
          </div>

          <div>
            <p className="text-label-md text-on-surface-variant font-semibold uppercase tracking-wider">Voice Feed</p>
            <div className="flex items-end gap-1 h-6 mt-1 pointer-events-none">
              {waveHeights.map((h, i) => (
                <div 
                  key={i} 
                  className={`w-1 rounded-full ${monitoringActive ? 'bg-secondary' : 'bg-on-surface-variant/30'}`}
                  style={{ height: `${h}px` }} 
                />
              ))}
            </div>
          </div>
        </div>

        {/* Motion tile */}
        <div 
          onClick={() => onGoToScreen('MONITORING')}
          className="glass-card rounded-2xl p-4 flex flex-col justify-between h-40 cursor-pointer hover:border-secondary/30 transition-colors"
        >
          <div className="flex justify-between items-start">
            <Activity className="w-5 h-5 text-on-surface-variant opacity-80" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#72d4ef] bg-[#72d4ef]/10 px-2 py-0.5 rounded-full border border-[#72d4ef]/15">
              STEADY
            </span>
          </div>

          <div>
            <p className="text-label-md text-on-surface-variant font-semibold uppercase tracking-wider">Motion Patterns</p>
            <p className="text-[17px] font-bold text-on-surface leading-tight mt-1">Normal Gait</p>
          </div>
        </div>

        {/* Circular score gauge */}
        <div 
          onClick={() => onGoToScreen('MONITORING')}
          className="glass-card rounded-2xl p-4 flex flex-col items-center justify-center h-40 cursor-pointer hover:border-primary/20 transition-colors"
        >
          {/* Custom gauge using background gradient segments */}
          <div 
            className="relative w-24 h-24 flex items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(${riskScore >= 50 ? '#ff544c' : '#a2c9ff'} ${riskScore * 3.6}deg, #2c1b1a 0deg)`
            }}
          >
            {/* Center black cutout */}
            <div className="absolute inset-2 bg-surface-container rounded-full flex flex-col items-center justify-center">
              <span className={`text-2xl font-black leading-none ${riskScore >= 50 ? 'text-primary' : 'text-secondary'}`}>{riskScore}</span>
              <span className="text-[8px] uppercase tracking-wider text-on-surface-variant font-black mt-0.5">Risk</span>
            </div>
          </div>
        </div>

        {/* Live Map Tile */}
        <div 
          onClick={() => onGoToScreen('SAFE_RIDE')}
          className="glass-card rounded-2xl p-4 flex flex-col justify-between h-40 relative overflow-hidden cursor-pointer hover:border-secondary/30 transition-colors"
        >
          {/* Miniature satellite map slice */}
          <div className="absolute inset-0 opacity-[0.25] grayscale contrast-125 z-0 pointer-events-none">
            <img 
              src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=300" 
              alt="Map thumbnail"
              className="w-full h-full object-cover" 
            />
          </div>

          <div className="relative z-10 flex justify-between items-start">
            <MapPin className="w-5 h-5 text-on-surface-variant opacity-80" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#72d4ef] bg-[#72d4ef]/10 px-2 py-0.5 rounded-full border border-[#72d4ef]/15">
              LIVE
            </span>
          </div>

          <div className="relative z-10 space-y-0.5">
            <p className="text-label-md text-on-surface-variant font-semibold uppercase tracking-wider">Coordinates</p>
            <p className="text-[11px] font-mono text-white/95">
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
          
          {/* Animated concentric rings showing press progress bounds */}
          <div className={`absolute w-32 h-32 rounded-full border-2 border-primary/20 pointer-events-none ${holdPercent > 0 ? 'scale-110 opacity-70' : 'animate-ping'}`} />
          <div className="absolute w-28 h-28 rounded-full border border-primary/10 pointer-events-none animate-pulse" />

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
            className="pointer-events-auto w-24 h-24 rounded-full bg-primary-container text-white flex flex-col items-center justify-center sos-glow active:scale-95 transition-transform overflow-hidden relative cursor-pointer"
          >
            {/* Standard icon metadata */}
            <Zap className="w-8 h-8 text-white animate-pulse mb-0.5" />
            <span className="text-[9px] font-black tracking-tighter text-white/90">HOLD FOR SOS</span>

            {/* Simulated progressive filling layer overlays inside standard button */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-white/20 transition-all pointer-events-none"
              style={{ height: `${holdPercent}%` }}
            />
          </button>
        </div>
      </div>

    </div>
  );
}
