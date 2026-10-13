import dotenv from 'dotenv';
import twilio from 'twilio';

dotenv.config();

const twilioSid = process.env.TWILIO_SID;
const twilioToken = process.env.TWILIO_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(twilioSid, twilioToken);

export class TwilioVoiceService {
  /**
   * Triggers an emergency voice call using Twilio.
   * @param {string} phoneNumber - The target recipient phone number.
   * @param {Object} user - The user who triggered the SOS.
   * @param {Object} incident - The incident object containing risk score and location.
   * @returns {Promise<Object>} The result of the Twilio call creation.
   */
  static async makeEmergencyCall(phoneNumber, user, incident) {
    console.log(`[TwilioVoiceService] Preparing emergency voice call...`);

    const safePhone = typeof phoneNumber === 'string' ? phoneNumber : '';
    const masked = safePhone.length >= 4 ? `***${safePhone.slice(-4)}` : '******';

    console.log(`[TwilioVoiceService] Recipient: ${masked}`);
    console.log(`[TwilioVoiceService] User: ${user?.name || 'Unknown'} (ID: ${user?.id || 'N/A'})`);
    console.log(`[TwilioVoiceService] Incident ID: ${incident?.id || 'N/A'} (Risk: ${incident?.riskScore || 0}%)`);

    // Spoken message TwiML construct
    const speakMessage = `Emergency alert from ARIA. A critical threat has been triggered for user ${user?.name || 'Unknown User'}. The threat risk level is ${incident?.riskScore || 0} percent. The trigger type is ${incident?.triggerType || 'unknown'}. The incident location is latitude ${incident?.latitude || 'unknown'}, longitude ${incident?.longitude || 'unknown'}. Please respond immediately.`;

    const twimlContent = `<Response><Say voice="alice" language="en-US">${speakMessage}</Say></Response>`;

    try {
      console.log(`[TwilioVoiceService] Dispatching client.calls.create to: ${masked}`);

      const call = await client.calls.create({
        twiml: twimlContent,
        to: phoneNumber,
        from: twilioPhoneNumber
      });

      console.log(`[TwilioVoiceService] Voice call successfully initiated to ${masked}`);
      console.log(`[TwilioVoiceService] Twilio Call SID: ${call.sid}`);
      console.log(`[TwilioVoiceService] Call Status: ${call.status}`);

      return {
        success: true,
        sid: call.sid,
        status: call.status
      };
    } catch (error) {
      console.error(`[TwilioVoiceService] Emergency voice call to ${masked} failed:`);
      console.error(`[TwilioVoiceService] Twilio error code: ${error.code || 'N/A'}`);
      console.error(`[TwilioVoiceService] Twilio error message: ${error.message}`);
      if (error.code === 21210 || error.code === 21608) {
        console.warn(`[TwilioVoiceService] [HINT] Twilio trial accounts can only call verified caller IDs. Upgrade your Twilio account to call arbitrary numbers.`);
      }

      return {
        success: false,
        error: (error.code === 21210 || error.code === 21608)
          ? `${error.message} (Twilio Trial restriction: recipient unverified)`
          : (error.message || error),
        errorCode: error.code
      };
    }
  }
}

export default TwilioVoiceService;

