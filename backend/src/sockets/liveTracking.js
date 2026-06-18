import { Incident } from '../models/Incident.model.js';

export function setupLiveTracking(io) {
  console.log('[SOCKET.IO] Live Tracking system initialized with full acknowledgements.');

  io.on('connection', (socket) => {
    console.log(`[SOCKET.IO] Client connected: Socket ID = ${socket.id}`);

    // Join specific incident room
    socket.on('joinIncidentRoom', ({ incidentId }, callback) => {
      if (!incidentId) {
        if (callback) callback({ success: false, message: 'Missing incidentId' });
        return;
      }
      
      socket.join(incidentId);
      console.log(`[SOCKET.IO] Client ${socket.id} joined room for incident ID: ${incidentId}`);
      
      // Send acknowledgement callback
      if (callback) {
        callback({ 
          success: true, 
          message: `Successfully joined tracking room: ${incidentId}`,
          roomId: incidentId 
        });
      }
      
      socket.to(incidentId).emit('participantJoined', { socketId: socket.id });
    });

    // Leave tracking room
    socket.on('leaveIncidentRoom', ({ incidentId }, callback) => {
      if (!incidentId) {
        if (callback) callback({ success: false, message: 'Missing incidentId' });
        return;
      }

      socket.leave(incidentId);
      console.log(`[SOCKET.IO] Client ${socket.id} left room for incident ID: ${incidentId}`);

      if (callback) {
        callback({ 
          success: true, 
          message: `Successfully left room: ${incidentId}` 
        });
      }

      socket.to(incidentId).emit('participantLeft', { socketId: socket.id });
    });

    // Live coordinates streaming
    socket.on('locationUpdate', async (data, callback) => {
      const { incidentId, latitude, longitude, riskScore } = data;
      if (!incidentId || latitude === undefined || longitude === undefined) {
        if (callback) callback({ success: false, message: 'Missing location details' });
        return;
      }

      console.log(`[SOCKET.IO] Location update received for Incident: ${incidentId} -> Lat: ${latitude}, Lon: ${longitude}`);

      try {
        // Save coordinate checkpoint directly to PostgreSQL location_history table
        await Incident.addLocationHistory(
          incidentId, 
          parseFloat(latitude), 
          parseFloat(longitude), 
          riskScore !== undefined ? parseInt(riskScore) : 0
        );

        // Update current location in the main incident registry cache
        await Incident.update(incidentId, {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          ...(riskScore !== undefined && { riskScore: parseInt(riskScore) })
        });

        // Broadcast to clients listening in the incident room
        io.to(incidentId).emit('locationUpdate', {
          incidentId,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          riskScore: riskScore !== undefined ? parseInt(riskScore) : undefined,
          timestamp: new Date().toISOString()
        });

        // Broadcast globally to dispatch center main dashboard feed
        io.emit('globalLocationUpdate', {
          incidentId,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          riskScore: riskScore !== undefined ? parseInt(riskScore) : undefined
        });

        // Acknowledge receipt back to mobile client
        if (callback) {
          callback({ 
            success: true, 
            message: 'Coordinates logged and broadcasted successfully.' 
          });
        }
      } catch (err) {
        console.error(`[SOCKET.IO] Error processing GPS socket update:`, err.message);
        if (callback) {
          callback({ 
            success: false, 
            message: 'Failed to record location updates.', 
            error: err.message 
          });
        }
      }
    });

    // Broadcast newly created incident
    socket.on('incidentCreated', (incident, callback) => {
      console.log(`[SOCKET.IO] New threat logged globally: ${incident.id}`);
      io.emit('incidentCreated', incident);
      if (callback) callback({ success: true, message: 'Creation broadcast dispatched' });
    });

    // Broadcast incident resolved
    socket.on('incidentResolved', ({ incidentId }, callback) => {
      if (!incidentId) {
        if (callback) callback({ success: false, message: 'Missing incidentId' });
        return;
      }
      
      console.log(`[SOCKET.IO] Incident resolved globally: ${incidentId}`);
      io.emit('incidentResolved', { incidentId });
      io.to(incidentId).emit('incidentResolved', { incidentId });
      
      if (callback) callback({ success: true, message: 'Resolution broadcast dispatched' });
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET.IO] Client disconnected: Socket ID = ${socket.id}`);
    });
  });
}
export default setupLiveTracking;
