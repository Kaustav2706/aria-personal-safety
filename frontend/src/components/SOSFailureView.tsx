import React, { useState, useEffect } from 'react';
import { Phone, AlertTriangle, RefreshCw, WifiOff, Wifi, ShieldAlert, X, Radio } from 'lucide-react';
import type { QueuedAlert } from '../services/offlineQueue';

interface SOSFailureViewProps {
  queuedAlert: QueuedAlert | null;
  primaryContactName: string;
  primaryContactPhone?: string;
  isRetrying: boolean;
  onRetryNow: () => void;
  onCancelAlert: () => void;
  onReturnDashboard: () => void;
}

export default function SOSFailureView({
  queuedAlert,
  primaryContactName,
  primaryContactPhone,
  isRetrying,
  onRetryNow,
  onCancelAlert,
  onReturnDashboard,
}: SOSFailureViewProps) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const errorMessage =
    queuedAlert?.lastError ||
    (!isOnline
      ? 'No network connectivity detected. Your device is offline.'
      : 'ARIA emergency dispatch server did not respond. Server down or unreachable.');

  return (
    <div className="fixed inset-0 z-50 bg-[#1e0f0e] text-on-background flex flex-col font-sans select-none overflow-y-auto no-scrollbar">
      {/* Ambient alert glow background */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
        style={{
          background: 'radial-gradient(circle at 50% 20%, rgba(220, 38, 38, 0.25) 0%, rgba(30, 15, 14, 0.95) 75%)',
        }}
      />

      {/* Top Header */}
      <header className="sticky top-0 left-0 right-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#1e0f0e]/80 backdrop-blur-xl border-b border-red-500/20">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="w-3.5 h-3.5 bg-red-500 rounded-full animate-ping absolute" />
            <span className="relative w-3.5 h-3.5 bg-red-500 rounded-full" />
          </div>
          <span className="text-lg font-black text-red-400 tracking-tight">ALERT NOT DELIVERED</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              isOnline
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'Online (Server Unreachable)' : 'Offline'}</span>
          </div>
        </div>
      </header>

      {/* Main Alert Content */}
      <main className="flex-1 max-w-md w-full mx-auto px-6 pt-6 pb-40 flex flex-col items-center relative z-10 space-y-6">
        {/* Urgent Warning Hero Card */}
        <div className="w-full glass-card rounded-2xl p-6 border border-red-500/40 bg-gradient-to-b from-red-950/40 to-background/60 shadow-[0_0_35px_rgba(239,68,68,0.2)] text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-600/20 border-2 border-red-500/50 flex items-center justify-center mx-auto text-red-400 animate-pulse">
            <AlertTriangle className="w-9 h-9" />
          </div>

          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-[11px] font-black uppercase tracking-wider mb-2">
              Status: Not Yet Sent
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight leading-snug">
              Help is NOT on the way yet
            </h2>
            <p className="text-sm text-red-200/90 font-medium mt-2 leading-relaxed">
              The emergency dispatch server could not be reached. Your emergency contacts and police have{' '}
              <strong className="text-white underline decoration-red-500">not</strong> received this alert.
            </p>
          </div>
        </div>

        {/* PRIMARY CALL 112 DIRECT HARDWARE BUTTON */}
        <section className="w-full space-y-3">
          <div className="text-center">
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-300">
              ⚡ Immediate Action (Works With Zero Internet)
            </span>
          </div>

          <a
            href="tel:112"
            id="emergency-call-112-button"
            className="w-full h-18 py-4 px-6 bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white rounded-2xl font-black text-lg flex items-center justify-between shadow-[0_0_30px_rgba(220,38,38,0.45)] transition-all cursor-pointer border border-red-400/40"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Phone className="w-6 h-6 fill-white text-red-600" />
              </div>
              <div className="text-left">
                <div className="text-xl font-black tracking-wide leading-tight">CALL 112 NOW</div>
                <div className="text-xs text-red-100 font-medium">Direct cellular emergency dialler</div>
              </div>
            </div>
            <span className="text-xs uppercase bg-black/30 font-bold px-2.5 py-1 rounded-md">
              Free Call
            </span>
          </a>

          <p className="text-center text-[11px] text-on-surface-variant/70 leading-normal px-2">
            Calling <strong>112</strong> routes directly over the cellular network hardware. It does not require Wi-Fi, cellular data, or server connectivity.
          </p>

          {/* Secondary Contact Direct Call */}
          {primaryContactPhone && (
            <a
              href={`tel:${(() => {
                const clean = primaryContactPhone.replace(/[^\d+]/g, '');
                return clean.startsWith('+') ? clean : (clean.length === 10 ? `+91${clean}` : clean);
              })()}`}
              className="w-full h-14 px-5 bg-surface-container-high hover:bg-surface-container-highest active:scale-[0.98] text-on-surface rounded-xl font-bold text-sm flex items-center justify-between border border-white/10 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-primary" />
                <span>Call Emergency Contact</span>
              </div>
              <span className="text-xs text-primary font-mono">{primaryContactPhone}</span>
            </a>
          )}
        </section>

        {/* What Went Wrong Diagnostic Box */}
        <section className="w-full glass-card rounded-2xl p-4 border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-on-surface-variant">
              What Went Wrong
            </h3>
            <span className="text-[10px] font-mono text-red-400 font-bold">FAILURE DIAGNOSTIC</span>
          </div>

          <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/20 text-xs text-red-200 font-mono break-words leading-relaxed">
            {errorMessage}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-on-surface-variant">
            <div className="p-2.5 rounded-lg bg-surface-container/60 border border-white/5">
              <span className="block text-[10px] uppercase font-bold text-on-surface-variant/60">
                Trigger Type
              </span>
              <span className="font-semibold text-on-surface capitalize">
                {queuedAlert?.triggerType || 'Manual SOS'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-container/60 border border-white/5">
              <span className="block text-[10px] uppercase font-bold text-on-surface-variant/60">
                GPS Position
              </span>
              <span className="font-semibold text-on-surface">
                {queuedAlert?.locationUnavailable
                  ? 'Unavailable'
                  : queuedAlert?.latitude && queuedAlert?.longitude
                  ? `${queuedAlert.latitude.toFixed(3)}, ${queuedAlert.longitude.toFixed(3)}`
                  : 'Cached locally'}
              </span>
            </div>
          </div>
        </section>

        {/* Retry Queue Status Card */}
        <section className="w-full glass-card rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-300">
                Offline Retry Queue Active
              </h3>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono">
              RETRIES: {queuedAlert?.retryCount ?? 0}
            </span>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed">
            Your alert is safely held in device memory. It will automatically re-attempt transmission the second network connectivity is restored.
          </p>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={onRetryNow}
              disabled={isRetrying}
              className={`flex-1 h-12 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isRetrying
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-primary hover:bg-primary-container text-on-primary-container font-black shadow-md active:scale-95'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying Transmission...' : 'Retry Transmission Now'}
            </button>
          </div>
        </section>

        {/* Dismiss / Cancel Alert */}
        <div className="w-full flex items-center justify-between pt-2">
          <button
            onClick={onReturnDashboard}
            className="text-xs text-on-surface-variant hover:text-white underline transition-colors cursor-pointer"
          >
            Return to Dashboard
          </button>
          <button
            onClick={() => setShowConfirmCancel(true)}
            className="text-xs text-red-400 hover:text-red-300 font-semibold transition-colors cursor-pointer"
          >
            Cancel Pending Alert
          </button>
        </div>
      </main>

      {/* Confirmation Modal to Cancel Alert */}
      {showConfirmCancel && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-xs glass-card p-6 border border-white/10 space-y-5 text-center shadow-2xl rounded-2xl">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-400">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                Cancel Pending Alert?
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                This will remove the unsent SOS from the retry queue. No further transmission attempts will be made.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  setShowConfirmCancel(false);
                  onCancelAlert();
                }}
                className="w-full h-12 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Yes, Discard Alert
              </button>
              <button
                onClick={() => setShowConfirmCancel(false)}
                className="w-full h-12 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl font-bold text-xs uppercase tracking-wider border border-white/10 transition-colors cursor-pointer"
              >
                Keep Retrying
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
