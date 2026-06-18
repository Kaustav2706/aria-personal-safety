import admin from 'firebase-admin';
import fs from 'fs';

let serviceAccount = null;
const serviceAccountPath = './firebase-service-account.json';

try {
  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  }
} catch (error) {
  console.error('🔴 [FIREBASE] Error reading firebase-service-account.json:', error);
}

if (serviceAccount) {
  if (!admin.getApps().length) {
    admin.initializeApp({
      credential: admin.cert(serviceAccount)
    });
    console.log('💚 [FIREBASE] Firebase Admin SDK initialized successfully.');
  }
} else {
  console.warn('⚠️ [FIREBASE] Firebase Admin SDK not initialized (missing firebase-service-account.json). Messaging will fail.');
}

export default admin;