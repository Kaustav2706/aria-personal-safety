import { Router } from 'express';
import { triggerSOS, updateLocation, callEmergencyContact } from '../controllers/alert.controller.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

// POST /api/alerts/sos - Matches exact prefix specifications
router.post('/alerts/sos', authenticateToken, triggerSOS);

// POST /api/alerts/call-contact - Triggers direct emergency voice call via Twilio
router.post('/alerts/call-contact', authenticateToken, callEmergencyContact);

// POST /api/location/update - Matches exact coordinates specification
router.post('/location/update', authenticateToken, updateLocation);

export default router;
