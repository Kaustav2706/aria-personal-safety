import path from 'path';
import crypto from 'crypto';
import { StorageService } from './storageService.js';

const ALLOWED_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.mp4', '.ogg', '.webm']);

export class AudioEvidenceService {
  static async save(file) {
    if (!file?.buffer?.length) return null;

    const originalExtension = path.extname(file.originalname || '').toLowerCase();
    const extension = ALLOWED_EXTENSIONS.has(originalExtension) ? originalExtension : '.webm';
    const fileName = `${crypto.randomUUID()}${extension}`;

    return await StorageService.uploadEvidence(fileName, file.buffer, file.mimetype || 'audio/webm');
  }
}

export default AudioEvidenceService;
