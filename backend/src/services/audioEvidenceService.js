import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIRECTORY = path.resolve(__dirname, '../../uploads/evidence');
const ALLOWED_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.mp4', '.ogg', '.webm']);

export class AudioEvidenceService {
  static async save(file) {
    if (!file?.buffer?.length) return null;

    const originalExtension = path.extname(file.originalname || '').toLowerCase();
    const extension = ALLOWED_EXTENSIONS.has(originalExtension) ? originalExtension : '.webm';
    const fileName = `${crypto.randomUUID()}${extension}`;

    await fs.mkdir(EVIDENCE_DIRECTORY, { recursive: true });
    await fs.writeFile(path.join(EVIDENCE_DIRECTORY, fileName), file.buffer, { flag: 'wx' });
    return `/uploads/evidence/${fileName}`;
  }
}

export default AudioEvidenceService;
