import { Router } from 'express';
import multer from 'multer';
import { createIncident, getIncidents, getIncidentById, resolveIncident, generateReport, deleteIncident } from '../controllers/incident.controller.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/incidents/create - Optional audio multipart upload mapping
router.post('/create', authenticateToken, upload.single('file'), createIncident);

// GET /api/incidents
router.get('/', authenticateToken, getIncidents);

// GET /api/incidents/:id
router.get('/:id', authenticateToken, getIncidentById);

// PUT /api/incidents/:id/resolve
router.put('/:id/resolve', authenticateToken, resolveIncident);

// DELETE /api/incidents/:id
router.delete('/:id', deleteIncident);

// POST /api/report/generate
router.post('/report/generate', authenticateToken, generateReport);

export default router;
