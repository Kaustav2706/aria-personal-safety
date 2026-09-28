import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure a local uploads directory exists for fallback
const localUploadsDir = path.join(__dirname, '../../uploads/evidence');
if (!fs.existsSync(localUploadsDir)) {
  fs.mkdirSync(localUploadsDir, { recursive: true });
}

export class StorageService {
  /**
   * Uploads an audio/incident evidence file.
   * If S3 credentials exist (process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET_ACCESS_KEY, process.env.S3_BUCKET_NAME),
   * uploads to S3 with AES256 server-side encryption at rest.
   * Otherwise falls back to local uploads filesystem.
   *
   * @param {string} fileName Original filename
   * @param {Buffer} fileBuffer File content buffer
   * @param {string} mimeType MIME type (e.g. 'audio/wav', 'audio/mp3')
   * @returns {Promise<string>} Storage location identifier/URI
   */
  static async uploadEvidence(fileName, fileBuffer, mimeType = 'audio/wav') {
    const safeName = path.basename(fileName || 'evidence.wav').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const uniqueFileName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safeName}`;

    console.log(`[STORAGE SERVICE] Uploading evidence file: ${fileName} -> ${uniqueFileName} (${mimeType})`);

    const hasAwsConfig = process.env.AWS_ACCESS_KEY_ID &&
                         process.env.AWS_SECRET_ACCESS_KEY &&
                         process.env.S3_BUCKET_NAME;

    if (hasAwsConfig) {
      try {
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const region = process.env.AWS_REGION || 'us-east-1';

        const s3Client = new S3Client({
          region,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          }
        });

        const s3Key = `evidence/${uniqueFileName}`;
        const command = new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: mimeType,
          ServerSideEncryption: 'AES256' // Encrypt at rest
        });

        await s3Client.send(command);
        const s3Uri = `s3://${process.env.S3_BUCKET_NAME}/${s3Key}`;
        console.log(`[STORAGE SERVICE] Evidence uploaded to S3 successfully: ${s3Uri} (Encrypted at rest AES256)`);
        return s3Uri;
      } catch (err) {
        console.error(`[STORAGE SERVICE] S3 Upload error, defaulting to local fallback: ${err.message}`);
      }
    }

    // Fallback: Local Storage Stub
    const localPath = path.join(localUploadsDir, uniqueFileName);
    fs.writeFileSync(localPath, fileBuffer);

    const relativeUrl = `/uploads/evidence/${uniqueFileName}`;
    console.log(`[STORAGE SERVICE] Evidence uploaded locally: ${relativeUrl}`);
    return relativeUrl;
  }

  /**
   * Generates a short-lived signed link for accessing an evidence audio file.
   *
   * @param {string} audioUrl Storage URI or relative path saved in incident record
   * @param {number} expiresIn Expiry time in seconds (default 15 minutes = 900s)
   * @returns {Promise<string|null>} Short-lived signed access URL
   */
  static async getSignedUrl(audioUrl, expiresIn = 900) {
    if (!audioUrl) return null;

    const hasAwsConfig = process.env.AWS_ACCESS_KEY_ID &&
                         process.env.AWS_SECRET_ACCESS_KEY &&
                         process.env.S3_BUCKET_NAME;

    if (audioUrl.startsWith('s3://') || (hasAwsConfig && !audioUrl.startsWith('http') && !audioUrl.startsWith('/uploads'))) {
      try {
        const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

        const region = process.env.AWS_REGION || 'us-east-1';
        const s3Client = new S3Client({
          region,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          }
        });

        let bucket = process.env.S3_BUCKET_NAME;
        let key = audioUrl;

        if (audioUrl.startsWith('s3://')) {
          const parts = audioUrl.replace('s3://', '').split('/');
          bucket = parts[0];
          key = parts.slice(1).join('/');
        }

        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: key
        });

        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
        return presignedUrl;
      } catch (err) {
        console.error(`[STORAGE SERVICE] Failed generating presigned S3 URL: ${err.message}`);
      }
    }

    // Local signed URL fallback
    const host = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
    const cleanPath = audioUrl.startsWith('/') ? audioUrl : `/${audioUrl}`;

    // Add short-lived expiration and signature token
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    const secret = process.env.JWT_SECRET || 'aria_local_storage_secret';
    const signature = crypto.createHmac('sha256', secret).update(`${cleanPath}:${expiresAt}`).digest('hex').substring(0, 16);

    return `${host}${cleanPath}?expires=${expiresAt}&sig=${signature}`;
  }
}

export default StorageService;
