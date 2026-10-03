import { Incident } from '../models/Incident.model.js';
import { User } from '../models/User.model.js';
import { ReportService } from '../services/reportService.js';
import { streamReportForIncident } from './report.controller.js';
import { TwilioService } from '../services/twilioService.js';
import { TwilioVoiceService } from '../services/twilioVoiceService.js';
import { FirebaseService } from '../services/firebaseService.js';
import { AIService } from '../services/aiService.js';
import { AudioEvidenceService } from '../services/audioEvidenceService.js';
import { StorageService } from '../services/storageService.js';
import { dispatchTieredAlerts } from '../config/alertConfig.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { pool, dbMode, memoryStore, saveMemoryStore } from '../config/db.js';
import path from 'path';
import crypto from 'crypto';

export const createIncident = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { latitude, longitude, triggerType, isIsolated, motionAnomaly, motion_anomaly } = req.body;
  const hasMotionAnomaly = motionAnomaly === 'true' || motionAnomaly === true || motion_anomaly === 'true' || motion_anomaly === true;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User registration details not found.',
      error: 'Not Found'
    });
  }

  let finalTranscript = '';
  let finalRiskScore = 50; // default moderate score
  let analysisAvailable = true;
  let audioUrl = null;
  
  // 1. Process voice audio file upload if present
  if (req.file) {
    console.log(`[INCIDENT CONTROLLER] Audio file received: ${req.file.originalname}`);
    const analysis = await AIService.analyzeAudioIncident({
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      latitude: parseFloat(latitude) || 0.0,
      longitude: parseFloat(longitude) || 0.0,
      isIsolated: isIsolated === 'true' || isIsolated === true,
      motionAnomaly: hasMotionAnomaly,
      // Let Whisper identify the spoken language from the recording.
      language: null
    });

    analysisAvailable = analysis.available;
    finalTranscript = analysis.transcript || '';
    if (analysis.available) {
      finalRiskScore = analysis.riskScore;
    } else {
      // A deliberate manual SOS must still alert responders if audio analysis fails.
      let urgentScore = 78 + Math.floor(Math.random() * 5);
      const currentHour = new Date().getHours();
      if (currentHour >= 20 || currentHour < 5) urgentScore += 10;
      if (isIsolated === 'true' || isIsolated === true) urgentScore += 10;
      finalRiskScore = Math.min(urgentScore, 100);
    }
  } else {
    // Basic context calculation if no audio upload was captured
    let calculatedScore = 50;
    if (triggerType === 'manual') {
      // Introduce minor variance (78-82) to avoid a perfectly constant base score
      calculatedScore = 78 + Math.floor(Math.random() * 5);
    }
    if (triggerType === 'audio') calculatedScore = 70;
    if (triggerType === 'motion') calculatedScore = 65;

    const currentHour = new Date().getHours();
    if (currentHour >= 20 || currentHour < 5) calculatedScore += 10;
    if (isIsolated === 'true' || isIsolated === true) calculatedScore += 10;

    finalRiskScore = Math.min(calculatedScore, 100);
    finalTranscript = req.body.audioTranscript || '';
  }

  if (req.file) {
    try {
      const originalExtension = path.extname(req.file.originalname || '').toLowerCase();
      const extension = ['.wav', '.mp3', '.m4a', '.mp4', '.ogg', '.webm'].includes(originalExtension) ? originalExtension : '.webm';
      const fileName = `${crypto.randomUUID()}${extension}`;
      audioUrl = await StorageService.uploadEvidence(fileName, req.file.buffer, req.file.mimetype || 'audio/webm');
    } catch (err) {
      console.error('[INCIDENT CONTROLLER] Failed to persist audio evidence via StorageService:', err.message);
    }
  }

  // 2. Save incident to PostgreSQL
  const incident = await Incident.create({
    userId,
    status: 'active',
    triggerType: triggerType || 'manual',
    latitude: parseFloat(latitude) || 0.0,
    longitude: parseFloat(longitude) || 0.0,
    riskScore: finalRiskScore,
    audioTranscript: finalTranscript,
    audioUrl
  });

  // 3. Notify Emergency Contacts and Police Dispatch via tiered thresholds
  await dispatchTieredAlerts({ user, incident });

  // 4. Emit live update through Sockets
  const io = req.app.get('io');
  if (io) {
    io.emit('incidentCreated', {
      ...incident,
      userName: user.name,
      userPhone: user.phone
    });
  }

  return res.status(201).json({
    success: true,
    message: analysisAvailable ? 'Incident registered and safety protocols deployed' : 'Incident registered. AI analysis unavailable; automatic audio detection is not running.',
    analysisAvailable,
    incident
  });
});

export const getIncidents = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const list = await Incident.findByUserId(userId);
  
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

export const getIncidentById = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const incident = await Incident.findById(id);

  if (!incident) {
    return res.status(404).json({
      success: false,
      message: 'Incident record not found',
      error: 'Not Found'
    });
  }

  // Verify ownership
  if (incident.userId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not own this incident.',
      error: 'Forbidden'
    });
  }

  const user = await User.findById(incident.userId);
  const history = await Incident.getLocationHistory(id);

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
    locationHistory: history || []
  });
});

export const resolveIncident = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const incident = await Incident.findById(id);

  if (!incident) {
    return res.status(404).json({
      success: false,
      message: 'Incident record not found',
      error: 'Not Found'
    });
  }

  // Verify ownership
  if (incident.userId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not own this incident.',
      error: 'Forbidden'
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
    message: 'Incident closed and resolved.',
    incident: updated
  });
});

export const generateReport = asyncHandler(async (req, res) => {
  const userId = req.userId;
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

  // Verify ownership
  if (incident.userId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not own this incident.',
      error: 'Forbidden'
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

  return res.status(200).json({
    success: true,
    message: 'Incident report generated successfully.',
    reportUrl: pdfUrl
  });
});

export const getIncidentReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await streamReportForIncident(id, req, res);
});

export const deleteIncident = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;

  // Find the incident first so we can verify ownership before destroying evidence
  const incident = await Incident.findById(id);

  if (!incident) {
    return res.status(404).json({
      success: false,
      message: 'Incident record not found',
      error: 'Not Found'
    });
  }

  // Ownership check — same pattern as resolveIncident and getIncidentById
  if (incident.userId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not own this incident.',
      error: 'Forbidden'
    });
  }

  await Incident.delete(id);

  return res.status(200).json({
    success: true,
    message: 'Incident deleted successfully.'
  });
});
