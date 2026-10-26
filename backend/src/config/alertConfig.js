import { TwilioService } from '../services/twilioService.js';
import { TwilioVoiceService } from '../services/twilioVoiceService.js';
import { FirebaseService } from '../services/firebaseService.js';
import { Incident } from '../models/Incident.model.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ALERT ESCALATION THRESHOLDS CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Defines tiered response thresholds to prevent alarm fatigue and false positives:
 * - SMS Tier (Moderate): Dispatches SMS text alerts to emergency contacts.
 * - Voice Call Tier (High): Triggers automated emergency voice phone calls.
 * - Police Tier (Critical): Broadcasts emergency dossier to police dispatch.
 *
 * All thresholds can be tuned from pilot data via environment variables
 * without redeploying code.
 */
export const ALERT_THRESHOLDS = {
  // Moderate tier: SMS text message dispatched to emergency contacts
  SMS: parseInt(process.env.ALERT_SMS_THRESHOLD, 10) || 50,

  // High tier: Automated phone call to emergency contacts
  VOICE_CALL: parseInt(process.env.ALERT_VOICE_CALL_THRESHOLD, 10) || 75,

  // Critical tier: Police dispatch broadcast via Firebase FCM
  POLICE: parseInt(process.env.ALERT_POLICE_THRESHOLD, 10) || 85
};

export function getAlertThresholds() {
  return {
    sms: parseInt(process.env.ALERT_SMS_THRESHOLD, 10) || 50,
    voiceCall: parseInt(process.env.ALERT_VOICE_CALL_THRESHOLD, 10) || 75,
    police: parseInt(process.env.ALERT_POLICE_THRESHOLD, 10) || 85
  };
}

/**
 * Dispatches emergency alerts according to strict risk score tiers.
 *
 * @param {object} params
 * @param {object} params.user - Victim user object containing emergencyContacts
 * @param {object} params.incident - Incident record with riskScore and triggerType
 * @returns {Promise<{ smsDispatched: boolean, voiceCallsDispatched: boolean, policeBroadcasted: boolean }>}
 */
export async function dispatchTieredAlerts({ user, incident }) {
  const { sms, voiceCall, police } = getAlertThresholds();
  const score = parseInt(incident.riskScore, 10) || 0;
  const isManual = incident.triggerType === 'manual';

  const results = {
    smsDispatched: false,
    voiceCallsDispatched: false,
    policeBroadcasted: false,
    notificationLogs: []
  };

  console.log(`[ALERT CONFIG] Evaluating tiered alerts for incident ${incident.id}: Score=${score}%, Type=${incident.triggerType}`);
  console.log(`   - Thresholds: SMS>=${sms}%, Voice>=${voiceCall}%, Police>=${police}%`);

  // ── Tier 1: Moderate Score (SMS text message to emergency contacts) ─────
  if (score >= sms || isManual) {
    const contacts = user?.emergencyContacts || [];
    console.log(`[ALERT CONFIG] Tier 1 Triggered: Score ${score}% >= ${sms}%. Processing SMS alerts for ${contacts.length} contacts.`);
    try {
      const smsResult = await TwilioService.sendSOSAlert(contacts, user, incident);
      if (smsResult.success) {
        results.smsDispatched = true;
      }
      if (smsResult.details) {
        results.notificationLogs.push(...smsResult.details.map(d => ({
          channel: 'sms',
          name: d.name,
          phone: d.phone,
          success: d.success,
          sid: d.sid,
          status: d.status || (d.success ? 'sent' : 'undelivered'),
          errorCode: d.errorCode,
          errorMessage: d.errorMessage,
          timestamp: new Date().toISOString()
        })));
      }
    } catch (err) {
      console.error('[ALERT CONFIG] Error sending SMS alerts:', err.message);
      results.notificationLogs.push({
        channel: 'sms',
        name: 'SMS Dispatch Error',
        phone: 'N/A',
        success: false,
        status: 'failed',
        errorMessage: err.message,
        timestamp: new Date().toISOString()
      });
    }
  } else {
    console.log(`[ALERT CONFIG] Tier 1 Skipped: Score ${score}% < ${sms}% (SMS threshold).`);
  }

  // ── Tier 2: High Score (Urgent voice phone calls) ────────────────────────
  if (score >= voiceCall || (isManual && score >= 70)) {
    console.log(`[ALERT CONFIG] Tier 2 Triggered: Score ${score}% >= ${voiceCall}%. Initiating voice calls.`);
    const contacts = user?.emergencyContacts || [];
    const isDev = process.env.NODE_ENV === 'development';
    const devTestPhone = process.env.DEV_TEST_EMERGENCY_PHONE;

    let voiceRecipients = contacts;
    if (!voiceRecipients || voiceRecipients.length === 0) {
      if (isDev && devTestPhone) {
        console.log(`[ALERT CONFIG] [DEV MODE ONLY] No user contacts configured. Dialing DEV_TEST_EMERGENCY_PHONE for testing.`);
        voiceRecipients = [{ name: 'Dev Test Recipient', phone: devTestPhone }];
      } else {
        console.warn(`[ALERT CONFIG] No emergency contacts configured for ${user?.name || 'User'}. Voice alert call could not be placed.`);
        results.notificationLogs.push({
          channel: 'voice',
          name: 'No Contacts Configured',
          phone: 'N/A',
          success: false,
          status: 'undelivered',
          errorMessage: 'User has no emergency contacts configured. Voice alert call could not be placed.',
          timestamp: new Date().toISOString()
        });
      }
    }

    if (voiceRecipients && voiceRecipients.length > 0) {
      for (const contact of voiceRecipients) {
        try {
          const call = await TwilioVoiceService.makeEmergencyCall(contact.phone, user, incident);
          if (call.success) {
            results.voiceCallsDispatched = true;
          }
          results.notificationLogs.push({
            channel: 'voice',
            name: contact.name,
            phone: contact.phone,
            success: call.success,
            sid: call.sid,
            status: call.status || (call.success ? 'queued' : 'failed'),
            errorCode: call.errorCode,
            errorMessage: call.error,
            timestamp: new Date().toISOString()
          });
        } catch (callErr) {
          console.error(`[ALERT CONFIG] Failed voice call to ${contact.name} (${contact.phone}):`, callErr.message);
          results.notificationLogs.push({
            channel: 'voice',
            name: contact.name,
            phone: contact.phone,
            success: false,
            status: 'failed',
            errorCode: callErr.code,
            errorMessage: callErr.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  } else {
    console.log(`[ALERT CONFIG] Tier 2 Skipped: Score ${score}% < ${voiceCall}% (Voice call threshold).`);
  }

  // ── Tier 3: Critical Score (Police dispatch broadcast) ───────────────────
  if (score >= police || isManual) {
    console.log(`[ALERT CONFIG] Tier 3 Triggered: Score ${score}% >= ${police}%. Broadcasting to police dispatch.`);
    try {
      await FirebaseService.sendPoliceBroadcast(incident);
      results.policeBroadcasted = true;
    } catch (err) {
      console.error('[ALERT CONFIG] Error broadcasting to police dispatch:', err.message);
    }
  } else {
    console.log(`[ALERT CONFIG] Tier 3 Skipped: Score ${score}% < ${police}% (Police threshold). Protecting dispatch from false alarms.`);
  }

  // Persist delivery outcomes directly on the incident record so every caller gets it for free
  const targetIncidentId = incident?.id || incident?.incidentId;
  if (targetIncidentId && results.notificationLogs && results.notificationLogs.length > 0) {
    try {
      await Incident.update(targetIncidentId, { notificationLogs: results.notificationLogs });
      incident.notificationLogs = results.notificationLogs;
    } catch (saveErr) {
      console.error('[ALERT CONFIG] Failed to persist notification logs:', saveErr.message);
    }
  } else if (incident && results.notificationLogs) {
    incident.notificationLogs = results.notificationLogs;
  }

  return results;
}

export default {
  ALERT_THRESHOLDS,
  getAlertThresholds,
  dispatchTieredAlerts
};
