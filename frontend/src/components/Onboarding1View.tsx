import React from 'react';
import { Shield, ArrowRight, Radio, ShieldAlert } from 'lucide-react';

interface OnboardingProps {
  onNext: () => void;
  onSkip: () => void;
}

export default function Onboarding1View({ onNext, onSkip }: OnboardingProps) {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex flex-col justify-between p-6">
      {/* Background Decor Ambient Blobs */}
      <div className="absolute top-[-10%] left-[-15%] w-[80%] h-[40%] bg-primary/8 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[30%] right-[-15%] w-[60%] h-[50%] bg-[#3394f1]/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Top Action Row */}
      <header className="flex justify-between items-center pt-4 z-10">
        <div className="text-primary font-black text-2xl tracking-tighter">ARIA</div>
        <button 
          onClick={onSkip}
          className="text-on-surface-variant font-semibold text-label-md hover:text-on-surface transition-colors uppercase tracking-widest px-4 py-2"
        >
          Skip
        </button>
      </header>

      {/* Visual / Illustration Area */}
      <div className="flex-grow flex flex-col items-center justify-center relative py-8 z-10">
        {/* Shield with cascading subtle rings */}
        <div className="relative w-52 h-52 flex items-center justify-center">
          {/* Pulsing signal border rings */}
          <div className="absolute w-44 h-44 rounded-full border border-primary/20 animate-[ping_3s_infinite]" />
          <div className="absolute w-36 h-36 rounded-full border border-primary/30 animate-[ping_2s_infinite]" />
          <div className="absolute w-28 h-28 rounded-full border border-[#3394f1]/20 animate-pulse" />

          {/* Core Glass Card Shield */}
          <div className="glass-card w-32 h-32 rounded-3xl flex items-center justify-center shadow-2xl relative">
            <Shield className="w-16 h-16 text-primary drop-shadow-[0_0_12px_rgba(255,180,172,0.3)]" />
            
            {/* Soft pulsing green/cyan active marker dot */}
            <div className="absolute top-5 right-5 w-3.5 h-3.5 bg-tertiary rounded-full shadow-[0_0_12px_#72d4ef] animate-pulse" />
          </div>
        </div>

        {/* Floating cards for structural contextual overlay */}
        <div className="absolute top-12 left-2 glass-card px-4 py-2.5 rounded-xl border-white/10 flex items-center gap-2 animate-bounce shadow-md" style={{ animationDuration: '4.5s' }}>
          <Radio className="w-5 h-5 text-tertiary animate-pulse" />
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Live Tracking</span>
        </div>

        <div className="absolute bottom-16 right-2 glass-card px-4 py-2.5 rounded-xl border-white/10 flex items-center gap-2 animate-bounce shadow-md" style={{ animationDuration: '6s', animationDelay: '1s' }}>
          <ShieldAlert className="w-5 h-5 text-primary" />
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Instant SOS</span>
        </div>
      </div>

      {/* Text block Content */}
      <div className="text-center md:text-left space-y-3 z-10 max-w-sm mx-auto md:mx-0">
        <h2 className="font-sans font-black text-3xl text-white leading-tight">
          Your Intelligent <br />
          <span className="text-primary">Safety Shield</span>
        </h2>
        <p className="text-body-lg text-on-surface-variant leading-relaxed">
          Advanced AI distress detection watches over you in real-time, sensing subtle changes in environment and movement to keep you protected.
        </p>
      </div>

      {/* Footer Controls & Buttons */}
      <footer className="pt-8 pb-4 z-10">
        {/* Progress bar dots Indicator */}
        <div className="flex justify-center md:justify-start gap-2 mb-8">
          <div className="h-1.5 w-8 rounded-full bg-primary shadow-[0_0_8px_rgba(255,180,172,0.4)] transition-all" />
          <div className="h-1.5 w-1.5 rounded-full bg-surface-container-highest" />
          <div className="h-1.5 w-1.5 rounded-full bg-surface-container-highest" />
        </div>

        {/* Action Button */}
        <button 
          onClick={onNext}
          className="w-full bg-primary text-on-primary h-14 rounded-2xl font-bold text-title-md flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-xl shadow-primary/20"
        >
          Next
          <ArrowRight className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
}
