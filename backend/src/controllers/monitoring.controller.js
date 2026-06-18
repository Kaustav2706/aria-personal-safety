import { Incident } from '../models/Incident.model.js';
import { User } from '../models/User.model.js';
import { MonitoringSession } from '../models/MonitoringSession.model.js';
import { AIService } from '../services/aiService.js';
import { TwilioService } from '../services/twilioService.js';
import { TwilioVoiceService } from '../services/twilioVoiceService.js';
import { FirebaseService } from '../services/firebaseService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { pool, dbMode } from '../config/db.js';

// ── In-memory cooldown tracker ──────────────────────────────────────────────
// Tracks the last auto-incident creation timestamp per user to enforce a
// 5-minute cooldown window, preventing duplicate incidents from rapid chunks.
const INCIDENT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const lastAutoIncidentMap = new Map();

/**
 * Checks whether a user is within the incident cooldown window.
 * Also checks the database for recent incidents as a secondary guard.
 * @param {string} userId
 * @returns {Promise<boolean>} true if still in cooldown (should NOT create incident)
 */
async function isInCooldown(userId) {
  // Check in-memory cooldown first (fast path)
  const lastCreated = lastAutoIncidentMap.get(userId);
  if (lastCreated && (Date.now() - lastCreated) < INCIDENT_COOLDOWN_MS) {
    return true;
  }

  // Secondary check: query the database for recent incidents from this user
  try {
    if (dbMode === 'postgres') {
      const res = await pool.query(
        `SELECT id FROM incidents 
         WHERE user_id = $1 AND trigger_type = 'monitoring' 
         AND created_at > NOW() - INTERVAL '5 minutes' 
         LIMIT 1`,
        [userId]
      );
      if (res.rows.length > 0) {
        // Sync the in-memory tracker
        lastAutoIncidentMap.set(userId, Date.now());
        return true;
      }
    }
  } catch (err) {
    // If DB check fails, rely on in-memory tracker only
    console.warn('[MONITORING] DB cooldown check failed, using in-memory only:', err.message);
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/monitoring/chunk
// Accepts a short audio chunk, runs AI analysis, and auto-creates an
// incident if thresholds are met (with 5-minute per-user cooldown).
// ═══════════════════════════════════════════════════════════════════════════
export const analyzeChunk = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { latitude, longitude, isIsolated, timestamp, sessionId } = req.body;

  console.log(`[MONITORING] Chunk received from user ${userId} at ${timestamp || new Date().toISOString()}`);

  // 1. Validate audio file presence
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Audio file is required. Send as multipart/form-data with field name "file".',
      error: 'Bad Request'
    });
  }

  // 2. Touch session activity if sessionId is provided
  if (sessionId) {
    try {
      await MonitoringSession.updateActivity(sessionId);
    } catch (err) {
      console.warn(`[MONITORING] Failed to update session activity for ${sessionId}:`, err.message);
    }
  }

  // 3. Reuse existing AIService — DO NOT create a second AI implementation
  console.log(`[MONITORING] Dispatching audio to AIService.analyzeAudioIncident(): ${req.file.originalname}`);
  
  const analysis = await AIService.analyzeAudioIncident({
    fileBuffer: req.file.buffer,
    fileName: req.file.originalname,
    latitude: parseFloat(latitude) || 0.0,
    longitude: parseFloat(longitude) || 0.0,
    isIsolated: isIsolated === 'true' || isIsolated === true
  });

  const { distress, confidence, transcript, riskScore } = analysis;

  console.log(`[MONITORING] Analysis complete — User: ${userId} | Risk: ${riskScore} | Distress: ${distress} | Confidence: ${confidence}`);

  // 4. Determine if auto-incident creation should be triggered
  //    Thresholds: riskScore >= 80 OR (distress === true AND confidence >= 85)
  const shouldTrigger = riskScore >= 80 || (distress === true && confidence >= 85);
  let autoIncident = null;

  if (shouldTrigger) {
    console.log(`[MONITORING] Threat threshold met for user ${userId}. Checking cooldown...`);

    const cooldownActive = await isInCooldown(userId);

    if (cooldownActive) {
      console.log(`[MONITORING] Cooldown active for user ${userId}. Skipping auto-incident creation (last incident < 5 minutes ago).`);
    } else {
      console.log(`[MONITORING] Creating auto-incident for user ${userId}...`);

      // Record cooldown timestamp BEFORE async work to prevent race conditions
      lastAutoIncidentMap.set(userId, Date.now());

      try {
        // Lookup user for notification services
        const user = await User.findById(userId);
        if (!user) {
          console.error(`[MONITORING] User ${userId} not found. Cannot create auto-incident.`);
        } else {
          // ── Reuse existing incident creation flow ──────────────────
          // This mirrors incident.controller.js lines 56-97 exactly,
          // using the same models and services without duplication.

          const incident = await Incident.create({
            userId,
            status: 'active',
            triggerType: 'monitoring',
            latitude: parseFloat(latitude) || 0.0,
            longitude: parseFloat(longitude) || 0.0,
            riskScore,
            audioTranscript: transcript
          });

          console.log(`[MONITORING] Auto-incident created: ${incident.id} (Risk: ${riskScore}%)`);

          // Notify emergency contacts via SMS (reuse TwilioService)
          await TwilioService.sendSOSAlert(user.emergencyContacts, user, incident);

          // Broadcast to police via Firebase FCM (reuse FirebaseService)
          await FirebaseService.sendPoliceBroadcast(incident);

          // Trigger emergency voice calls if risk score meets threshold (reuse TwilioVoiceService)
          if (incident.riskScore >= 60) {
            console.log(`[MONITORING] Risk score (${incident.riskScore}%) >= 60%. Triggering Twilio emergency voice calls.`);
            
            // Call fallback number
            await TwilioVoiceService.makeEmergencyCall('+919983376352', user, incident);

            // Call emergency contacts
            if (user.emergencyContacts && user.emergencyContacts.length > 0) {
              for (const contact of user.emergencyContacts) {
                try {
                  await TwilioVoiceService.makeEmergencyCall(contact.phone, user, incident);
                } catch (callErr) {
                  console.error(`[MONITORING] Failed emergency voice call to ${contact.name} (${contact.phone}):`, callErr.message);
                }
              }
            }
          }

          // Emit live update through Socket.IO (reuse existing io instance)
          const io = req.app.get('io');
          if (io) {
            io.emit('incidentCreated', {
              ...incident,
              userName: user.name,
              userPhone: user.phone
            });
          }

          autoIncident = {
            incidentId: incident.id,
            riskScore: incident.riskScore,
            triggerType: incident.triggerType
          };

          console.log(`[MONITORING] Auto Incident Triggered: YES | Session: ${sessionId || 'N/A'} | User: ${userId} | Risk: ${riskScore} | Distress: ${distress}`);
        }
      } catch (incidentErr) {
        console.error(`[MONITORING] Auto-incident creation failed for user ${userId}:`, incidentErr.message);
        // Do NOT crash — return analysis results even if incident creation fails
      }
    }
  } else {
    console.log(`[MONITORING] No threat detected for user ${userId}. Risk: ${riskScore}, Distress: ${distress}, Confidence: ${confidence}`);
  }

  // 5. Return analysis results
  return res.status(200).json({
    success: true,
    distress,
    confidence,
    transcript,
    riskScore,
    autoIncident
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/monitoring/start
// Creates a new monitoring session for the authenticated user.
// ═══════════════════════════════════════════════════════════════════════════
export const startSession = asyncHandler(async (req, res) => {
  const userId = req.userId;

  console.log(`[MONITORING] Starting monitoring session for user ${userId}`);

  // Check if user already has an active session
  const existingSession = await MonitoringSession.findActiveByUserId(userId);
  if (existingSession) {
    console.log(`[MONITORING] User ${userId} already has active session: ${existingSession.id}`);
    return res.status(200).json({
      success: true,
      message: 'Monitoring session already active.',
      sessionId: existingSession.id,
      session: existingSession
    });
  }

  const session = await MonitoringSession.create(userId);

  console.log(`[MONITORING] Session created: ${session.id} for user ${userId}`);

  return res.status(201).json({
    success: true,
    message: 'Monitoring session started.',
    sessionId: session.id,
    session
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/monitoring/stop
// Marks an existing monitoring session as inactive.
// ═══════════════════════════════════════════════════════════════════════════
export const stopSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  const userId = req.userId;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'sessionId is required in request body.',
      error: 'Bad Request'
    });
  }

  console.log(`[MONITORING] Stopping session ${sessionId} for user ${userId}`);

  const session = await MonitoringSession.findById(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Monitoring session not found.',
      error: 'Not Found'
    });
  }

  if (session.userId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'You do not own this monitoring session.',
      error: 'Forbidden'
    });
  }

  if (session.status === 'inactive') {
    return res.status(200).json({
      success: true,
      message: 'Monitoring session was already stopped.',
      session
    });
  }

  const deactivated = await MonitoringSession.deactivate(sessionId);

  console.log(`[MONITORING] Session ${sessionId} stopped for user ${userId}`);

  return res.status(200).json({
    success: true,
    message: 'Monitoring session stopped.',
    session: deactivated
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/monitoring/status/:sessionId
// Returns the current status of a monitoring session.
// ═══════════════════════════════════════════════════════════════════════════
export const getSessionStatus = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  console.log(`[MONITORING] Status check for session ${sessionId}`);

  const session = await MonitoringSession.findById(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Monitoring session not found.',
      error: 'Not Found'
    });
  }

  return res.status(200).json({
    success: true,
    session
  });
});
