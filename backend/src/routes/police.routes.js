/**
 * Police Dashboard Routes
 * 
 * Separate route namespace for the Police Dispatch Dashboard.
 * Protected by policeAuth middleware (X-Police-API-Key header)
 * instead of JWT user authentication.
 * 
 * These endpoints return ALL incidents without user ownership filtering.
 */

import { Router } from 'express';
import { getPoliceIncidents, getPoliceIncidentById, resolvePoliceIncident, generatePoliceReport } from '../controllers/police.controller.js';
import { policeAuth } from '../middleware/policeAuth.js';

const router = Router();

// GET /api/police/incidents — All incidents across all users
router.get('/incidents', policeAuth, getPoliceIncidents);

// GET /api/police/incidents/:id — Single incident detail with user info
router.get('/incidents/:id', policeAuth, getPoliceIncidentById);

// PUT /api/police/incidents/:id/resolve — Resolve any incident
router.put('/incidents/:id/resolve', policeAuth, resolvePoliceIncident);

// POST /api/police/report/generate — Generate PDF dossier for any incident
router.post('/report/generate', policeAuth, generatePoliceReport);

export default router;
