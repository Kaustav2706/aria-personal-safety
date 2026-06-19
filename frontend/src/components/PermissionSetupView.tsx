import React, { useState } from 'react';
import { ArrowLeft, HelpCircle, Shield, Mic, MapPin, Bell, ChevronRight, Check } from 'lucide-react';

interface PermissionsProps {
  onNext: () => void;
  onBack: () => void;
}

export default function PermissionSetupView({ onNext, onBack }: PermissionsProps) {
  const [mic, setMic] = useState(false);
  const [location, setLocation] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [allSuccess, setAllSuccess] = useState(false);

  const handleEnableAll = () => {
    setMic(true);
    setLocation(true);
    setNotifications(true);
    setAllSuccess(true);

    setTimeout(() => {
      onNext();
    }, 1200);
  };

  return (
    <div className="relative min-h-screen bg-background text-on-background flex flex-col font-sans select-none pb-28">
      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-surface/80 backdrop-blur-xl border-b border-white/10 shadow-sm">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-primary active:scale-95 duration-200 cursor-pointer p-1"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black text-primary tracking-tighter">ARIA</h1>
        <div className="w-10 h-10 rounded-full glass-card flex items-center justify-center cursor-pointer active:scale-95 duration-200">
          <HelpCircle className="w-5 h-5 text-primary" />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mt-16 px-6 pt-6 pb-20 space-y-6 max-w-md mx-auto w-full overflow-y-auto no-scrollbar">
        
        {/* Hero Section */}
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
            <div className="relative w-full h-full glass-card rounded-full flex items-center justify-center border-primary/30">
              <Shield className="w-10 h-10 text-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-on-surface leading-tight mb-2">Ready to protect you</h2>
          <p className="text-on-surface-variant text-body-sm max-w-[280px] mx-auto leading-relaxed">
            To provide real-time safety monitoring, ARIA requires a few essential permissions.
          </p>
        </div>

        {/* Permissions stack */}
        <div className="space-y-4">
          
          {/* Microphone */}
          <div className="glass-card rounded-2xl p-5 flex flex-col gap-3 border border-white/5 transition-all">
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center shrink-0">
                <Mic className="w-6 h-6 text-primary" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-semibold text-on-surface text-[17px]">Microphone</h3>
                <p className="text-on-surface-variant text-body-sm leading-relaxed mt-1">
                  Voice distress detection uses AI to listen for help signals during active monitoring sessions.
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-1">
              <span className="text-on-surface-variant text-label-md uppercase tracking-wider">Required for AI detection</span>
              <button 
                onClick={() => setMic(!mic)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${mic ? 'bg-primary-container/60' : 'bg-surface-container-highest'}`}
              >
                <span 
                  className={`inline-block h-5 w-5 transform rounded-full transition-transform duration-200 ${mic ? 'translate-x-6 bg-primary' : 'translate-x-1 bg-outline'}`} 
                />
              </button>
            </div>
          </div>

          {/* Location */}
          <div className="glass-card rounded-2xl p-5 flex flex-col gap-3 border border-white/5 transition-all">
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-xl bg-secondary-container/20 flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6 text-secondary" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-semibold text-on-surface text-[17px]">Location</h3>
                <p className="text-on-surface-variant text-body-sm leading-relaxed mt-1">
                  Precision GPS allows emergency responders to locate you instantly when an SOS is triggered.
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-1">
              <span className="text-on-surface-variant text-label-md uppercase tracking-wider">Required for responders</span>
              <button 
                onClick={() => setLocation(!location)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${location ? 'bg-primary-container/60' : 'bg-surface-container-highest'}`}
              >
                <span 
                  className={`inline-block h-5 w-5 transform rounded-full transition-transform duration-200 ${location ? 'translate-x-6 bg-primary' : 'translate-x-1 bg-outline'}`} 
                />
              </button>
            </div>
          </div>

          {/* Notifications */}
          <div className="glass-card rounded-2xl p-5 flex flex-col gap-3 border border-white/5 transition-all">
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-xl bg-tertiary-container/20 flex items-center justify-center shrink-0">
                <Bell className="w-6 h-6 text-tertiary" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-semibold text-on-surface text-[17px]">Notifications</h3>
                <p className="text-on-surface-variant text-body-sm leading-relaxed mt-1">
                  Receive real-time safety alerts, check-in reminders, and updates from your contacts.
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-1">
              <span className="text-on-surface-variant text-label-md uppercase tracking-wider">Stay informed</span>
              <button 
                onClick={() => setNotifications(!notifications)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${notifications ? 'bg-primary-container/60' : 'bg-surface-container-highest'}`}
              >
                <span 
                  className={`inline-block h-5 w-5 transform rounded-full transition-transform duration-200 ${notifications ? 'translate-x-6 bg-primary' : 'translate-x-1 bg-outline'}`} 
                />
              </button>
            </div>
          </div>
        </div>

        {/* Security / Hardware Badge view */}
        <div className="rounded-2xl overflow-hidden glass-card h-28 relative">
          <img 
            alt="Security chip" 
            className="w-full h-full object-cover mix-blend-overlay opacity-30" 
            src="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=400"
          />
          <div className="absolute inset-0 flex items-center px-6">
            <div className="flex flex-col">
              <span className="text-primary font-bold text-label-md uppercase tracking-widest mb-1">
                End-to-End Encryption
              </span>
              <p className="text-on-surface text-[15px] font-semibold leading-none">
                Your data is never shared.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Panel Bottom Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-6 py-6 bg-gradient-to-t from-background via-background/90 to-transparent z-40 border-t border-white/5">
        <button 
          onClick={handleEnableAll}
          className={`w-full h-14 rounded-xl shadow-lg active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 font-bold text-title-md ${
            allSuccess 
              ? 'bg-secondary text-on-secondary' 
              : 'bg-primary-container text-white'
          }`}
        >
          {allSuccess ? (
            <>
              <Check className="w-6 h-6 animate-bounce" />
              All Permissions Enabled
            </>
          ) : (
            <>
              Enable All Permissions
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
        <button 
          onClick={onNext}
          className="w-full mt-3 h-10 text-on-surface-variant font-bold text-label-md uppercase tracking-widest hover:text-white transition-colors"
        >
          I'll do it later
        </button>
      </footer>
    </div>
  );
}
