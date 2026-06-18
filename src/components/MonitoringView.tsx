import React, { useEffect, useState } from 'react';
import { ShieldCheck, Activity, Search, ShieldAlert, Cpu, Check, Compass, Ear, RefreshCw } from 'lucide-react';

export default function MonitoringView() {
  const [anomaly, setAnomaly] = useState(false);
  const [pulse, setPulse] = useState(true);

  return (
    <div className="pt-20 pb-32 px-6 font-sans select-none">
      
      {/* Top Title Section */}
      <header className="mb-6 space-y-1">
        <div className="flex items-center gap-2">
          {/* Pulsing indicator dot */}
          <span className="w-2.5 h-2.5 rounded-full bg-[#72d4ef] animate-pulse" />
          <span className="font-bold text-xs uppercase tracking-widest text-[#72d4ef]">
            Active Analysis
          </span>
        </div>
        <h2 className="text-3xl font-black text-on-surface">System Monitoring</h2>
      </header>

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
            <span className="text-xl font-black text-[#72d4ef]">98%</span>
          </div>

          <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-secondary to-tertiary rounded-full w-[98%]" />
          </div>

          <p className="text-body-sm text-on-surface-variant opacity-80 leading-relaxed font-medium">
            No acoustic anomalies detected in immediate vicinity. Voice signature profile matches baseline.
          </p>
        </div>

        {/* Motion risk block */}
        <div className="glass-card p-4 rounded-2xl flex flex-col justify-between aspect-square border border-white/5">
          <div className="space-y-1">
            <Activity className="w-6 h-6 text-secondary" />
            <h3 className="text-label-md text-on-surface-variant font-bold uppercase tracking-wider">Motion</h3>
          </div>
          <div>
            <div className="text-xl font-bold text-secondary">Normal</div>
            <p className="text-[10px] text-on-surface-variant opacity-75 font-semibold uppercase tracking-wider mt-0.5">
              Gait Analysis
            </p>
          </div>
        </div>

        {/* Isolation environment block */}
        <div className="glass-card p-4 rounded-2xl flex flex-col justify-between aspect-square border border-white/5">
          <div className="space-y-1">
            <Search className="w-6 h-6 text-tertiary" />
            <h3 className="text-label-md text-on-surface-variant font-bold uppercase tracking-wider">Isolation</h3>
          </div>
          <div>
            <div className="text-xl font-bold text-tertiary">Safe</div>
            <p className="text-[10px] text-on-surface-variant opacity-75 font-semibold uppercase tracking-wider mt-0.5">
              Env. Score
            </p>
          </div>
        </div>

        {/* Risk Trend Curve Container */}
        <div className="glass-card col-span-2 p-5 rounded-2xl space-y-4 border border-white/5 shadow-md">
          <div className="flex justify-between items-center">
            <h3 className="text-[15px] font-black text-on-surface">AI Risk Trend</h3>
            <span className="text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">Last 10 min</span>
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
                d="M0,85 Q50,75 100,80 T200,55 T300,75 T400,85" 
                fill="url(#chartGrad)" 
              />
              <path 
                d="M0,85 Q50,75 100,80 T200,55 T300,75 T400,85" 
                fill="none" 
                stroke="#72d4ef" 
                strokeWidth="3.5" 
              />
              
              {/* Highlight score dot */}
              <circle cx="200" cy="55" r="5" fill="#72d4ef" />
              <circle cx="200" cy="55" r="10" fill="#72d4ef" className="animate-ping opacity-40" />
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
              <span className="text-[10px] font-black uppercase text-secondary tracking-widest bg-secondary/15 px-3 py-1 rounded-full border border-secondary/20">
                ACTIVE
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
