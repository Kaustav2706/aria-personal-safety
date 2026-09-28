import { Incident } from '../models/Incident.model.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

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
    // Only the user who owns the incident may push location updates.
    socket.on('locationUpdate', async (data, callback) => {
      const { incidentId, latitude, longitude, riskScore } = data;
      if (!incidentId || latitude === undefined || longitude === undefined) {
        if (callback) callback({ success: false, message: 'Missing location details' });
        return;
      }

      try {
        const incident = await Incident.findById(incidentId);

        // Only the incident owner may send GPS updates (not dispatchers, not other users)
        if (!incident || incident.userId !== socket.user?.id) {
          if (callback) callback({ success: false, message: 'Unauthorized' });
          return;
        }

        console.log(`[SOCKET.IO] Location update received for Incident: ${incidentId} -> Lat: ${latitude}, Lon: ${longitude}`);

        await Incident.addLocationHistory(
          incidentId,
          parseFloat(latitude),
          parseFloat(longitude),
          riskScore !== undefined ? parseInt(riskScore) : 0
        );

        await Incident.update(incidentId, {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          ...(riskScore !== undefined && { riskScore: parseInt(riskScore) })
        });

        // Broadcast to clients in THIS incident's private room (reporter + any joined dispatchers)
        io.to(incidentId).emit('locationUpdate', {
          incidentId,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          riskScore: riskScore !== undefined ? parseInt(riskScore) : undefined,
          timestamp: new Date().toISOString()
        });

        // Dispatch dashboard feed → dispatchers room ONLY, not global
        io.to('dispatchers').emit('globalLocationUpdate', {
          incidentId,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          riskScore: riskScore !== undefined ? parseInt(riskScore) : undefined
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