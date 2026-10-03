import { TwilioService } from '../services/twilioService.js';
import { TwilioVoiceService } from '../services/twilioVoiceService.js';
import { FirebaseService } from '../services/firebaseService.js';

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
    policeBroadcasted: false
  };

  console.log(`[ALERT CONFIG] Evaluating tiered alerts for incident ${incident.id}: Score=${score}%, Type=${incident.triggerType}`);
  console.log(`   - Thresholds: SMS>=${sms}%, Voice>=${voiceCall}%, Police>=${police}%`);

  // ── Tier 1: Moderate Score (SMS text message to emergency contacts) ─────
  if (score >= sms || isManual) {
    if (user?.emergencyContacts && user.emergencyContacts.length > 0) {
      console.log(`[ALERT CONFIG] Tier 1 Triggered: Score ${score}% >= ${sms}%. Sending SMS alerts to ${user.emergencyContacts.length} contacts.`);
      try {
        await TwilioService.sendSOSAlert(user.emergencyContacts, user, incident);
        results.smsDispatched = true;
      } catch (err) {
        console.error('[ALERT CONFIG] Error sending SMS alerts:', err.message);
      }
    }
  } else {
    console.log(`[ALERT CONFIG] Tier 1 Skipped: Score ${score}% < ${sms}% (SMS threshold).`);
  }

  // ── Tier 2: High Score (Urgent voice phone calls) ────────────────────────
  if (score >= voiceCall || (isManual && score >= 70)) {
    console.log(`[ALERT CONFIG] Tier 2 Triggered: Score ${score}% >= ${voiceCall}%. Initiating voice calls.`);
    const fallbackNumber = process.env.FALLBACK_EMERGENCY_PHONE || '+919983376352';

    // Call fallback emergency number
    try {
      await TwilioVoiceService.makeEmergencyCall(fallbackNumber, user, incident);
      results.voiceCallsDispatched = true;
    } catch (err) {
      console.error('[ALERT CONFIG] Error making fallback emergency voice call:', err.message);
    }

    // Call individual emergency contacts
    if (user?.emergencyContacts && user.emergencyContacts.length > 0) {
      for (const contact of user.emergencyContacts) {
        try {
          await TwilioVoiceService.makeEmergencyCall(contact.phone, user, incident);
          results.voiceCallsDispatched = true;
        } catch (callErr) {
          console.error(`[ALERT CONFIG] Failed voice call to ${contact.name} (${contact.phone}):`, callErr.message);
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

  return results;
}

export default {
  ALERT_THRESHOLDS,
  getAlertThresholds,
  dispatchTieredAlerts
};
