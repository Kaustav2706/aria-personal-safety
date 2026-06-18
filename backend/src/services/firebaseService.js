import admin from '../config/firebase.js';
import { getMessaging } from 'firebase-admin/messaging';

// Compatibility layer for admin.messaging() in modern firebase-admin versions under ESM
if (typeof admin.messaging !== 'function') {
  admin.messaging = () => getMessaging();
}

export class FirebaseService {
  static async sendPoliceBroadcast(incident) {
    const message = {
      topic: 'police_emergency_channel',
      notification: {
        title: `CRITICAL THREAT TRIGGERED (Risk: ${incident.riskScore}%)`,
        body: `A new emergency alert has been logged with trigger type: ${incident.triggerType}. Location: ${incident.latitude}, ${incident.longitude}`,
      },
      data: {
        incidentId: String(incident.id),
        latitude: String(incident.latitude),
        longitude: String(incident.longitude),
        riskScore: String(incident.riskScore),
        triggerType: String(incident.triggerType),
      }
    };

    try {
      const messageId = await admin.messaging().send(message);

      console.log('Firebase Message ID:', messageId);
      console.log('Topic Name: police_emergency_channel');
      console.log('Payload:', JSON.stringify(message, null, 2));

      return {
        success: true,
        messageId
      };
    } catch (error) {
      console.error('Firebase messaging error:', error);
      return {
        success: false,
        error
      };
    }
  }
}
