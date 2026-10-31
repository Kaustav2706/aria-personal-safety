import { Incident } from '../models/Incident.model.js';
import { User } from '../models/User.model.js';
import { dispatchTieredAlerts } from '../config/alertConfig.js';

const POLL_INTERVAL_MS = 1000;
let polling = false;

export async function dispatchClaimedIncident(incident, io) {
  try {
    const user = await User.findById(incident.userId);
    if (!user) throw new Error(`User ${incident.userId} no longer exists`);

    // The row was atomically claimed before entering this function. Delivery
    // is at least once: a crashed worker's stale claim is retried after 5 min.
    await dispatchTieredAlerts({ user, incident, manualConfirmed: incident.manualConfirmed === true });
    const activeIncident = await Incident.completeMonitoringDispatch(incident.id);
    if (activeIncident && io) {
      io.emit('incidentCreated', {
        ...activeIncident,
        userName: user.name,
        userPhone: user.phone
      });
    }
  } catch (err) {
    console.error(`[PENDING ALERTS] Dispatch failed for ${incident.id}; it will be retried:`, err.message);
    try {
      await Incident.releaseMonitoringDispatch(incident.id);
    } catch (releaseErr) {
      console.error(`[PENDING ALERTS] Could not release dispatch claim for ${incident.id}:`, releaseErr.message);
    }
  }
}

async function dispatchDueIncidents(io) {
  if (polling) return;
  polling = true;
  try {
    const dueIncidents = await Incident.claimDueMonitoringIncidents();
    for (const incident of dueIncidents) {
      await dispatchClaimedIncident(incident, io);
    }
  } catch (err) {
    console.error('[PENDING ALERTS] Pending incident poll failed:', err.message);
  } finally {
    polling = false;
  }
}

export function startPendingIncidentDispatcher(io) {
  const timer = setInterval(() => dispatchDueIncidents(io), POLL_INTERVAL_MS);
  timer.unref?.();
  // Process already-due rows after a restart instead of losing the alert.
  dispatchDueIncidents(io);
  return () => clearInterval(timer);
}
