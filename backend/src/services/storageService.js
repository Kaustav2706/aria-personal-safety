import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure a local uploads directory exists
const localUploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(localUploadsDir)) {
  fs.mkdirSync(localUploadsDir, { recursive: true });
}

export class StorageService {
  /**
   * Uploads an audio/incident evidence file.
   * If S3 config is missing, falls back to local file system.
   */
  static async uploadEvidence(fileName, fileBuffer, mimeType) {
    console.log(`[STORAGE SERVICE] Request to upload file: ${fileName} (${mimeType})`);

    // S3 integration outline:
    // if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    //   const s3 = new AWS.S3();
    //   const params = { Bucket: process.env.S3_BUCKET_NAME, Key: fileName, Body: fileBuffer, ContentType: mimeType };
    //   const uploadResult = await s3.upload(params).promise();
    //   return uploadResult.Location;
    // }

    // Fallback: Local Storage Stub
    const localPath = path.join(localUploadsDir, fileName);
    fs.writeFileSync(localPath, fileBuffer);
    
    // Return mock file access URL
    const localUrl = `http://localhost:${process.env.PORT || 5000}/uploads/${fileName}`;
    console.log(`[STORAGE SERVICE] File uploaded locally. Access URL: ${localUrl}`);
    return localUrl;
  }
}
