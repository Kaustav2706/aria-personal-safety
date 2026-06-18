import React, { useEffect, useState } from 'react';
import { ShieldAlert, Cpu } from 'lucide-react';

interface SplashViewProps {
  onComplete: () => void;
}

export default function SplashView({ onComplete }: SplashViewProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1.25;
      });
    }, 30);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      const timeout = setTimeout(() => {
        onComplete();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [progress, onComplete]);

  return (
    <div className="relative min-h-screen bg-[#0f172a] overflow-hidden flex flex-col justify-between p-6">
      {/* Glow Backdrops */}
      <div className="absolute top-[15%] left-[-10%] w-[350px] h-[350px] rounded-full bg-primary/10 blur-[90px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[350px] h-[350px] rounded-full bg-[#3394f1]/10 blur-[90px] pointer-events-none" />

      {/* Top Spacer */}
      <div />

      {/* Main Content */}
      <div className="flex flex-col items-center text-center -mt-12">
        {/* Animated Central Shield */}
        <div 
          onClick={onComplete}
          className="relative mb-6 cursor-pointer group active:scale-95 transition-transform"
        >
          {/* Ripple rings */}
          <div className="absolute inset-x-0 w-32 h-32 scale-125 rounded-full bg-primary/20 blur-xl opacity-40 animate-pulse" />
          
          <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden">
            {/* Inner Gradient ring */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/15 via-transparent to-secondary/15 opacity-60" />
            
            {/* Shield Icon */}
            <ShieldAlert className="w-16 h-16 text-primary drop-shadow-[0_0_15px_rgba(255,180,172,0.4)]" />
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-display-lg font-black tracking-tighter text-white uppercase mb-1 drop-shadow-md select-none">
          ARIA
        </h1>
        {/* Tagline */}
        <p className="text-label-md text-on-surface-variant font-bold tracking-[0.25em] uppercase opacity-80 select-none">
          AI-POWERED SAFETY COMPANION
        </p>
      </div>

      {/* Footer Area with loading progress bar */}
      <div className="w-full max-w-xs mx-auto pb-12 flex flex-col items-center">
        {/* Minimal loading track */}
        <div className="w-full h-[3px] bg-white/10 rounded-full overflow-hidden mb-4">
          <div 
            className="h-full bg-gradient-to-r from-primary to-secondary shadow-[0_0_8px_rgba(255,180,172,0.6)] transition-all ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Loading details */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
          </span>
          <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">
            Initializing Neural Security ({Math.min(100, Math.round(progress))}%)
          </span>
        </div>
      </div>
    </div>
  );
}
