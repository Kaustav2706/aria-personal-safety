import { Incident } from '../models/Incident.model.js';
import { User } from '../models/User.model.js';
import { TwilioService } from '../services/twilioService.js';
import { FirebaseService } from '../services/firebaseService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const triggerSOS = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { latitude, longitude, triggerType, riskScore, audioTranscript } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User profile not found',
      error: 'Not Found'
    });
  }

  // Insert to PostgreSQL
  const incident = await Incident.create({
    userId,
    status: 'active',
    triggerType: triggerType || 'manual',
    latitude: parseFloat(latitude) || 0.0,
    longitude: parseFloat(longitude) || 0.0,
    riskScore: riskScore || 85, // Default SOS score high risk
    audioTranscript: audioTranscript || ''
  });

  // Notify Emergency Contacts and Police Dispatch
  await TwilioService.sendSOSAlert(user.emergencyContacts, user, incident);
  await FirebaseService.sendPoliceBroadcast(incident);

  // Emit websocket update
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
    message: 'SOS trigger processed and emergency alerts dispatched',
    incident
  });
});

export const updateLocation = asyncHandler(async (req, res) => {
  const { incidentId, latitude, longitude, riskScore } = req.body;

  if (!incidentId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Missing required location fields (incidentId, latitude, longitude)',
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

  // Update incident and automatically log to location_history
  const updated = await Incident.update(incidentId, {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    ...(riskScore !== undefined && { riskScore: parseInt(riskScore) })
  });

  // Emit updates to WebSockets
  const io = req.app.get('io');
  if (io) {
    io.to(incidentId).emit('locationUpdate', {
      incidentId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      riskScore: updated.riskScore,
      timestamp: new Date().toISOString()
    });

    io.emit('globalLocationUpdate', {
      incidentId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      riskScore: updated.riskScore
    });
  }

  return res.status(200).json({
    success: true,
    message: 'GPS location coordinates updated',
    incident: updated
  });
});
export default { triggerSOS, updateLocation };
