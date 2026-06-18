import React, { useEffect, useState } from 'react';
import { Phone, CheckCircle, ShieldAlert, X } from 'lucide-react';

interface ActiveSOSProps {
  onCancelSOS: () => void;
  primaryContactName: string;
}

export default function ActiveSOSView({ onCancelSOS, primaryContactName }: ActiveSOSProps) {
  const [timelineIndex, setTimelineIndex] = useState(1);
  const [waveHeights, setWaveHeights] = useState([12, 32, 48, 24, 40, 16, 36, 44, 20]);

  useEffect(() => {
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
  }, []);

  // Slowly roll out timeline items representing automated cloud updates
  useEffect(() => {
    const timer = setInterval(() => {
      setTimelineIndex((prev) => (prev < 4 ? prev + 1 : 4));
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#1e0f0e] text-on-background flex flex-col font-sans select-none overflow-y-auto no-scrollbar">
      
      {/* Heavy Red ambient pulsing flash behind the screen */}
      <div className="absolute inset-0 bg-[#690006]/15 animate-pulse-slow pointer-events-none" />

      {/* Top Incident Header */}
      <header className="fixed top-0 left-0 right-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#1e0f0e]/50 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-3.5 h-3.5 bg-primary rounded-full animate-ping" />
            <span className="relative w-3.5 h-3.5 bg-primary rounded-full" />
          </div>
          <span className="text-xl font-black text-primary tracking-tight">SOS ACTIVE</span>
        </div>
        <div className="bg-primary/20 px-3 py-1 rounded-full border border-primary/30">
          <span className="text-xs font-black text-primary tracking-wider font-mono">#8821</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mt-16 px-6 pt-6 pb-36 flex flex-col items-center">
        
        {/* Risk Score Circle Gauge */}
        <section className="relative w-60 h-64 flex items-center justify-center mb-4 shrink-0">
          <div className="absolute inset-0 bg-primary/15 blur-[50px] rounded-full" />
          
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
              className="text-primary transition-all duration-1000 ease-out" 
              cx="120" 
              cy="128" 
              fill="transparent" 
              r="90" 
              stroke="currentColor" 
              strokeDasharray="565" 
              strokeDashoffset="45" 
              strokeLinecap="round" 
              strokeWidth="9" 
            />
          </svg>

          {/* Centered Score */}
          <div className="absolute flex flex-col items-center">
            <span className="text-5xl font-black text-primary">92</span>
            <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest mt-1">
              Risk Score
            </span>
          </div>
        </section>

        {/* Waves Audio/Video streaming indicator */}
        <div className="w-full max-w-[280px] flex items-center justify-center gap-1.5 h-14 mb-6">
          {waveHeights.map((h, i) => (
            <div 
              key={i} 
              className="w-1.5 bg-primary rounded-full transition-all duration-150"
              style={{ height: `${h}px` }} 
            />
          ))}
        </div>

        {/* Automated Timeline events status list */}
        <section className="w-full space-y-3.5 max-w-sm">
          
          {timelineIndex >= 1 && (
            <div className="glass-card rounded-2xl p-4 flex items-start gap-4 border border-white/5 animate-in fade-in duration-500">
              <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5 fill-primary text-background" />
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-[15px] text-on-surface leading-snug">Incident Created</h4>
                  <span className="text-xs text-on-surface-variant font-medium font-mono">10:42</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed mt-0.5">
                  Emergency protocol initiated automatically. Secure link initialized.
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
                  <span className="text-xs text-on-surface-variant font-medium font-mono">10:42</span>
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
                  <span className="text-xs text-on-surface-variant font-medium font-mono">10:43</span>
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
            onClick={() => {
              const confirmCancel = window.confirm('Are you absolutely sure you want to cancel the Emergency SOS?');
              if (confirmCancel) {
                onCancelSOS();
              }
            }}
            className="w-full h-14 border border-outline/35 bg-white/5 text-on-surface rounded-xl font-bold text-title-md flex items-center justify-center active:scale-95 transition-transform backdrop-blur-md cursor-pointer hover:bg-white/10"
          >
            Cancel False Alarm
          </button>
        </div>
      </footer>
    </div>
  );
}
