import React, { useState, useEffect } from 'react';
import { IncidentItem } from '../types';
import { ArrowLeft, Play, Pause, Download, Share2, MapPin, BarChart2, ShieldCheck, CheckCircle } from 'lucide-react';

interface IncidentDetailsProps {
  incident: IncidentItem;
  onBack: () => void;
}

export default function IncidentDetailsView({ incident, onBack }: IncidentDetailsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSeconds, setPlaySeconds] = useState(12);

  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setPlaySeconds((prev) => {
          if (prev >= 105) {
            setIsPlaying(false);
            return 105;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const currentPercent = (playSeconds / 105) * 100;

  return (
    <div className="pt-20 pb-32 px-6 font-sans">
      
      {/* Top back control banner */}
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container active:scale-90 transition-transform cursor-pointer border border-white/5"
        >
          <ArrowLeft className="w-5 h-5 text-primary" />
        </button>
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          Incident Directory / Lookback
        </span>
      </div>

      {/* Main Title Metadata row */}
      <section className="flex flex-col gap-2 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black text-on-surface">{incident.title}</h2>
            <p className="text-xs text-on-surface-variant font-medium mt-0.5">
              {incident.date} • {incident.time}
            </p>
          </div>
          <span className="px-3.5 py-1 bg-primary/10 text-primary border border-primary/25 font-bold text-xs tracking-wider uppercase rounded-full shrink-0 select-none">
            {incident.status}
          </span>
        </div>
      </section>

      {/* Map visual section */}
      <section className="w-full h-56 rounded-2xl overflow-hidden glass-card relative mb-6">
        <div className="absolute inset-0">
          <img 
            className="w-full h-full object-cover grayscale opacity-45 contrast-125 select-none" 
            src={incident.mapImage} 
            alt="Incident satellite context" 
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
        
        {/* Floating coordinates stamp */}
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 bg-surface-container-highest/65 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 select-none">
          <MapPin className="w-4.5 h-4.5 text-secondary animate-pulse" />
          <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">
            {incident.coordinates}
          </span>
        </div>

        {/* Central glowing locator checkmark indicator pin */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 select-none">
          <div className="w-10 h-10 bg-primary/25 rounded-full flex items-center justify-center animate-ping" />
          <div className="w-6 h-6 bg-primary rounded-full absolute top-2 left-2 flex items-center justify-center border-2 border-background shadow-lg shadow-primary/40">
            <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Audio Transcript player snippet card */}
      <section className="glass-card p-5 rounded-2xl flex flex-col gap-4 border border-white/5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-on-surface">
            {/* Pulsing indicator visual lines */}
            <BarChart2 className={`w-5 h-5 text-secondary ${isPlaying ? 'animate-bounce' : ''}`} />
            <h3 className="font-bold text-title-md">Audio Snippet</h3>
          </div>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="text-secondary font-bold text-xs uppercase hover:underline transition-all"
          >
            {isPlaying ? 'Pause Feed' : 'Synthesize Audio'}
          </button>
        </div>

        {/* Highlight quote Transcript box */}
        <div className="bg-surface-container-lowest/80 rounded-xl p-4 border border-white/5 italic text-on-surface-variant text-body-sm leading-relaxed relative">
          {incident.audioSnippet}
          
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="absolute right-4 bottom-4 w-9 h-9 rounded-full bg-secondary text-on-secondary flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
          >
            {isPlaying ? (
              <span className="font-sans text-[11px] font-bold">||</span>
            ) : (
              <span className="pl-0.5 text-lg font-bold">▶</span>
            )}
          </button>
        </div>

        {/* Audiotrack Slider indicator status */}
        <div className="flex items-center gap-3 mt-1">
          <div 
            className="flex-1 h-1 bg-surface-container-highest rounded-full overflow-hidden cursor-pointer" 
            onClick={() => setPlaySeconds(60)}
          >
            <div 
              className="h-full bg-secondary relative transition-all duration-300"
              style={{ width: `${currentPercent}%` }} 
            />
          </div>
          <span className="font-mono text-[10px] text-on-surface-variant font-bold">
            {formatTime(playSeconds)} / {incident.recordingDuration || '1:45'}
          </span>
        </div>
      </section>

      {/* Timelines of events lookback list */}
      <section className="flex flex-col gap-5">
        <h3 className="text-[17px] font-bold text-on-surface uppercase tracking-wider">
          Timeline of Events
        </h3>
        
        {/* Cascade line container */}
        <div className="relative pl-1 border-l-2 border-outline-variant/20 ml-3 space-y-6">
          {incident.timeline.map((evt, idx) => (
            <div key={evt.id} className="relative pl-6">
              
              {/* Central status timeline dot badge icon indicator */}
              <div className="absolute -left-[14px] top-0.5 w-6 h-6 rounded-full bg-surface-container-highest border border-white/10 flex items-center justify-center shadow-lg">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  evt.type === 'critical' 
                    ? 'bg-primary shadow-[0_0_8px_#ffb4ac]' 
                    : evt.type === 'sensor' 
                    ? 'bg-secondary' 
                    : 'bg-tertiary'
                }`} />
              </div>

              {/* Text content details */}
              <div className="space-y-1">
                <span className="font-mono text-xs text-primary font-bold">{evt.time}</span>
                <h4 className="font-bold text-on-surface text-[15px]">{evt.title}</h4>
                <p className="text-body-sm text-on-surface-variant leading-relaxed">{evt.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Download / Share action panel buttons */}
      <section className="flex flex-col gap-3.5 pt-4 pb-12">
        <button 
          onClick={() => alert('Download requested: Secure PDF dispatch record.pdf compiled.')}
          className="w-full h-13 bg-primary text-on-primary font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-primary/10 text-xs uppercase tracking-wider"
        >
          <Download className="w-4 h-4" />
          Download Incident Report
        </button>
        <button 
          onClick={() => alert('Incident link securely broadcasted to emergency contact group.')}
          className="w-full h-13 border-2 border-secondary text-secondary font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-secondary/15 active:scale-[0.98] transition-all cursor-pointer text-xs uppercase tracking-wider"
        >
          <Share2 className="w-4 h-4" />
          Share with Emergency Contacts
        </button>
      </section>

    </div>
  );
}

// Utility dur format helper helper
function incidentItemDuration(item: IncidentItem) {
  return item.recordingDuration || '1:45';
}
