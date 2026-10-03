/**
 * Police Dashboard Controller
 * 
 * Provides dispatch-level access to ALL incidents without user ownership filtering.
 * Protected by policeAuth JWT middleware (role='police' required).
 */

import { Incident } from '../models/Incident.model.js';
import { User } from '../models/User.model.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { ReportService } from '../services/reportService.js';
import { StorageService } from '../services/storageService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { pool, dbMode, memoryStore, saveMemoryStore } from '../config/db.js';

/**
 * GET /api/police/incidents
 * Returns ALL incidents across all users (dispatcher view).
 */
export const getPoliceIncidents = asyncHandler(async (req, res) => {
  const list = await Incident.findAll();

  const enrichedList = await Promise.all(list.map(async (inc) => {
    const user = await User.findById(inc.userId);
    let signedAudioUrl = inc.audioUrl;
    if (inc.audioUrl) {
      signedAudioUrl = await StorageService.getSignedUrl(inc.audioUrl);
    }
    return {
      ...inc,
      audioUrl: signedAudioUrl,
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
 * Returns a single incident with user details, location history, and audit log.
 * Records an immutable audit log entry for the viewing officer.
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

  // ── Audit Entry: Officer opened/viewed this incident file ──────────────────
  await AuditLog.record({
    userId: req.userId,
    action: 'viewed',
    incidentId: id,
    details: {
      status: incident.status,
      riskScore: incident.riskScore
    },
    ipAddress: req.ip || req.socket?.remoteAddress || null
  });

  const user = await User.findById(incident.userId);
  const history = await Incident.getLocationHistory(id);
  const auditLogs = await AuditLog.findByIncidentId(id);

  let signedAudioUrl = incident.audioUrl;
  if (incident.audioUrl) {
    signedAudioUrl = await StorageService.getSignedUrl(incident.audioUrl);
  }

  return res.status(200).json({
    success: true,
    incident: {
      ...incident,
      audioUrl: signedAudioUrl
    },
    user: user ? { name: user.name, phone: user.phone, email: user.email, emergencyContacts: user.emergencyContacts } : null,
    locationHistory: history || [],
    auditLogs: auditLogs || []
  });
});

/**
 * PUT /api/police/incidents/:id/resolve
 * Allows dispatchers to resolve any incident regardless of ownership.
 * Records an immutable audit log entry for the resolving officer.
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

  // ── Audit Entry: Officer resolved/closed this incident ─────────────────────
  await AuditLog.record({
    userId: req.userId,
    action: 'resolved',
    incidentId: id,
    details: {
      previousStatus: incident.status,
      newStatus: 'resolved'
    },
    ipAddress: req.ip || req.socket?.remoteAddress || null
  });

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
 * Records an immutable audit log entry for the report generation.
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
  const pdfUrl = await ReportService.generateIncidentPDF(incident, user, { req });

  // Store report metadata in db
  try {
    if (dbMode === 'postgres') {
      await pool.query(
        `INSERT INTO reports (incident_id, report_url) VALUES ($1, $2) 
         ON CONFLICT (incident_id) DO UPDATE SET report_url = $2`,
        [incidentId, pdfUrl]
      );
    } else if (dbMode === 'memory') {
      if (!memoryStore.reports) memoryStore.reports = [];
      const existing = memoryStore.reports.find(r => r.incidentId === incidentId);
      if (existing) {
        existing.reportUrl = pdfUrl;
      } else {
        memoryStore.reports.push({ incidentId, reportUrl: pdfUrl, createdAt: new Date().toISOString() });
      }
      saveMemoryStore();
    }
  } catch (err) {
    console.error('[REPORT METADATA DB SAVE ERROR]:', err.message);
  }

  // ── Audit Entry: Officer generated incident PDF dossier ────────────────────
  await AuditLog.record({
    userId: req.userId,
    action: 'report_generated',
    incidentId: incidentId,
    details: {
      reportUrl: pdfUrl
    },
    ipAddress: req.ip || req.socket?.remoteAddress || null
  });

  return res.status(200).json({
    success: true,
    message: 'Incident report generated successfully.',
    reportUrl: pdfUrl
  });
});

/**
 * DELETE /api/police/incidents/:id
 * Permanently deletes an incident and all associated data.
 * Records an immutable audit log entry before deletion.
 */
export const deletePoliceIncident = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const incident = await Incident.findById(id);

  if (!incident) {
    return res.status(404).json({
      success: false,
      message: 'Incident record not found',
      error: 'Not Found'
    });
  }

  // ── Audit Entry: Record deletion audit trail BEFORE deleting ───────────────
  await AuditLog.record({
    userId: req.userId,
    action: 'deleted',
    incidentId: id,
    details: {
      triggerType: incident.triggerType,
      riskScore: incident.riskScore,
      status: incident.status
    },
    ipAddress: req.ip || req.socket?.remoteAddress || null
  });

  const deleted = await Incident.delete(id);

  // Broadcast deletion so all dashboard tabs update live
  const io = req.app.get('io');
  if (io) {
    io.to('dispatchers').emit('incidentDeleted', { incidentId: id });
  }

  return res.status(200).json({
    success: true,
    message: 'Incident record permanently deleted.',
    deleted
  });
});

/**
 * GET /api/police/audit
 * Returns dispatcher audit trail entries (who viewed, resolved, generated reports).
 * Supports optional ?incidentId=... query filter.
 */
export const getPoliceAuditLogs = asyncHandler(async (req, res) => {
  const { incidentId, limit, offset } = req.query;
  let logs;
  if (incidentId) {
    logs = await AuditLog.findByIncidentId(incidentId);
  } else {
    logs = await AuditLog.findAll({
      limit: parseInt(limit, 10) || 100,
      offset: parseInt(offset, 10) || 0
    });
  }

  return res.status(200).json({
    success: true,
    auditLogs: logs
  });
});
