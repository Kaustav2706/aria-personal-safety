import dotenv from 'dotenv';
import twilio from 'twilio';

dotenv.config();

const twilioSid = process.env.TWILIO_SID;
const twilioToken = process.env.TWILIO_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(twilioSid, twilioToken);

export class TwilioService {
  /**
   * Sends an SOS alert to all registered contacts or a fallback number.
   * @param {Array} contacts - Array of emergency contacts
   * @param {Object} user - The user object triggering the alert
   * @param {Object} incident - The incident object containing location and risk details
   * @returns {Promise<Object>} Structured summary of delivery results
   */
  static async sendSOSAlert(contacts, user, incident) {
    const message = `ALERT: ${user.name} has triggered an SOS event! Location: https://maps.google.com/?q=${incident.latitude},${incident.longitude}. Live risk level: ${incident.riskScore}%. Please check on them immediately.`;

    const recipients = (!contacts || contacts.length === 0)
      ? [{ name: 'Fallback Test Recipient', phone: '+919983376352' }]
      : contacts;

    console.log(`[TwilioService] Starting SOS alert broadcast...`);
    console.log(`[TwilioService] From: ${twilioPhoneNumber}`);
    console.log(`[TwilioService] Message: "${message}"`);

    const results = [];

    for (const recipient of recipients) {
      const phone = recipient.phone;
      const name = recipient.name || 'Emergency Contact';
      
      try {
        console.log(`[TwilioService] Sending SMS to recipient: ${name} (${phone})`);
        
        const response = await client.messages.create({
          body: message,
          from: twilioPhoneNumber,
          to: phone
        });

        console.log(`[TwilioService] SMS recipient: ${name} (${phone})`);
        console.log(`[TwilioService] Twilio Message SID: ${response.sid}`);
        console.log(`[TwilioService] Delivery request status: ${response.status}`);

        results.push({
          phone,
          name,
          success: true,
          sid: response.sid,
          status: response.status
        });
      } catch (error) {
        console.error(`[TwilioService] Failed to send SMS to ${name} (${phone})`);
        console.error(`[TwilioService] Twilio error code: ${error.code || 'N/A'}`);
        console.error(`[TwilioService] Twilio error message: ${error.message}`);

        results.push({
          phone,
          name,
          success: false,
          errorCode: error.code,
          errorMessage: error.message
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
}
