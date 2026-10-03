import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { buildBackendUrl } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Evidence directory on disk (used for local storage & fallback)
const EVIDENCE_DIR = path.resolve(__dirname, '../../uploads/evidence');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const JWT_SECRET = process.env.JWT_SECRET || 'aria_secure_jwt_secret_key_change_me';
const EVIDENCE_SECRET = crypto.createHash('sha256').update(JWT_SECRET + '_evidence_vault_key').digest();

/**
 * StorageService
 *
 * Secure storage service for safety incident audio evidence clips.
 * - Stores triggering distress clips in AWS S3 with server-side encryption at rest (AES256)
 *   and automatic lifecycle expiry tags.
 * - Falls back to an encrypted local vault (AES-256-GCM) when AWS credentials are not set.
 * - Serves audio evidence to clients and dispatchers strictly through short-lived signed links
 *   (default 15 minutes TTL) rather than public static URLs.
 */
export class StorageService {
  /**
   * Check if AWS S3 credentials and bucket are configured
   */
  static isS3Configured() {
    return Boolean(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      (process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET)
    );
  }

  static getS3Config() {
    return {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      bucket: process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1'
    };
  }

  /**
   * Upload an evidence audio clip.
   *
   * @param {string} fileName - Destination file name (e.g. uuid.webm)
   * @param {Buffer} fileBuffer - Audio file binary buffer
   * @param {string} mimeType - Audio mime type (e.g. audio/webm)
   * @returns {Promise<string>} Canonical evidence link/reference stored on incident record
   */
  static async uploadEvidence(fileName, fileBuffer, mimeType = 'audio/webm') {
    if (!fileName || !fileBuffer || !fileBuffer.length) {
      throw new Error('Invalid file payload for evidence storage');
    }

    console.log(`[STORAGE SERVICE] Storing incident evidence clip: ${fileName} (${mimeType}, ${fileBuffer.length} bytes)`);

    // ── 1. AWS S3 Upload (when configured) ──────────────────────────────────
    if (this.isS3Configured()) {
      const config = this.getS3Config();
      const s3Key = `evidence/${fileName}`;
      console.log(`[STORAGE SERVICE] Uploading to AWS S3: s3://${config.bucket}/${s3Key} with AES256 encryption`);

      try {
        await this._uploadToS3({
          bucket: config.bucket,
          key: s3Key,
          buffer: fileBuffer,
          mimeType,
          region: config.region,
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey
        });

        const s3Uri = `s3://${config.bucket}/${s3Key}`;
        console.log(`[STORAGE SERVICE] Evidence safely persisted to S3: ${s3Uri}`);
        return s3Uri;
      } catch (err) {
        console.error('[STORAGE SERVICE] S3 upload failed, falling back to encrypted local vault:', err.message);
      }
    }

    // ── 2. Encrypted Local Vault Fallback ────────────────────────────────────
    // Encrypt at rest using AES-256-GCM so raw distress audio is not exposed on disk
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', EVIDENCE_SECRET, iv);
    const encryptedBuffer = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Store payload: [12-byte IV][16-byte AuthTag][Encrypted data]
    const vaultPayload = Buffer.concat([iv, authTag, encryptedBuffer]);
    const localVaultPath = path.join(EVIDENCE_DIR, `${fileName}.vault`);
    fs.writeFileSync(localVaultPath, vaultPayload);

    // Save metadata for retention / automatic expiry check
    const metaPath = path.join(EVIDENCE_DIR, `${fileName}.meta.json`);
    fs.writeFileSync(
      metaPath,
      JSON.stringify({
        fileName,
        mimeType,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30-day retention
      }),
      'utf-8'
    );

    const canonicalRef = `evidence://${fileName}`;
    console.log(`[STORAGE SERVICE] Evidence safely stored in encrypted local vault: ${canonicalRef}`);
    return canonicalRef;
  }

  /**
   * Generates a short-lived signed link for accessing an evidence recording.
   * Never exposes raw public static URLs to the dashboard or clients.
   *
   * @param {string} storedAudioUrl - Canonical reference stored on the incident record
   * @param {number} expiresInSeconds - Link validity TTL (default 15 minutes = 900s)
   * @returns {Promise<string>} Signed, time-limited playback URL
   */
  static async getSignedUrl(storedAudioUrl, expiresInSeconds = 900) {
    if (!storedAudioUrl) return null;

    // ── Handle S3 Canonical Reference (s3://bucket/key) ─────────────────────
    if (storedAudioUrl.startsWith('s3://') || (this.isS3Configured() && storedAudioUrl.includes('evidence/'))) {
      const config = this.getS3Config();
      let key = storedAudioUrl;
      if (key.startsWith(`s3://${config.bucket}/`)) {
        key = key.replace(`s3://${config.bucket}/`, '');
      } else if (key.startsWith('s3://')) {
        const parts = key.replace('s3://', '').split('/');
        parts.shift(); // remove bucket
        key = parts.join('/');
      } else if (key.startsWith('evidence://')) {
        key = `evidence/${key.replace('evidence://', '')}`;
      }

      return this._generateS3PresignedUrl({
        bucket: config.bucket,
        key,
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        expiresIn: expiresInSeconds
      });
    }

    // ── Handle Local Vault & Legacy Paths ───────────────────────────────────
    // Extract base filename from canonical ref ('evidence://xyz.webm', '/uploads/evidence/xyz.webm', etc.)
    let baseFileName = storedAudioUrl;
    if (baseFileName.startsWith('evidence://')) {
      baseFileName = baseFileName.replace('evidence://', '');
    } else if (baseFileName.includes('/')) {
      baseFileName = path.basename(baseFileName);
    }

    // Generate tamper-proof signed JWT access token with expiration
    const token = jwt.sign(
      {
        file: baseFileName,
        purpose: 'evidence_playback',
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds
      },
      JWT_SECRET
    );

    const signedPlaybackUrl = `/api/evidence/stream?token=${encodeURIComponent(token)}`;
    return signedPlaybackUrl;
  }

  /**
   * Verifies a signed playback token and returns the decrypted audio stream / buffer.
   *
   * @param {string} token - Signed playback token from query params
   * @returns {{ buffer: Buffer, mimeType: string }} Decrypted audio buffer and mime type
   */
  static verifyAndRetrieveEvidence(token) {
    if (!token) {
      throw new Error('Missing signed evidence token');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      throw new Error('Invalid or expired evidence signed link');
    }

    if (decoded.purpose !== 'evidence_playback' || !decoded.file) {
      throw new Error('Unauthorized evidence access token');
    }

    const fileName = path.basename(decoded.file);
    const vaultPath = path.join(EVIDENCE_DIR, `${fileName}.vault`);
    const plainPath = path.join(EVIDENCE_DIR, fileName);

    let mimeType = 'audio/webm';
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.wav') mimeType = 'audio/wav';
    else if (ext === '.mp3') mimeType = 'audio/mpeg';
    else if (ext === '.m4a') mimeType = 'audio/mp4';
    else if (ext === '.ogg') mimeType = 'audio/ogg';

    // 1. Try reading from encrypted vault
    if (fs.existsSync(vaultPath)) {
      const vaultData = fs.readFileSync(vaultPath);
      const iv = vaultData.subarray(0, 12);
      const authTag = vaultData.subarray(12, 28);
      const encrypted = vaultData.subarray(28);

      const decipher = crypto.createDecipheriv('aes-256-gcm', EVIDENCE_SECRET, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      return { buffer: decrypted, mimeType };
    }

    // 2. Fallback to unencrypted local legacy file if exists
    if (fs.existsSync(plainPath)) {
      const buffer = fs.readFileSync(plainPath);
      return { buffer, mimeType };
    }

    throw new Error('Evidence audio file not found on server');
  }

  // ── AWS SigV4 Presigner & S3 Helpers ─────────────────────────────────────

  static _generateS3PresignedUrl({ bucket, key, region, accessKeyId, secretAccessKey, expiresIn = 900 }) {
    const host = `${bucket}.s3.${region}.amazonaws.com`;
    const endpoint = `https://${host}/${key}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const canonicalQuerystring = [
      `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
      `X-Amz-Credential=${encodeURIComponent(`${accessKeyId}/${credentialScope}`)}`,
      `X-Amz-Date=${amzDate}`,
      `X-Amz-Expires=${expiresIn}`,
      `X-Amz-SignedHeaders=host`
    ].sort().join('&');

    const canonicalRequest = [
      'GET',
      `/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
      canonicalQuerystring,
      `host:${host}\n`,
      'host',
      'UNSIGNED-PAYLOAD'
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    const kDate = crypto.createHmac('sha256', 'AWS4' + secretAccessKey).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    const signingKey = crypto.createHmac('sha256', kService).update('aws4_request').digest();

    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    return `${endpoint}?${canonicalQuerystring}&X-Amz-Signature=${signature}`;
  }

  static _uploadToS3({ bucket, key, buffer, mimeType, region, accessKeyId, secretAccessKey }) {
    return new Promise((resolve, reject) => {
      const host = `${bucket}.s3.${region}.amazonaws.com`;
      const pathUrl = `/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStamp = amzDate.substring(0, 8);

      const payloadHash = crypto.createHash('sha256').update(buffer).digest('hex');
      const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

      const headers = {
        'Host': host,
        'Content-Type': mimeType,
        'Content-Length': buffer.length,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        'x-amz-server-side-encryption': 'AES256',
        'x-amz-tagging': 'Type=IncidentEvidence&Retention=30d'
      };

      const signedHeaders = Object.keys(headers)
        .map(h => h.toLowerCase())
        .sort()
        .join(';');

      const canonicalHeaders = Object.keys(headers)
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .map(h => `${h.toLowerCase()}:${String(headers[h]).trim()}\n`)
        .join('');

      const canonicalRequest = [
        'PUT',
        pathUrl,
        '',
        canonicalHeaders,
        signedHeaders,
        payloadHash
      ].join('\n');

      const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        crypto.createHash('sha256').update(canonicalRequest).digest('hex')
      ].join('\n');

      const kDate = crypto.createHmac('sha256', 'AWS4' + secretAccessKey).update(dateStamp).digest();
      const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
      const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
      const signingKey = crypto.createHmac('sha256', kService).update('aws4_request').digest();
      const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

      const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

      const req = https.request(
        {
          hostname: host,
          port: 443,
          path: pathUrl,
          method: 'PUT',
          headers: {
            ...headers,
            'Authorization': authorization
          }
        },
        (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            let errorBody = '';
            res.on('data', chunk => { errorBody += chunk; });
            res.on('end', () => {
              reject(new Error(`S3 PUT failed with status ${res.statusCode}: ${errorBody}`));
            });
          }
        }
      );

      req.on('error', reject);
      req.write(buffer);
      req.end();
    });
  }
}

export default StorageService;
