import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { monitoringService } from '../services/api';
import type { BackendIncident } from '../types';

interface PendingSOSViewProps {
  incidentId: string;
  dispatchAfter: string;
  onDispatched: (incident: BackendIncident) => void;
  onCancelled: () => void;
}

export default function PendingSOSView({ incidentId, dispatchAfter, onDispatched, onCancelled }: PendingSOSViewProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil((Date.parse(dispatchAfter) - Date.now()) / 1000)));
  const [status, setStatus] = useState('pending_dispatch');
  const [canceling, setCanceling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const finishedRef = useRef(false);

  useEffect(() => {
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((Date.parse(dispatchAfter) - Date.now()) / 1000)));
    update();
    const countdown = window.setInterval(update, 250);
    const poll = window.setInterval(async () => {
      try {
        const response = await monitoringService.getAutoIncidentStatus(incidentId);
        const incident = response.data?.incident;
        if (!incident || finishedRef.current) return;
        setStatus(incident.status);
        if (incident.status === 'active') {
          finishedRef.current = true;
          onDispatched(incident);
        } else if (incident.status === 'cancelled') {
          finishedRef.current = true;
          onCancelled();
        }
        setError('');
      } catch {
        setError('Unable to refresh alert status. The server still controls the cancellation deadline.');
      }
    }, 1000);

    return () => {
      window.clearInterval(countdown);
      window.clearInterval(poll);
    };
  }, [dispatchAfter, incidentId, onCancelled, onDispatched]);

  const cancelAlert = async () => {
    if (canceling || status !== 'pending_dispatch' || secondsLeft <= 0) return;
    setCanceling(true);
    setError('');
    try {
      await monitoringService.cancelPendingIncident(incidentId);
      if (!finishedRef.current) {
        finishedRef.current = true;
        onCancelled();
      }
    } catch (err: any) {
      setStatus(err?.response?.data?.incident?.status || 'dispatching');
      setError(err?.response?.data?.message || 'Could not cancel the alert. Checking its current status…');
    } finally {
      setCanceling(false);
    }
  };

  const sendNow = async () => {
    if (confirming || status !== 'pending_dispatch') return;
    setConfirming(true);
    setError('');
    try {
      await monitoringService.confirmPendingIncident(incidentId);
      setStatus('dispatching');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not confirm dispatch. Checking current alert status…');
    } finally {
      setConfirming(false);
    }
  };

  const canCancel = status === 'pending_dispatch' && secondsLeft > 0;

  return (
    <main className="min-h-screen px-6 pt-24 pb-10 flex items-center justify-center">
      <section className="w-full max-w-md glass-card rounded-3xl p-7 border border-amber-400/20 text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-400/10 flex items-center justify-center">
          {status === 'dispatching' ? <Loader2 className="w-7 h-7 text-amber-300 animate-spin" /> : <AlertTriangle className="w-7 h-7 text-amber-300" />}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Possible emergency detected</p>
          <h1 className="text-2xl font-black text-on-surface">
            {status === 'dispatching' ? 'Sending alert…' : `Dispatch in ${secondsLeft}s`}
          </h1>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {status === 'pending_dispatch'
              ? 'ARIA’s audio analysis detected a possible threat. Emergency contacts and dispatch have not been notified yet. Cancel if this is a false alarm.'
              : 'The cancellation window has ended. The backend is sending the alert now.'}
          </p>
        </div>
        <p className="text-[10px] text-on-surface-variant/50 font-mono">Incident {incidentId}</p>
        {canCancel ? (
          <div className="space-y-2.5">
            <button onClick={sendNow} disabled={confirming} className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-extrabold uppercase tracking-wider flex items-center justify-center gap-2">
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
              {confirming ? 'Sending…' : 'Send SOS now'}
            </button>
            <button onClick={cancelAlert} disabled={canceling || confirming} className="w-full py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-60 text-on-surface font-bold">
              {canceling ? 'Cancelling…' : 'Cancel false alarm'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-amber-200/80">Please keep your phone available while the alert is being sent.</p>
        )}
        {error && <p role="status" className="text-xs text-amber-200">{error}</p>}
      </section>
    </main>
  );
}
