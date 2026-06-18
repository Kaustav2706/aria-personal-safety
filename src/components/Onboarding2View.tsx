import React, { useEffect, useState } from 'react';
import { Mic, Navigation, Activity, ArrowRight, ShieldCheck } from 'lucide-react';

interface OnboardingProps {
  onNext: () => void;
  onSkip: () => void;
}

export default function Onboarding2View({ onNext, onSkip }: OnboardingProps) {
  // Simulate active waveform bars
  const [waveHeights, setWaveHeights] = useState([24, 48, 72, 36, 16]);

  useEffect(() => {
    const timer = setInterval(() => {
      setWaveHeights([
        Math.floor(Math.random() * 50) + 20,
        Math.floor(Math.random() * 70) + 30,
        Math.floor(Math.random() * 80) + 40,
        Math.floor(Math.random() * 60) + 20,
        Math.floor(Math.random() * 40) + 10,
      ]);
    }, 200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex flex-col justify-between p-6">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[5%] left-[-10%] w-[60%] h-[40%] bg-primary/10 rounded-full blur-[110px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[50%] bg-[#3394f1]/8 rounded-full blur-[130px]" />
      </div>

      {/* Skip Area */}
      <div className="relative z-10 flex justify-between items-center pt-4">
        <div className="text-secondary font-black text-2xl tracking-tighter">ARIA</div>
        <button 
          onClick={onSkip}
          className="text-on-surface-variant font-semibold text-label-md uppercase tracking-widest hover:text-on-surface transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Main Monitoring Visualization Container */}
      <div className="relative z-10 flex-grow flex flex-col justify-center items-center py-6">
        {/* Central Map/Webform rounded glass sphere container */}
        <div className="w-full aspect-square max-w-[310px] glass-card rounded-full flex flex-col items-center justify-center relative overflow-hidden">
          {/* Map background overlay */}
          <div className="absolute inset-0 opacity-[0.22] grayscale contrast-125">
            <img 
              className="w-full h-full object-cover" 
              src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=400"
              alt="City Grid Grid" 
            />
          </div>

          {/* Waveform Pulse Overlay */}
          <div className="absolute inset-0 flex items-center justify-center gap-1.5 px-12 pointer-events-none">
            {waveHeights.map((h, i) => (
              <div 
                key={i} 
                className="w-1.5 rounded-full bg-primary/45 transition-all duration-250"
                style={{ height: `${h}px` }} 
              />
            ))}
          </div>

          {/* Central Status Ring shield check */}
          <div className="relative z-20 w-32 h-32 rounded-full glass-card border-primary/20 flex items-center justify-center animate-pulse">
            <ShieldCheck className="w-16 h-16 text-primary drop-shadow-[0_0_15px_rgba(255,180,172,0.4)]" />
          </div>

          {/* Floating Data Chips */}
          <div className="absolute top-10 right-4 glass-card px-3 py-1.5 rounded-full flex items-center gap-1.5 border-secondary/20">
            <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">GPS: Active</span>
          </div>

          <div className="absolute bottom-12 left-4 glass-card px-3 py-1.5 rounded-full flex items-center gap-1.5 border-tertiary/20">
            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
            <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider">Voice: Ready</span>
          </div>
        </div>

        {/* Bento Intelligence indicators */}
        <div className="grid grid-cols-3 gap-3 w-full mt-8 max-w-[310px]">
          <div className="glass-card p-3 rounded-2xl flex flex-col items-center text-center gap-1 border-white/5">
            <Mic className="w-5 h-5 text-secondary" />
            <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Voice</span>
          </div>
          <div className="glass-card p-3 rounded-2xl flex flex-col items-center text-center gap-1 border-white/5">
            <Activity className="w-5 h-5 text-primary" />
            <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Motion</span>
          </div>
          <div className="glass-card p-3 rounded-2xl flex flex-col items-center text-center gap-1 border-white/5">
            <Navigation className="w-5 h-5 text-tertiary" />
            <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Location</span>
          </div>
        </div>
      </div>

      {/* Text Description */}
      <section className="text-center space-y-2 z-10">
        <h1 className="font-sans font-black text-3xl text-white">
          Total Awareness
        </h1>
        <p className="text-body-lg text-on-surface-variant leading-relaxed max-w-sm mx-auto">
          ARIA’s multimodal AI integrates voice patterns, motion sensors, and live location to detect anomalies before they escalate.
        </p>
      </section>

      {/* Footer Nav Controls */}
      <footer className="pt-8 pb-4 z-10">
        {/* Progress Dots */}
        <div className="flex justify-center gap-2 mb-8">
          <div className="h-1.5 w-1.5 rounded-full bg-surface-container-highest" />
          <div className="h-1.5 w-8 rounded-full bg-primary shadow-[0_0_8px_rgba(255,180,172,0.4)]" />
          <div className="h-1.5 w-1.5 rounded-full bg-surface-container-highest" />
        </div>

        {/* Continue Button */}
        <button 
          onClick={onNext}
          className="w-full bg-primary text-on-primary h-14 rounded-full font-bold text-title-md flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
}
