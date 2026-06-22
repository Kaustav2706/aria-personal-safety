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
    <div className="relative min-h-screen bg-[#0f0807] overflow-hidden flex flex-col justify-between p-6">
      {/* Animated gradient glow orbs */}
      <div className="absolute top-[10%] left-[-15%] w-[400px] h-[400px] rounded-full bg-primary/[0.08] blur-[100px] pointer-events-none animate-glow-pulse" />
      <div className="absolute bottom-[15%] right-[-15%] w-[400px] h-[400px] rounded-full bg-secondary/[0.07] blur-[100px] pointer-events-none animate-glow-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-[50%] left-[30%] w-[200px] h-[200px] rounded-full bg-tertiary/[0.04] blur-[80px] pointer-events-none animate-glow-pulse" style={{ animationDelay: '2s' }} />

      {/* Subtle dot grid overlay */}
      <div className="absolute inset-0 dot-grid pointer-events-none" />

      {/* Top Spacer */}
      <div />

      {/* Main Content */}
      <div className="flex flex-col items-center text-center -mt-12 animate-fade-in-scale">
        {/* Animated Central Shield */}
        <div 
          onClick={onComplete}
          className="relative mb-8 cursor-pointer group active:scale-95 transition-transform"
        >
          {/* Outer rotating ring */}
          <div className="absolute inset-[-8px] rounded-full border border-primary/[0.08] pointer-events-none" style={{ animation: 'orbit 12s linear infinite' }} />
          <div className="absolute inset-[-16px] rounded-full border border-secondary/[0.04] pointer-events-none" style={{ animation: 'orbit 20s linear infinite reverse' }} />
          
          {/* Glow backdrop */}
          <div className="absolute inset-0 w-32 h-32 rounded-full bg-primary/15 blur-[40px] animate-glow-pulse pointer-events-none" />
          
          <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-full bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] flex items-center justify-center shadow-[0_8px_40px_rgba(0,0,0,0.4)] overflow-hidden">
            {/* Inner gradient ring */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-secondary/10 opacity-70" />
            {/* Subtle shimmer */}
            <div className="absolute inset-0 shimmer" />
            
            {/* Shield Icon */}
            <ShieldAlert className="w-16 h-16 text-primary relative z-10" style={{ filter: 'drop-shadow(0 0 20px rgba(255,180,172,0.35))' }} />
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-5xl font-black tracking-[-0.04em] uppercase mb-2 select-none text-gradient bg-gradient-to-r from-primary via-[#ffcec8] to-primary">
          ARIA
        </h1>
        {/* Tagline */}
        <p className="text-[11px] text-on-surface-variant/60 font-bold tracking-[0.25em] uppercase select-none">
          AI-POWERED SAFETY COMPANION
        </p>
      </div>

      {/* Footer Area with loading progress bar */}
      <div className="w-full max-w-xs mx-auto pb-12 flex flex-col items-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
        {/* Minimal loading track */}
        <div className="w-full h-[3px] bg-white/[0.06] rounded-full overflow-hidden mb-4">
          <div 
            className="h-full bg-gradient-to-r from-primary via-tertiary to-secondary rounded-full transition-all ease-out relative"
            style={{ width: `${progress}%` }}
          >
            {/* Glowing edge */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white/40 blur-[4px]" />
          </div>
        </div>

        {/* Loading details */}
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
          </span>
          <span className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.15em]">
            Initializing Neural Security ({Math.min(100, Math.round(progress))}%)
          </span>
        </div>
      </div>
    </div>
  );
}
