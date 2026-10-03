import { Router } from 'express';
import { StorageService } from '../services/storageService.js';

const router = Router();

/**
 * GET /api/evidence/stream?token=<signedToken>
 *
 * Secure streaming endpoint for audio evidence recordings.
 * Verifies short-lived signed link tokens to protect victim privacy.
 * Direct unauthenticated static file downloads are forbidden.
 */
router.get('/stream', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied: signed evidence token required',
      error: 'Unauthorized'
    });
  }

  try {
    const { buffer, mimeType } = StorageService.verifyAndRetrieveEvidence(token);

    // Support HTTP Range requests for audio scrubbing in dashboard player
    const range = req.headers.range;
    const totalLength = buffer.length;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;
      const chunkSize = (end - start) + 1;

      const subBuffer = buffer.subarray(start, end + 1);

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalLength}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate'
      });
      return res.end(subBuffer);
    }

    res.writeHead(200, {
      'Content-Length': totalLength,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-cache, no-store, must-revalidate'
    });

    return res.end(buffer);
  } catch (err) {
    console.warn(`[EVIDENCE ROUTE] Rejected stream request:`, err.message);
    return res.status(403).json({
      success: false,
      message: err.message || 'Evidence link expired or unauthorized',
      error: 'Forbidden'
    });
  }
});

export default router;
