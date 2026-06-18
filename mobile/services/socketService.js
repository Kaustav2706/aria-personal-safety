import io from 'socket.io-client';

const BACKEND_URL = 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (!this.socket) {
      // Configure automatic reconnection parameters for mobile devices
      this.socket = io(BACKEND_URL, {
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 5000,
        timeout: 20000
      });

      this.socket.on('connect', () => {
        console.log('[SOCKET MOBILE] Connected to WebSocket server successfully.');
      });

      this.socket.on('connect_error', (error) => {
        console.warn('[SOCKET MOBILE] Connection error encountered:', error.message);
      });

      this.socket.on('reconnect_attempt', (attempt) => {
        console.log(`[SOCKET MOBILE] Reconnection attempt #${attempt} in progress...`);
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('[SOCKET MOBILE] Disconnected from WebSocket server.');
    }
  }

  joinIncidentRoom(incidentId) {
    if (!this.socket) this.connect();
    this.socket.emit('joinIncidentRoom', { incidentId }, (ack) => {
      console.log('[SOCKET MOBILE] joinIncidentRoom ack received from server:', ack);
    });
    console.log(`[SOCKET MOBILE] Sent join room request: ${incidentId}`);
  }

  sendLocationUpdate({ incidentId, latitude, longitude, riskScore }) {
    if (!this.socket) this.connect();
    this.socket.emit('locationUpdate', {
      incidentId,
      latitude,
      longitude,
      riskScore
    }, (ack) => {
      console.log('[SOCKET MOBILE] locationUpdate ack received from server:', ack);
    });
    console.log(`[SOCKET MOBILE] Emitted GPS updates -> Lat: ${latitude}, Lon: ${longitude}`);
  }
}

export const socketService = new SocketService();
export default socketService;
