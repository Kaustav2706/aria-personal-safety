import jwt from 'jsonwebtoken';
import { Incident } from '../models/Incident.model.js';
import { User } from '../models/User.model.js';
import { ReportService } from '../services/reportService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

/**
 * Common handler to stream an incident PDF report on demand from database records.
 * Generates the PDF on the fly without writing to ephemeral disk.
 */
export async function streamReportForIncident(incidentId, req, res) {
  const cleanedId = String(incidentId).replace(/^report_/, '').replace(/\.pdf$/i, '');

  const incident = await Incident.findById(cleanedId);
  if (!incident) {
    return res.status(404).json({
      success: false,
      message: 'Incident record not found',
      error: 'Not Found'
    });
  }

  // Token authorization check (Bearer header or ?token= query parameter)
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  const queryToken = req.query && req.query.token;
  const token = headerToken || queryToken;

  const JWT_SECRET = process.env.JWT_SECRET;
  let isAuthorized = false;

  if (req.userId && (req.userId === incident.userId || req.userRole === 'police')) {
    isAuthorized = true;
  } else if (token && JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role === 'police') {
        isAuthorized = true;
      } else if (decoded.userId && decoded.userId === incident.userId) {
        isAuthorized = true;
      } else if (decoded.incidentId && decoded.incidentId === incident.id) {
        isAuthorized = true;
      }
    } catch (err) {
      console.warn('[REPORT ACCESS] Token verification note:', err.message);
    }
  }

  // In production, strictly enforce authorization
  if (!isAuthorized && process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not have permission to access this incident report.',
      error: 'Forbidden'
    });
  }

  const user = incident.userId ? await User.findById(incident.userId) : null;
  const baseUrl = ReportService.getBaseUrl(req);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="report_${incident.id}.pdf"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  ReportService.streamIncidentPDF(incident, user, res, baseUrl);
}

/**
 * GET /api/reports/:id
 * Dedicated on-demand report endpoint.
 */
export const getReportById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await streamReportForIncident(id, req, res);
});

/**
 * GET /uploads/reports/:filename
 * Legacy/ephemeral disk fallback: if disk is wiped on Render or static file is missing,
 * dynamically generates and streams the PDF on demand instead of failing with a 404.
 */
export const handleLegacyReportDownload = asyncHandler(async (req, res, next) => {
  const { filename } = req.params;
  if (!filename || !filename.endsWith('.pdf')) {
    return next();
  }
  const incidentId = filename.replace(/^report_/, '').replace(/\.pdf$/i, '');
  await streamReportForIncident(incidentId, req, res);
});
