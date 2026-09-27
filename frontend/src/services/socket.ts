/**
 * ARIA Socket.IO Client Service
 * Manages a singleton socket connection to the backend for real-time events.
 * JWT token is sent in the socket handshake so the server can authenticate
 * the connection before any events are processed.
 */

import { io, type Socket } from 'socket.io-client';
import { getToken } from './auth';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let socket: Socket | null = null;

/** Connect to the Socket.IO server (requires a valid JWT in localStorage) */
export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  const token = getToken();

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    // Send JWT in the handshake so the server can authenticate at connection time
    auth: { token },
  });

  socket.on('connect', () => {
    console.log('[SOCKET.IO] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[SOCKET.IO] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[SOCKET.IO] Connection error:', err.message);
  });

  return socket;
}

/** Disconnect from the Socket.IO server */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    console.log('[SOCKET.IO] Disconnected and cleaned up.');
  }
}

/** Get the current socket instance (may be null) */
export function getSocket(): Socket | null {
  return socket;
}

/** Subscribe to incidentCreated events */
export function onIncidentCreated(callback: (data: any) => void): () => void {
  const s = socket || connectSocket();
  s.on('incidentCreated', callback);
  return () => { s.off('incidentCreated', callback); };
}

/** Subscribe to incidentResolved events */
export function onIncidentResolved(callback: (data: { incidentId: string }) => void): () => void {
  const s = socket || connectSocket();
  s.on('incidentResolved', callback);
  return () => { s.off('incidentResolved', callback); };
}
