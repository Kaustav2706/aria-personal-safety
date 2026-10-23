import { Router } from 'express';
import multer from 'multer';
import { triggerSOS, updateLocation, callEmergencyContact } from '../controllers/alert.controller.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// POST /api/alerts/sos - Routed through the same function as /incidents/create so endpoints cannot drift apart
router.post('/alerts/sos', authenticateToken, upload.single('file'), triggerSOS);

// POST /api/alerts/call-contact - Triggers direct emergency voice call via Twilio
router.post('/alerts/call-contact', authenticateToken, callEmergencyContact);

// POST /api/location/update - Matches exact coordinates specification
router.post('/location/update', authenticateToken, updateLocation);

export default router;
