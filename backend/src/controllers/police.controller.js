/**
 * Police Dashboard Controller
 * 
 * Provides dispatch-level access to ALL incidents without user ownership filtering.
 * Protected by X-Police-API-Key middleware instead of JWT auth.
 * 
 * This is a temporary dispatcher access layer until full RBAC is implemented.
 */

import { Incident } from '../models/Incident.model.js';
import { User } from '../models/User.model.js';
import { ReportService } from '../services/reportService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { pool, dbMode } from '../config/db.js';

/**
 * GET /api/police/incidents
 * Returns ALL incidents across all users (dispatcher view).
 */
export const getPoliceIncidents = asyncHandler(async (req, res) => {
  const list = await Incident.findAll();

  const enrichedList = await Promise.all(list.map(async (inc) => {
    const user = await User.findById(inc.userId);
    return {
      ...inc,
      userName: user ? user.name : 'Unknown User',
      userPhone: user ? user.phone : 'N/A'
    };
  }));

  return res.status(200).json({
    success: true,
    incidents: enrichedList
  });
});

/**
 * GET /api/police/incidents/:id
 * Returns a single incident with user details and location history.
 * No ownership check — dispatchers can view any incident.
 */
export const getPoliceIncidentById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const incident = await Incident.findById(id);

  if (!incident) {
    return res.status(404).json({
      success: false,
      message: 'Incident record not found',
      error: 'Not Found'
    });
  }

  const user = await User.findById(incident.userId);
  const history = await Incident.getLocationHistory(id);

  return res.status(200).json({
    success: true,
    incident,
    user: user ? { name: user.name, phone: user.phone, email: user.email, emergencyContacts: user.emergencyContacts } : null,
    locationHistory: history || []
  });
});

/**
 * PUT /api/police/incidents/:id/resolve
 * Allows dispatchers to resolve any incident regardless of ownership.
 */
export const resolvePoliceIncident = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const incident = await Incident.findById(id);

  if (!incident) {
    return res.status(404).json({
      success: false,
      message: 'Incident record not found',
      error: 'Not Found'
    });
  }

  const updated = await Incident.update(id, { status: 'resolved' });

  // Broadcast socket resolution update
  const io = req.app.get('io');
  if (io) {
    io.emit('incidentResolved', { incidentId: id });
  }

  return res.status(200).json({
    success: true,
    message: 'Incident closed and resolved by dispatcher.',
    incident: updated
  });
});

/**
 * POST /api/police/report/generate
 * Generates a PDF incident dossier for any incident.
 * No ownership check — dispatchers can generate reports for any incident.
 */
export const generatePoliceReport = asyncHandler(async (req, res) => {
  const { incidentId } = req.body;
  if (!incidentId) {
    return res.status(400).json({
      success: false,
      message: 'Missing incidentId in body request',
      error: 'Bad Request'
    });
  }

  const incident = await Incident.findById(incidentId);
  if (!incident) {
    return res.status(404).json({
      success: false,
      message: 'Incident record not found',
      error: 'Not Found'
    });
  }

  const user = await User.findById(incident.userId);
  const pdfUrl = await ReportService.generateIncidentPDF(incident, user);

  // Store report metadata in db
  try {
    if (dbMode === 'postgres') {
      await pool.query(
        `INSERT INTO reports (incident_id, report_url) VALUES ($1, $2) 
         ON CONFLICT (incident_id) DO UPDATE SET report_url = $2`,
        [incidentId, pdfUrl]
      );
    }
  } catch (err) {
    console.error('[REPORT METADATA DB SAVE ERROR]:', err.message);
  }

  return res.status(200).json({
    success: true,
    message: 'Incident report generated successfully.',
    reportUrl: pdfUrl
  });
});
