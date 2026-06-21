import admin from 'firebase-admin';

let serviceAccount = null;

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

if (projectId && clientEmail && (privateKeyBase64 || privateKeyRaw)) {
  try {
    let privateKey = privateKeyRaw;
    if (!privateKey && privateKeyBase64) {
      privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
    }
    
    // Normalize newlines in private key if they were escaped as raw "\n" strings
    if (privateKey && !privateKey.includes('\n') && privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    serviceAccount = {
      projectId,
      clientEmail,
      privateKey
    };
  } catch (error) {
    console.error('🔴 [FIREBASE] Error parsing or decoding Firebase private key:', error.message);
  }
}

if (serviceAccount) {
  try {
    if (!admin.getApps().length) {
      admin.initializeApp({
        credential: admin.cert(serviceAccount)
      });
      console.log('💚 [FIREBASE] Firebase Admin SDK initialized successfully from environment variables.');
    }
  } catch (error) {
    console.error('🔴 [FIREBASE] Firebase Admin SDK initialization failed (possibly invalid credential formats):', error.message);
  }
} else {
  console.warn('⚠️ [FIREBASE] Firebase Admin SDK not initialized (missing environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and/or FIREBASE_PRIVATE_KEY_BASE64). Messaging will fail.');
}

export default admin;