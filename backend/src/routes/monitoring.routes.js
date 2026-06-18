import { Router } from 'express';
import multer from 'multer';
import { analyzeChunk, startSession, stopSession, getSessionStatus } from '../controllers/monitoring.controller.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { monitoringRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All monitoring endpoints require JWT authentication (reuse existing middleware)

// POST /api/monitoring/chunk - Upload audio chunk for AI analysis
// Protected by: JWT auth → rate limiter (1 chunk / 3s) → multer file upload
router.post('/chunk', authenticateToken, monitoringRateLimiter, upload.single('file'), analyzeChunk);

// POST /api/monitoring/start - Start a monitoring session
router.post('/start', authenticateToken, startSession);

// POST /api/monitoring/stop - Stop a monitoring session
router.post('/stop', authenticateToken, stopSession);

// GET /api/monitoring/status/:sessionId - Check session status
router.get('/status/:sessionId', authenticateToken, getSessionStatus);

export default router;
