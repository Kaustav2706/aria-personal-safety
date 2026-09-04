import { Incident } from '../models/Incident.model.js';

export function setupLiveTracking(io) {
  console.log('[SOCKET.IO] Live Tracking system initialized with full acknowledgements.');

  io.on('connection', (socket) => {
    console.log(`[SOCKET.IO] Client connected: Socket ID = ${socket.id}`);

    // Dispatchers register into a dedicated room
    socket.on('registerDispatcher', (_, callback) => {
      // socket.user should be set during your auth middleware/handshake (see note below)
      if (!socket.user || socket.user.role !== 'dispatcher') {
        if (callback) callback({ success: false, message: 'Unauthorized' });
        return;
      }
      socket.join('dispatchers');
      if (callback) callback({ success: true });
    });

    // Join specific incident room — NOW WITH AN AUTHORIZATION CHECK
    socket.on('joinIncidentRoom', async ({ incidentId }, callback) => {
      if (!incidentId) {
        if (callback) callback({ success: false, message: 'Missing incidentId' });
        return;
      }

      const incident = await Incident.findById(incidentId);
      const isAuthorized =
        incident &&
        (incident.reporterId === socket.user?.id || socket.user?.role === 'dispatcher');

      if (!isAuthorized) {
        // Don't reveal whether the ID exists or not — same generic message either way
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
    });

    // Leave tracking room — unchanged, leaving is not sensitive
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

    // Live coordinates streaming
    socket.on('locationUpdate', async (data, callback) => {
      const { incidentId, latitude, longitude, riskScore } = data;
      if (!incidentId || latitude === undefined || longitude === undefined) {
        if (callback) callback({ success: false, message: 'Missing location details' });
        return;
      }

      // Only the reporting client for THIS incident should be sending updates
      const incident = await Incident.findById(incidentId);
      if (!incident || incident.reporterId !== socket.user?.id) {
        if (callback) callback({ success: false, message: 'Unauthorized' });
        return;
      }

      console.log(`[SOCKET.IO] Location update received for Incident: ${incidentId} -> Lat: ${latitude}, Lon: ${longitude}`);

      try {
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

        // Only to clients in THIS incident's room (reporter + assigned dispatchers who joined)
        io.to(incidentId).emit('locationUpdate', {
          incidentId,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          riskScore: riskScore !== undefined ? parseInt(riskScore) : undefined,
          timestamp: new Date().toISOString()
        });

        // Dispatch dashboard feed -> dispatchers room ONLY, not global
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

    // Notify dispatchers of a newly created incident
    socket.on('incidentCreated', async ({ incidentId }, callback) => {
      // Re-fetch from the DB — never trust/rebroadcast a client-supplied incident payload
      const incident = await Incident.findById(incidentId);
      if (!incident) {
        if (callback) callback({ success: false, message: 'Incident not found' });
        return;
      }
      console.log(`[SOCKET.IO] New threat logged globally: ${incident.id}`);
      io.to('dispatchers').emit('incidentCreated', incident);
      if (callback) callback({ success: true, message: 'Creation broadcast dispatched' });
    });

    // Notify dispatchers + the incident's own room that it's resolved
    socket.on('incidentResolved', ({ incidentId }, callback) => {
      if (!incidentId) {
        if (callback) callback({ success: false, message: 'Missing incidentId' });
        return;
      }
      console.log(`[SOCKET.IO] Incident resolved: ${incidentId}`);
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