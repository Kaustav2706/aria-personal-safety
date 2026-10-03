import { Incident } from '../models/Incident.model.js';
import { User } from '../models/User.model.js';
import { TwilioService } from '../services/twilioService.js';
import { FirebaseService } from '../services/firebaseService.js';
import { dispatchTieredAlerts } from '../config/alertConfig.js';
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

  // Notify Emergency Contacts and Police Dispatch via tiered thresholds
  await dispatchTieredAlerts({ user, incident });

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

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({
      success: false,
      message: 'Invalid coordinates provided',
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
  if (String(incident.userId) !== String(req.userId)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not own this incident.',
      error: 'Forbidden'
    });
  }

  // Reject updates for incidents that are already resolved
  if (incident.status === 'resolved') {
    return res.status(400).json({
      success: false,
      message: 'Incident is already resolved',
      error: 'Bad Request'
    });
  }

  // Plausibility check — reject physically impossible jumps
  const MAX_SPEED_KMH = 250;
  let prevLat = parseFloat(incident.latitude);
  let prevLng = parseFloat(incident.longitude);
  let lastUpdated = incident.createdAt ? new Date(incident.createdAt) : null;

  const history = await Incident.getLocationHistory(incidentId);
  if (history && history.length > 0) {
    const lastFix = history[history.length - 1];
    if (lastFix.latitude !== undefined && lastFix.longitude !== undefined) {
      prevLat = parseFloat(lastFix.latitude);
      prevLng = parseFloat(lastFix.longitude);
    }
    if (lastFix.timestamp) {
      lastUpdated = new Date(lastFix.timestamp);
    }
  }

  if (
    lastUpdated &&
    !isNaN(prevLat) &&
    !isNaN(prevLng) &&
    !(prevLat === 0 && prevLng === 0) &&
    !(lat === 0 && lng === 0)
  ) {
    const R = 6371; // Earth radius km
    const dLat = ((lat - prevLat) * Math.PI) / 180;
    const dLng = ((lng - prevLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((prevLat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (distanceKm >= 0.05) {
      const elapsedMs = Date.now() - lastUpdated.getTime();
      const elapsedHours = elapsedMs > 0 ? elapsedMs / 3_600_000 : 0;
      const impliedSpeedKmh = elapsedHours > 0 ? distanceKm / elapsedHours : Infinity;

      if (impliedSpeedKmh > MAX_SPEED_KMH) {
        return res.status(400).json({
          success: false,
          message: 'Position rejected: movement speed is not physically plausible',
          error: 'Bad Request'
        });
      }
    }
  }

  // Update incident and automatically log to location_history
  const updated = await Incident.update(incidentId, {
    latitude: lat,
    longitude: lng
  });

  // Emit updates to WebSockets
  const io = req.app.get('io');
  if (io) {
    io.to(incidentId).emit('locationUpdate', {
      incidentId,
      latitude: lat,
      longitude: lng,
      riskScore: updated.riskScore,
      timestamp: new Date().toISOString()
    });

    io.to('dispatchers').emit('globalLocationUpdate', {
      incidentId,
      latitude: lat,
      longitude: lng,
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
