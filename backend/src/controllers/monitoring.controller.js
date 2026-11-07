import { Incident } from '../models/Incident.model.js';
import { User } from '../models/User.model.js';
import { MonitoringSession } from '../models/MonitoringSession.model.js';
import { AIService } from '../services/aiService.js';
import { AudioEvidenceService } from '../services/audioEvidenceService.js';
import { StorageService } from '../services/storageService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { get as redisGet, set as redisSet, del as redisDel } from '../config/redis.js';
import { dispatchClaimedIncident } from '../services/pendingIncidentDispatcher.js';
import path from 'path';
import crypto from 'crypto';

// ── Redis-backed cooldown tracker with DB backup ─────────────────────────────
// Reuses an active incident during the 5-minute cooldown window to avoid duplicates
// across multiple server replicas without dropping subsequent high-risk detections.
const INCIDENT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const INCIDENT_COOLDOWN_SECONDS = 5 * 60; // 300 seconds

/**
 * Finds an active monitoring incident for the user within the cooldown window.
 * Checks Redis first for fast multi-server consistency, backed up by the database check.
 * @param {string} userId
 * @returns {Promise<object|null>} incident to reuse, or null if a new one is needed
 */
async function findCooldownIncident(userId) {
  const redisKey = `incident:cooldown:${userId}`;

  // 1. Check Redis first for fast distributed state across servers
  try {
    const cached = await redisGet(redisKey);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      // Ensure the cached incident is genuinely still active in the database!
      const dbInc = await Incident.findById(parsed.id);
      if (dbInc && ['active', 'pending_dispatch', 'dispatching'].includes(dbInc.status)) {
        return dbInc;
      } else {
        // Stale cooldown from resolved or cancelled incident — clear it
        try { await redisDel(redisKey); } catch { }
      }
    }
  } catch (err) {
    console.warn('[MONITORING] Redis cooldown cache lookup failed, falling back to database:', err.message);
  }

  // 2. Database check backing up the cooldown
  const recentCutoff = Date.now() - INCIDENT_COOLDOWN_MS;
  try {
    const incidents = await Incident.findByUserId(userId);
    // Guard covers ALL auto-trigger types so that a frontend-fired "audio"
    // or "motion" SOS within the cooldown window is reused rather than
    // creating a second incident (and a second round of alerts). Bug N7.
    const existing = incidents.find((incident) =>
      ['monitoring', 'audio', 'motion'].includes(incident.triggerType) &&
      ['active', 'pending_dispatch', 'dispatching'].includes(incident.status) &&
      new Date(incident.createdAt).getTime() >= recentCutoff
    ) || null;

    if (existing) {
      // Backfill Redis with remaining TTL so subsequent checks across all server instances hit Redis
      const elapsedSeconds = Math.floor((Date.now() - new Date(existing.createdAt).getTime()) / 1000);
      const remainingSeconds = Math.max(1, INCIDENT_COOLDOWN_SECONDS - elapsedSeconds);
      try {
        await redisSet(redisKey, JSON.stringify({
          id: existing.id,
          riskScore: existing.riskScore,
          triggerType: existing.triggerType,
          createdAt: existing.createdAt
        }), 'EX', remainingSeconds);
      } catch (cacheErr) {
        console.warn('[MONITORING] Failed to backfill Redis cooldown:', cacheErr.message);
      }
      return existing;
    }

    return null;
  } catch (err) {
    console.warn('[MONITORING] Could not check for an active cooldown incident in DB:', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/monitoring/chunk
// Accepts a short audio chunk, runs AI analysis, and auto-creates an
// incident if thresholds are met (reusing an active incident for 5 minutes).
// ═══════════════════════════════════════════════════════════════════════════
export const analyzeChunk = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { latitude, longitude, isIsolated, motionAnomaly, motion_anomaly, timestamp, sessionId, language, location_unavailable, locationUnavailable } = req.body;
  const hasMotionAnomaly = motionAnomaly === 'true' || motionAnomaly === true || motion_anomaly === 'true' || motion_anomaly === true;

  console.log(`[MONITORING] Chunk received from user ${userId} at ${timestamp || new Date().toISOString()}`);

  // 1. Validate audio file presence
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Audio file is required. Send as multipart/form-data with field name "file".',
      error: 'Bad Request'
    });
  }

  // 1a. Resolve the user's preferred language from their profile.
  //     Fall back to the client-supplied hint, then pass nothing so the AI
  //     engine lets Whisper auto-detect — never silently force English.
  let profileLanguage = null;
  try {
    const user = await User.findById(userId);
    if (user && user.language) profileLanguage = user.language;
  } catch (err) {
    console.warn(`[MONITORING] Could not load user profile for language lookup:`, err.message);
  }
  const effectiveLanguage = profileLanguage || language || null;

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
    isIsolated: isIsolated === 'true' || isIsolated === true,
    motionAnomaly: hasMotionAnomaly,
    language: effectiveLanguage,
    sessionId: sessionId || null,
    timeoutMs: 30000
  });

  const { distress, confidence, transcript, riskScore } = analysis;

  if (!analysis.available || analysis.audioStatus === 'could_not_be_read') {
    return res.status(200).json({
      success: true,
      analysisAvailable: analysis.available,
      audioStatus: analysis.audioStatus || 'unavailable',
      message: analysis.message || 'Audio could not be read. No incident triggered.',
      autoIncident: null
    });
  }

  console.log(`[MONITORING] Analysis complete — User: ${userId} | Risk: ${riskScore} | Distress: ${distress} | Confidence: ${confidence}`);

  // 4. Determine if auto-incident creation should be triggered
  //    Triggers when distress is confirmed (confidence >= 60) OR risk score reaches alert threshold (>= 60)
  const shouldTrigger = (distress === true && confidence >= 60) || riskScore >= 60;
  let autoIncident = null;

  if (shouldTrigger) {
    console.log(`[MONITORING] Threat threshold met for user ${userId}. Checking for an active incident...`);

    const existingIncident = await findCooldownIncident(userId);

    if (existingIncident) {
      autoIncident = {
        id: existingIncident.id,
        incidentId: existingIncident.id,
        riskScore: existingIncident.riskScore,
        triggerType: existingIncident.triggerType,
        status: existingIncident.status,
        dispatchAfter: existingIncident.dispatchAfter,
        audioTranscript: existingIncident.audioTranscript,
        latitude: existingIncident.latitude,
        longitude: existingIncident.longitude,
        reused: true
      };
      console.log(`[MONITORING] Reusing active incident ${existingIncident.id} for high-risk detection.`);
    } else {
      console.log(`[MONITORING] Creating auto-incident for user ${userId}...`);

      try {
        // Lookup user for notification services
        const user = await User.findById(userId);
        if (!user) {
          console.error(`[MONITORING] User ${userId} not found. Cannot create auto-incident.`);
        } else {
          // ── Reuse existing incident creation flow ──────────────────
          // This mirrors incident.controller.js lines 56-97 exactly,
          // using the same models and services without duplication.

          let audioUrl = null;
          if (req.file) {
            try {
              const originalExtension = path.extname(req.file.originalname || '').toLowerCase();
              const extension = ['.wav', '.mp3', '.m4a', '.mp4', '.ogg', '.webm'].includes(originalExtension) ? originalExtension : '.webm';
              const fileName = `${crypto.randomUUID()}${extension}`;
              audioUrl = await StorageService.uploadEvidence(fileName, req.file.buffer, req.file.mimetype || 'audio/webm');
            } catch (err) {
              console.error('[MONITORING] Failed to persist incident audio evidence via StorageService:', err.message);
            }
          }

          const isLocUnavailable = location_unavailable === 'true' || location_unavailable === true ||
            locationUnavailable === 'true' || locationUnavailable === true ||
            latitude === undefined || latitude === null || latitude === '' ||
            (parseFloat(latitude) === 0 && parseFloat(longitude) === 0);

          const incidentLat = isLocUnavailable ? null : (parseFloat(latitude) || null);
          const incidentLng = isLocUnavailable ? null : (parseFloat(longitude) || null);

          const incident = await Incident.create({
            userId,
            status: 'pending_dispatch',
            triggerType: 'monitoring',
            latitude: incidentLat,
            longitude: incidentLng,
            riskScore,
            audioTranscript: transcript,
            audioUrl,
            dispatchAfter: new Date(Date.now() + 15000).toISOString()
          });

          // Set 5-minute cooldown in Redis immediately to guard against duplicate incidents across servers
          try {
            await redisSet(`incident:cooldown:${userId}`, JSON.stringify({
              id: incident.id,
              riskScore: incident.riskScore,
              triggerType: incident.triggerType,
              createdAt: incident.createdAt || new Date().toISOString()
            }), 'EX', INCIDENT_COOLDOWN_SECONDS);
          } catch (cacheErr) {
            console.warn('[MONITORING] Failed to store incident cooldown in Redis:', cacheErr.message);
          }

          console.log(`[MONITORING] Auto-incident created: ${incident.id} (Risk: ${riskScore}%)`);

          autoIncident = {
            id: incident.id,
            incidentId: incident.id,
            riskScore: incident.riskScore,
            triggerType: incident.triggerType,
            audioTranscript: incident.audioTranscript,
            audioUrl: incident.audioUrl,
            status: incident.status,
            dispatchAfter: incident.dispatchAfter,
            latitude: incident.latitude,
            longitude: incident.longitude,
            createdAt: incident.createdAt || new Date().toISOString()
          };

          console.log(`[MONITORING] Auto Incident Triggered: YES | Session: ${sessionId || 'N/A'} | User: ${userId} | Risk: ${riskScore} | Distress: ${distress}`);

          // The durable dispatcher sends alerts after the grace period unless
          // the user cancels this pending incident first.
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
    analysisAvailable: true,
    distress,
    confidence,
    transcript,
    riskScore,
    threatLevel: analysis.threatLevel,
    baseline: analysis.baseline,
    calibrationStatus: analysis.calibrationStatus,
    autoIncident
  });
});

// POST /api/monitoring/incidents/:incidentId/cancel
// Cancels only an AI-created pending incident while its 15-second grace period
// remains open. The database condition serializes this against dispatch claims.
export const cancelPendingIncident = asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const userId = req.userId;
  const cancelled = await Incident.cancelPendingMonitoringIncident(incidentId, userId);

  if (!cancelled) {
    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found.' });
    }
    if (incident.userId !== userId) {
      return res.status(403).json({ success: false, message: 'You do not own this incident.' });
    }
    return res.status(409).json({
      success: false,
      message: incident.status === 'cancelled'
        ? 'This pending alert was already cancelled.'
        : 'The cancellation window has ended; dispatch has started or completed.',
      incident
    });
  }

  try { await redisDel(`incident:cooldown:${userId}`); } catch (err) {
    console.warn('[MONITORING] Could not clear cancelled incident cooldown:', err.message);
  }

  return res.status(200).json({ success: true, message: 'Pending alert cancelled.', incident: cancelled });
});

// POST /api/monitoring/incidents/:incidentId/confirm
// User confirmation bypasses the remaining grace period and dispatches now.
export const confirmPendingIncident = asyncHandler(async (req, res) => {
  const { incidentId } = req.params;
  const userId = req.userId;
  const manualRiskScore = parseInt(process.env.MANUAL_SOS_RISK_SCORE, 10) || 90;
  const claimed = await Incident.confirmPendingMonitoringIncident(incidentId, userId, manualRiskScore);

  if (!claimed) {
    const incident = await Incident.findById(incidentId);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found.' });
    if (incident.userId !== userId) return res.status(403).json({ success: false, message: 'You do not own this incident.' });
    if (incident.status === 'dispatching' || incident.status === 'active') {
      return res.status(202).json({ success: true, message: 'Alert dispatch is already in progress.', incident });
    }
    return res.status(409).json({ success: false, message: 'This pending alert can no longer be confirmed.', incident });
  }

  // This work is claimed durably before returning, so a server restart cannot
  // lose the user's explicit request to send the alert immediately.
  dispatchClaimedIncident(claimed, req.app.get('io'));
  return res.status(202).json({ success: true, message: 'Alert dispatch started.', incident: claimed });
});

// GET /api/monitoring/incidents/:incidentId/status
// Lightweight polling endpoint; does not mint an evidence URL every second.
export const getAutoIncidentStatus = asyncHandler(async (req, res) => {
  const incident = await Incident.findById(req.params.incidentId);
  if (!incident) return res.status(404).json({ success: false, message: 'Incident not found.' });
  if (incident.userId !== req.userId) return res.status(403).json({ success: false, message: 'You do not own this incident.' });

  return res.status(200).json({
    success: true,
    incident: {
      id: incident.id,
      userId: incident.userId,
      status: incident.status,
      triggerType: incident.triggerType,
      riskScore: incident.riskScore,
      audioTranscript: incident.audioTranscript,
      latitude: incident.latitude,
      longitude: incident.longitude,
      createdAt: incident.createdAt,
      dispatchAfter: incident.dispatchAfter
    }
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
  AIService.resetSession(sessionId).catch(() => {});

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
  const userId = req.userId;

  console.log(`[MONITORING] Status check for session ${sessionId}`);

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

  return res.status(200).json({
    success: true,
    session
  });
});
