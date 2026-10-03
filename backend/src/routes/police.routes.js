/**
 * Police Dashboard Routes
 *
 * Separate route namespace for the Police Dispatch Dashboard.
 * All incident routes are now protected by policeAuth middleware, which
 * validates a standard JWT token and enforces role='police' — no more
 * shared API key baked into the browser bundle.
 *
 * Dispatchers authenticate via POST /api/auth/login (same endpoint as users)
 * using their police account credentials and send:
 *   Authorization: Bearer <token>
 */

import { Router } from 'express';
import {
  getPoliceIncidents,
  getPoliceIncidentById,
  resolvePoliceIncident,
  generatePoliceReport,
  deletePoliceIncident,
  getPoliceAuditLogs
} from '../controllers/police.controller.js';
import { policeAuth } from '../middleware/policeAuth.js';

const router = Router();

// GET /api/police/incidents — All incidents across all users (dispatcher view)
router.get('/incidents', policeAuth, getPoliceIncidents);

// GET /api/police/audit — Immutable audit trail of dispatcher actions
router.get('/audit', policeAuth, getPoliceAuditLogs);

// GET /api/police/incidents/:id — Single incident detail with user info and audit trail
router.get('/incidents/:id', policeAuth, getPoliceIncidentById);

// PUT /api/police/incidents/:id/resolve — Resolve any incident
router.put('/incidents/:id/resolve', policeAuth, resolvePoliceIncident);

// POST /api/police/report/generate — Generate PDF dossier for any incident
router.post('/report/generate', policeAuth, generatePoliceReport);

// DELETE /api/police/incidents/:id — Permanently delete any incident
router.delete('/incidents/:id', policeAuth, deletePoliceIncident);

export default router;
