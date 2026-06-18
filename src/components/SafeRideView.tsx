import React, { useState } from 'react';
import { Shield, Bell, Phone, Star, AlertTriangle, AlertCircle, Trash } from 'lucide-react';

interface SafeRideProps {
  onTriggerSOS: () => void;
}

export default function SafeRideView({ onTriggerSOS }: SafeRideProps) {
  const [showAlert, setShowAlert] = useState(true);

  return (
    <div className="pt-20 pb-36 px-6 font-sans select-none">
      
      {/* Top Banner Warning Overlay simulation toggle helper */}
      {showAlert && (
        <div className="glass-card mb-4 p-4 rounded-xl border border-primary/25 bg-primary/5 flex items-start justify-between animate-in slide-in-from-top duration-300">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-body-sm font-bold text-primary">Unplanned Route Change Detected</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                The vehicle has deviated from the typical route. ARIA is conducting distress checks.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowAlert(false)}
            className="text-on-surface-variant hover:text-white text-xs font-bold pl-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Map Section */}
      <section className="relative w-full h-[220px] rounded-xl overflow-hidden glass-card shadow-lg mb-4">
        {/* Map visual */}
        <img 
          className="w-full h-full object-cover opacity-60" 
          src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=600" 
          alt="Dark map grid overlay" 
        />
        
        {/* Safe navigation paths drawing */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />

        {/* Floating Indicator over map */}
        <div className="absolute top-4 left-4 glass-card px-3 py-1.5 rounded-full flex items-center gap-2 border-white/10">
          <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">
            Route Safety Monitor: Active
          </span>
        </div>

        {/* Warning Indicator Over Map (Visual mimic of images) */}
        {showAlert && (
          <div className="absolute bottom-4 left-4 right-4 glass-card border-primary/45 bg-primary/10 px-4 py-3 rounded-lg flex items-center gap-3 animate-bounce">
            <AlertTriangle className="w-5 h-5 text-primary animate-pulse" />
            <div>
              <p className="text-[11px] font-extrabold text-primary uppercase tracking-wide">Unplanned Route Change</p>
              <p className="text-[10px] text-on-surface-variant font-medium">Are you still on your planned journey?</p>
            </div>
          </div>
        )}
      </section>

      {/* Trip Status Card Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="glass-card p-4 rounded-xl text-center flex flex-col justify-center border-white/5">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">ETA</p>
          <h3 className="text-xl font-bold text-primary">8 mins</h3>
        </div>
        <div className="glass-card p-4 rounded-xl text-center flex flex-col justify-center border-white/5">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">Distance</p>
          <h3 className="text-xl font-bold text-on-surface">2.4 km</h3>
        </div>
      </div>

      {/* Driver / Vehicle Card */}
      <div className="glass-card p-5 rounded-2xl space-y-4 border border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden border border-primary/20 shrink-0">
              <img 
                className="w-full h-full object-cover" 
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200" 
                alt="Marcus Chen Driver portrait" 
              />
            </div>
            <div>
              <h4 className="text-body-lg font-bold text-on-surface">Marcus Chen</h4>
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                <span className="text-xs font-semibold text-on-surface-variant">4.9 stars</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => alert('Dialing Marcus Chen via Private encrypted proxy...')}
            className="w-11 h-11 rounded-full glass-card flex items-center justify-center text-secondary active:scale-90 transition-transform cursor-pointer"
          >
            <Phone className="w-5 h-5 text-secondary" />
          </button>
        </div>

        <div className="pt-4 border-t border-outline-variant/20 flex justify-between items-center text-xs">
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Vehicle</p>
            <p className="text-body-sm font-bold text-white/95 mt-0.5">Toyota Camry (Black)</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Plate</p>
            <p className="text-body-sm font-bold text-primary bg-surface-container-highest/60 px-2 py-0.5 rounded border border-outline-variant inline-block mt-0.5">
              AR-8821
            </p>
          </div>
        </div>
      </div>

      {/* Safety Actions */}
      <div className="space-y-4 pt-6">
        <button 
          onClick={() => {
            alert('Suspicious behavior logged. Local AI dispatcher monitoring has been elevated.');
          }}
          className="w-full h-12 border border-outline text-on-surface hover:bg-white/5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-transform flex items-center justify-center gap-2 cursor-pointer"
        >
          <AlertTriangle className="w-4 h-4 text-primary" />
          Report Suspicious Activity
        </button>

        {/* Central Pulse Emergency Trigger Button */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <button 
            onClick={onTriggerSOS}
            className="w-20 h-24 rounded-full bg-primary-container text-white flex items-center justify-center sos-glow active:scale-90 transition-transform cursor-pointer animate-pulse"
          >
            <AlertCircle className="w-10 h-10 text-white" />
          </button>
          <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
            TAP TO FORCE INSTANT SOS
          </span>
        </div>
      </div>

    </div>
  );
}
