import { Incident } from '../models/Incident.model.js';
import { User } from '../models/User.model.js';
import { TwilioService } from '../services/twilioService.js';
import { TwilioVoiceService } from '../services/twilioVoiceService.js';
import { FirebaseService } from '../services/firebaseService.js';
import { ReportService } from '../services/reportService.js';
import { AIService } from '../services/aiService.js';
import { StorageService } from '../services/storageService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { pool, dbMode } from '../config/db.js';

export const createIncident = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { latitude, longitude, triggerType, isIsolated } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User registration details not found.',
      error: 'Not Found'
    });
  }

  let finalTranscript = '';
  let finalRiskScore = 50;
  let audioUrl = null;
  
  if (req.file) {
    console.log(`[INCIDENT CONTROLLER] Audio file received: ${req.file.originalname}`);
    const analysis = await AIService.analyzeAudioIncident({
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      latitude: parseFloat(latitude) || 0.0,
      longitude: parseFloat(longitude) || 0.0,
      isIsolated: isIsolated === 'true' || isIsolated === true
    });

    finalTranscript = analysis.transcript;
    finalRiskScore = analysis.riskScore;

    try {
      audioUrl = await StorageService.uploadEvidence(
        req.file.originalname,
        req.file.buffer,
        req.file.mimetype || 'audio/wav'
      );
    } catch (storageErr) {
      console.error('[INCIDENT CONTROLLER] StorageService upload failed:', storageErr.message);
    }
  } else {
    let calculatedScore = 50;
    if (triggerType === 'manual') {
      calculatedScore = 78 + Math.floor(Math.random() * 5);
    }
    if (triggerType === 'audio') calculatedScore = 70;
    if (triggerType === 'motion') calculatedScore = 65;

    const currentHour = new Date().getHours();
    if (currentHour >= 20 || currentHour < 5) calculatedScore += 10;
    if (isIsolated === 'true' || isIsolated === true) calculatedScore += 10;

    finalRiskScore = Math.min(calculatedScore, 100);
    finalTranscript = req.body.audioTranscript || '';
    if (req.body.audioUrl) {
      audioUrl = req.body.audioUrl;
    }
  }

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

  const signedAudioUrl = incident.audioUrl ? await StorageService.getSignedUrl(incident.audioUrl) : null;
  const incidentResponse = {
    ...incident,
    audioUrl: signedAudioUrl
  };

  await TwilioService.sendSOSAlert(user.emergencyContacts, user, incidentResponse);
  await FirebaseService.sendPoliceBroadcast(incidentResponse);

  if (incident.riskScore >= 60) {
    console.log(`[INCIDENT CONTROLLER] Risk score (${incident.riskScore}%) >= 60%. Triggering Twilio emergency voice calls.`);
    await TwilioVoiceService.makeEmergencyCall('+919983376352', user, incidentResponse);
    if (user.emergencyContacts && user.emergencyContacts.length > 0) {
      for (const contact of user.emergencyContacts) {
        try {
          await TwilioVoiceService.makeEmergencyCall(contact.phone, user, incidentResponse);
        } catch (callErr) {
          console.error(`[INCIDENT CONTROLLER] Failed emergency voice call sequence to ${contact.name} (${contact.phone}):`, callErr.message);
        }
      }
    }
  }

  const io = req.app.get('io');
  if (io) {
    io.emit('incidentCreated', {
      ...incidentResponse,
      userName: user.name,
      userPhone: user.phone
    });
  }

  return res.status(201).json({
    success: true,
    message: 'Incident registered and safety protocols deployed',
    incident: incidentResponse
  });
});

export const getIncidents = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const list = await Incident.findByUserId(userId);
  
  const enrichedList = await Promise.all(list.map(async (inc) => {
    const user = await User.findById(inc.userId);
    const signedAudioUrl = inc.audioUrl ? await StorageService.getSignedUrl(inc.audioUrl) : null;
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

  if (incident.userId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not own this incident.',
      error: 'Forbidden'
    });
  }

  const user = await User.findById(incident.userId);
  const history = await Incident.getLocationHistory(id);
  const signedAudioUrl = incident.audioUrl ? await StorageService.getSignedUrl(incident.audioUrl) : null;

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

  if (incident.userId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not own this incident.',
      error: 'Forbidden'
    });
  }

  const updated = await Incident.update(id, { status: 'resolved' });

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

  if (incident.userId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not own this incident.',
      error: 'Forbidden'
    });
  }

  const user = await User.findById(incident.userId);
  const pdfUrl = await ReportService.generateIncidentPDF(incident, user);

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

export const deleteIncident = asyncHandler(async (req, res) => {
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