import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(
    fs.readFileSync('./firebase-service-account.json', 'utf8')
);

if (!admin.getApps().length) {
    admin.initializeApp({
        credential: admin.cert(serviceAccount)
    });
}

export default admin;