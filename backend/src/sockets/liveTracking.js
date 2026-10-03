import { Incident } from '../models/Incident.model.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'aria_secure_jwt_secret_key_change_me';

export function setupLiveTracking(io) {
  console.log('[SOCKET.IO] Live Tracking system initialized with full acknowledgements.');

  // ── JWT Handshake Middleware ──────────────────────────────────────────────
  // Clients must pass their JWT as: socket.auth = { token: '<jwt>' }
  // or as the Authorization header: authorization: 'Bearer <jwt>'
  // Connection is rejected before any events fire if the token is missing/invalid.
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1] ||
      socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication required: no token provided'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      // Attach verified identity to socket — available in all event handlers
      socket.user = {
        id: decoded.userId,
        sessionId: decoded.sessionId,
        // role is 'user' for regular app users or 'police' for dispatchers
        role: decoded.role || 'user'
      };
      next();
    } catch (err) {
      return next(new Error('Authentication failed: invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET.IO] Client connected: Socket ID = ${socket.id}, User ID = ${socket.user.id}, Role = ${socket.user.role}`);

    // ── Dispatcher Room Registration ─────────────────────────────────────────
    // Police dispatchers call this once after connecting to join the 'dispatchers'
    // broadcast room. The role is verified from the JWT — never from the client.
    socket.on('registerDispatcher', (_, callback) => {
      if (!socket.user || socket.user.role !== 'police') {
        if (callback) callback({ success: false, message: 'Unauthorized: police role required' });
        return;
      }
      socket.join('dispatchers');
      console.log(`[SOCKET.IO] Dispatcher registered: Socket ID = ${socket.id}, User ID = ${socket.user.id}`);
      if (callback) callback({ success: true });
    });

    // ── Join Incident Room ───────────────────────────────────────────────────
    // A user may only join the room for an incident they own.
    // A police dispatcher may join any incident room.
    // The incident field is 'userId' (not 'reporterId').
    socket.on('joinIncidentRoom', async ({ incidentId }, callback) => {
      if (!incidentId) {
        if (callback) callback({ success: false, message: 'Missing incidentId' });
        return;
      }

      try {
        const incident = await Incident.findById(incidentId);

        // Authorised if: incident exists AND (caller owns it OR caller is a dispatcher)
        const isAuthorized =
          incident &&
          (incident.userId === socket.user?.id || socket.user?.role === 'police');

        if (!isAuthorized) {
          // Don't reveal whether the incident ID exists — same message either way
          if (callback) callback({ success: false, message: 'Unauthorized' });
          return;
        }

        socket.join(incidentId);
        console.log(`[SOCKET.IO] Client ${socket.id} joined room for incident ID: ${incidentId}`);

        if (callback) {
          callback({
            success: true,
            message: `Successfully joined tracking room: ${incidentId}`,
            roomId: incidentId
          });
        }

        socket.to(incidentId).emit('participantJoined', { socketId: socket.id });
      } catch (err) {
        console.error('[SOCKET.IO] joinIncidentRoom error:', err.message);
        if (callback) callback({ success: false, message: 'Server error' });
      }
    });

    // ── Leave Incident Room ──────────────────────────────────────────────────
    socket.on('leaveIncidentRoom', ({ incidentId }, callback) => {
      if (!incidentId) {
        if (callback) callback({ success: false, message: 'Missing incidentId' });
        return;
      }
      socket.leave(incidentId);
      console.log(`[SOCKET.IO] Client ${socket.id} left room for incident ID: ${incidentId}`);
      if (callback) callback({ success: true, message: `Successfully left room: ${incidentId}` });
      socket.to(incidentId).emit('participantLeft', { socketId: socket.id });
    });

    // ── Live GPS Stream ──────────────────────────────────────────────────────
    // Only the incident owner may push location updates.
    // Guards: ownership · incident must be active · valid coordinate range ·
    //         physically plausible movement speed · riskScore never from client.
    socket.on('locationUpdate', async (data, callback) => {
      const { incidentId, latitude, longitude } = data;
      // riskScore is intentionally ignored from the client — never trust self-reported risk

      if (!incidentId || latitude === undefined || longitude === undefined) {
        if (callback) callback({ success: false, message: 'Missing location details' });
        return;
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      // ── 1. Validate coordinate ranges ─────────────────────────────────────
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.warn(`[SOCKET.IO] Rejected locationUpdate: invalid coordinates (${lat}, ${lng}) from socket ${socket.id}`);
        if (callback) callback({ success: false, message: 'Invalid coordinates' });
        return;
      }

      try {
        const incident = await Incident.findById(incidentId);

        // ── 2. Ownership check ──────────────────────────────────────────────
        // Strictly verify that the authenticated user from the token owns this incident.
        // Any user/reporter ID in the message payload is completely ignored.
        if (!socket.user?.id || !incident || String(incident.userId) !== String(socket.user.id)) {
          console.warn(`[SOCKET.IO] Unauthorized locationUpdate attempt for incident ${incidentId} by user ${socket.user?.id}`);
          if (callback) callback({ success: false, message: 'Unauthorized' });
          return;
        }

        // ── 3. Reject updates on resolved incidents ─────────────────────────
        // Accepting positions after resolution would silently corrupt the
        // evidence trail that police may need to produce in court.
        if (incident.status === 'resolved') {
          console.warn(`[SOCKET.IO] Rejected locationUpdate: incident ${incidentId} is already resolved`);
          if (callback) callback({ success: false, message: 'Incident is already resolved' });
          return;
        }

        // ── 4. Plausibility check — reject physically impossible jumps ───────
        // Max speed: 250 km/h (covers emergency vehicles, highway speeds, and GPS drift).
        // Uses the Haversine formula against the latest fix in location history
        // (or initial incident coordinates if no history exists yet).
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

          // Allow movements under 50m as normal GPS jitter/drift regardless of elapsed time
          if (distanceKm >= 0.05) {
            const elapsedMs = Date.now() - lastUpdated.getTime();
            const elapsedHours = elapsedMs > 0 ? elapsedMs / 3_600_000 : 0;
            const impliedSpeedKmh = elapsedHours > 0 ? distanceKm / elapsedHours : Infinity;

            if (impliedSpeedKmh > MAX_SPEED_KMH) {
              console.warn(
                `[SOCKET.IO] Rejected locationUpdate: impossible movement for incident ${incidentId} ` +
                `— ${distanceKm.toFixed(1)} km in ${(elapsedHours * 60).toFixed(1)} min (${impliedSpeedKmh.toFixed(0)} km/h)`
              );
              if (callback) callback({ success: false, message: 'Position rejected: movement speed is not physically plausible' });
              return;
            }
          }
        }

        console.log(`[SOCKET.IO] Location update accepted for incident ${incidentId} → Lat: ${lat}, Lng: ${lng}`);

        // Persist — Incident.update automatically appends to location_history and updates coords
        await Incident.update(incidentId, { latitude: lat, longitude: lng });

        const timestamp = new Date().toISOString();

        // Broadcast to the incident's private room (owner + joined dispatchers)
        io.to(incidentId).emit('locationUpdate', {
          incidentId,
          latitude: lat,
          longitude: lng,
          riskScore: incident.riskScore,
          timestamp
        });

        // Forward to the dispatchers room for the live map feed
        io.to('dispatchers').emit('globalLocationUpdate', {
          incidentId,
          latitude: lat,
          longitude: lng,
          riskScore: incident.riskScore
        });

        if (callback) callback({ success: true, message: 'Coordinates logged and broadcasted successfully.' });
      } catch (err) {
        console.error(`[SOCKET.IO] Error processing GPS socket update:`, err.message);
        if (callback) callback({ success: false, message: 'Failed to record location updates.', error: err.message });
      }
    });

    // ── New Incident Created ─────────────────────────────────────────────────
    // Only the incident owner may trigger this notification.
    // Payload is re-fetched from DB — never relayed from the client.
    socket.on('incidentCreated', async ({ incidentId }, callback) => {
      try {
        const incident = await Incident.findById(incidentId);
        if (!incident) {
          if (callback) callback({ success: false, message: 'Incident not found' });
          return;
        }

        // Only the owner of this incident should announce its creation
        if (incident.userId !== socket.user?.id) {
          if (callback) callback({ success: false, message: 'Unauthorized' });
          return;
        }

        console.log(`[SOCKET.IO] New threat logged globally: ${incident.id}`);
        io.to('dispatchers').emit('incidentCreated', incident);
        if (callback) callback({ success: true, message: 'Creation broadcast dispatched' });
      } catch (err) {
        console.error('[SOCKET.IO] incidentCreated error:', err.message);
        if (callback) callback({ success: false, message: 'Server error' });
      }
    });

    // ── Incident Resolved ────────────────────────────────────────────────────
    // Only police dispatchers may broadcast a resolution via the socket.
    // (HTTP PUT /api/police/incidents/:id/resolve is the authoritative path;
    //  that handler calls io.emit directly. This event handles the case where
    //  a dispatcher wants to signal resolution through the socket channel.)
    socket.on('incidentResolved', ({ incidentId }, callback) => {
      if (!incidentId) {
        if (callback) callback({ success: false, message: 'Missing incidentId' });
        return;
      }

      if (socket.user?.role !== 'police') {
        if (callback) callback({ success: false, message: 'Unauthorized: police role required' });
        return;
      }

      console.log(`[SOCKET.IO] Incident resolved by dispatcher ${socket.user.id}: ${incidentId}`);
      io.to('dispatchers').emit('incidentResolved', { incidentId });
      io.to(incidentId).emit('incidentResolved', { incidentId });
      if (callback) callback({ success: true, message: 'Resolution broadcast dispatched' });
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET.IO] Client disconnected: Socket ID = ${socket.id}`);
    });
  });
}
export default setupLiveTracking;