import dotenv from 'dotenv';
import twilio from 'twilio';
import { normalizePhoneNumber, maskPhoneNumber } from '../utils/phoneUtils.js';
import { Incident } from '../models/Incident.model.js';

dotenv.config();

const twilioSid = process.env.TWILIO_SID;
const twilioToken = process.env.TWILIO_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(twilioSid, twilioToken);

export class TwilioService {
  static client = client;

  /**
   * Sends an SOS alert to all registered contacts or a fallback number.
   * @param {Array} contacts - Array of emergency contacts
   * @param {Object} user - The user object triggering the alert
   * @param {Object} incident - The incident object containing location and risk details
   * @returns {Promise<Object>} Structured summary of delivery results
   */
  static async sendSOSAlert(contacts, user, incident) {
    const hasLocation = incident?.latitude !== null && incident?.latitude !== undefined &&
      incident?.longitude !== null && incident?.longitude !== undefined &&
      !isNaN(parseFloat(incident.latitude)) && !isNaN(parseFloat(incident.longitude)) &&
      !(parseFloat(incident.latitude) === 0 && parseFloat(incident.longitude) === 0);

    const locationText = hasLocation
      ? `Location: https://maps.google.com/?q=${incident.latitude},${incident.longitude}.`
      : `Location unavailable — call her directly.`;

    const message = `ALERT: ${user.name} has triggered an SOS event! ${locationText} Live risk level: ${incident.riskScore}%. Please check on them immediately.`;

    // Guard: Do not send SMS if user has no contacts configured.
    // In development mode only, a test recipient can be specified via DEV_TEST_EMERGENCY_PHONE.
    let recipients = contacts;
    if (!recipients || recipients.length === 0) {
      const isDev = process.env.NODE_ENV !== 'production';
      const devTestPhone = process.env.DEV_TEST_EMERGENCY_PHONE;
      if (isDev && devTestPhone) {
        console.log(`[TwilioService] [DEV MODE ONLY] No user contacts. Using DEV_TEST_EMERGENCY_PHONE: ${maskPhoneNumber(devTestPhone)}`);
        recipients = [{ name: 'Dev Test Recipient', phone: devTestPhone }];
      } else {
        console.warn(`[TwilioService] No emergency contacts configured for ${user?.name || 'User'}. SOS SMS alert could not be delivered.`);
        return {
          success: false,
          count: 0,
          totalSent: 0,
          details: [{
            phone: 'N/A',
            name: 'No Contacts Configured',
            success: false,
            errorMessage: 'User has no emergency contacts configured. Alert SMS could not be delivered.'
          }]
        };
      }
    }

    console.log(`[TwilioService] Starting SOS alert broadcast...`);
    console.log(`[TwilioService] From: ${twilioPhoneNumber}`);
    console.log(`[TwilioService] Message: "${message}"`);

    const results = [];

    for (const recipient of recipients) {
      const rawPhone = recipient.phone;
      const normalizedPhone = normalizePhoneNumber(rawPhone);
      const name = recipient.name || 'Emergency Contact';
      const masked = maskPhoneNumber(normalizedPhone || rawPhone);

      if (!normalizedPhone) {
        console.warn(`[TwilioService] Skipping recipient ${name} due to invalid phone: ${rawPhone}`);
        results.push({
          phone: rawPhone || 'N/A',
          name,
          success: false,
          errorMessage: 'Invalid phone number format'
        });
        continue;
      }

      try {
        console.log(`[TwilioService] Sending SMS to recipient: ${name} (${masked})`);

        const twilioClient = this.client || client;
        const response = await twilioClient.messages.create({
          body: message,
          from: twilioPhoneNumber,
          to: normalizedPhone
        });

        console.log(`[TwilioService] SMS recipient: ${name} (${masked})`);
        console.log(`[TwilioService] Twilio Message SID: ${response.sid}`);
        console.log(`[TwilioService] Delivery request status: ${response.status}`);

        results.push({
          phone: normalizedPhone,
          name,
          success: true,
          sid: response.sid,
          status: response.status
        });
      } catch (error) {
        // Log masked recipient phone on failure (only last 4 digits)
        console.error(`[TwilioService] Failed to send SMS to ${name} (${masked})`);
        console.error(`[TwilioService] Twilio error code: ${error.code || 'N/A'}`);
        console.error(`[TwilioService] Twilio error message: ${error.message}`);
        if (error.code === 21608 || error.code === 21210) {
          console.warn(`[TwilioService] [HINT] Twilio trial accounts can only message verified caller IDs. Upgrade your Twilio account to send to arbitrary numbers.`);
        }

        results.push({
          phone: normalizedPhone || rawPhone,
          name,
          success: false,
          errorCode: error.code,
          errorMessage: (error.code === 21608 || error.code === 21210)
            ? `${error.message} (Twilio Trial restriction: recipient unverified)`
            : error.message
        });
      }
    }

    const successfulCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    return {
      success: successfulCount > 0,
      count: successfulCount,
      totalSent: totalCount,
      details: results
    };
  }

  /**
   * Sends a follow-up text with a Google Maps link to contacts once the first real GPS fix arrives.
   * @param {Array} contacts - Array of emergency contacts
   * @param {Object} user - The user object triggering the alert
   * @param {Object} incident - The incident object containing location and risk details
   * @param {Object} coords - Coordinates { latitude, longitude }
   * @returns {Promise<Object>} Structured summary of delivery results
   */
  static async sendLocationFollowUp(contacts, user, incident, { latitude, longitude }) {
    if (!incident?.id) return { success: false, details: [] };

    // Prevent duplicate follow-up SMS for the same incident
    const freshIncident = await Incident.findById(incident.id);
    let existingLogs = [];
    if (Array.isArray(freshIncident?.notificationLogs)) {
      existingLogs = freshIncident.notificationLogs;
    } else if (typeof freshIncident?.notificationLogs === 'string' && freshIncident.notificationLogs.trim()) {
      try {
        existingLogs = JSON.parse(freshIncident.notificationLogs);
      } catch (e) {
        existingLogs = [];
      }
    }

    if (existingLogs.some(l => l.isLocationFollowUp || l.channel === 'sms_followup')) {
      console.log(`[TwilioService] Location follow-up already sent for incident ${incident.id}. Skipping duplicate.`);
      return { success: true, alreadySent: true, details: [] };
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
    const userName = user?.name || 'User';
    const message = `UPDATE: Location now available for ${userName}'s SOS alert: ${mapsLink}. Live risk level: ${incident?.riskScore || 0}%. Please check on them immediately.`;

    let recipients = contacts;
    if (!recipients || recipients.length === 0) {
      recipients = user?.emergencyContacts || [];
    }

    if (!recipients || recipients.length === 0) {
      const isDev = process.env.NODE_ENV !== 'production';
      const devTestPhone = process.env.DEV_TEST_EMERGENCY_PHONE;
      if (isDev && devTestPhone) {
        console.log(`[TwilioService] [DEV MODE ONLY] No user contacts. Using DEV_TEST_EMERGENCY_PHONE for follow-up.`);
        recipients = [{ name: 'Dev Test Recipient', phone: devTestPhone }];
      } else {
        console.warn(`[TwilioService] No emergency contacts configured for ${userName}. Follow-up SMS could not be delivered.`);
        return { success: false, details: [] };
      }
    }

    console.log(`[TwilioService] Starting location follow-up SMS broadcast for incident ${incident.id}...`);
    console.log(`[TwilioService] Follow-up message: "${message}"`);

    const results = [];
    for (const recipient of recipients) {
      const rawPhone = recipient.phone;
      const normalizedPhone = normalizePhoneNumber(rawPhone);
      const name = recipient.name || 'Emergency Contact';
      const masked = maskPhoneNumber(normalizedPhone || rawPhone);

      if (!normalizedPhone) {
        console.warn(`[TwilioService] Skipping follow-up recipient ${name} due to invalid phone: ${rawPhone}`);
        results.push({
          channel: 'sms_followup',
          phone: rawPhone || 'N/A',
          name,
          success: false,
          isLocationFollowUp: true,
          errorMessage: 'Invalid phone number format',
          timestamp: new Date().toISOString()
        });
        continue;
      }

      try {
        console.log(`[TwilioService] Sending follow-up SMS to: ${name} (${masked})`);
        const twilioClient = this.client || client;
        const response = await twilioClient.messages.create({
          body: message,
          from: twilioPhoneNumber,
          to: normalizedPhone
        });

        results.push({
          channel: 'sms_followup',
          phone: normalizedPhone,
          name,
          success: true,
          isLocationFollowUp: true,
          sid: response.sid,
          status: response.status,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error(`[TwilioService] Failed to send follow-up SMS to ${name} (${masked}):`, error.message);
        results.push({
          channel: 'sms_followup',
          phone: normalizedPhone || rawPhone,
          name,
          success: false,
          isLocationFollowUp: true,
          errorCode: error.code,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Persist follow-up outcomes to notification logs
    const updatedLogs = [...existingLogs, ...results];
    try {
      await Incident.update(incident.id, { notificationLogs: updatedLogs });
      incident.notificationLogs = updatedLogs;
    } catch (saveErr) {
      console.error('[TwilioService] Failed to persist follow-up notification logs:', saveErr.message);
    }

    return {
      success: results.some(r => r.success),
      count: results.filter(r => r.success).length,
      details: results
    };
  }
}

