/**
 * Police Dashboard API helper
 *
 * Centralises auth state management and axios configuration.
 * The JWT token is stored in localStorage (session-scoped, never in env vars).
 * All police API calls automatically include the Bearer token.
 */
import axios from 'axios';
import io from 'socket.io-client';

// Clean base URL: strip trailing slashes and guarantee /api suffix for REST
const rawApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
export const API_BASE = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

// Extract server root without /api for Socket.io connection
export const SOCKET_URL = (
  import.meta.env.VITE_SOCKET_URL ||
  rawApiUrl.replace(/\/api$/, '') ||
  'http://localhost:5000'
).replace(/\/+$/, '');

// Intercept 401/403 responses to clear stale/expired tokens and redirect to login
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      clearSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Creates a pre-configured Socket.IO connection with automatic reconnection,
 * dual transports (websocket + polling), and dispatcher JWT handshake.
 */
export function createPoliceSocket() {
  const socket = io(SOCKET_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket', 'polling'],
    auth: { token: getToken() }
  });

  socket.on('connect_error', (err) => {
    if (err.message && (err.message.includes('Authentication') || err.message.includes('token') || err.message.includes('Unauthorized'))) {
      clearSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  });

  return socket;
}

const TOKEN_KEY = 'aria_police_token';
const USER_KEY = 'aria_police_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}

/**
 * Returns axios request config with Authorization header.
 * Pass this to every police API call: axios.get(url, policeConfig())
 */
export function policeConfig(extra = {}) {
  return {
    ...extra,
    headers: {
      ...(extra.headers || {}),
      Authorization: `Bearer ${getToken()}`
    }
  };
}

/**
 * Login a police dispatcher.
 * @returns {{ token, user }} on success
 * @throws axios error on failure
 */
export async function loginDispatcher(email, password) {
  const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
  const { token, user } = res.data;

  if (user.role !== 'police') {
    throw new Error('This account does not have police dispatcher access.');
  }

  setSession(token, user);
  return { token, user };
}

/**
 * Register a police dispatcher account.
 * Automatically provisions with role='police'.
 * @returns {{ token, user }} on success
 * @throws axios error on failure
 */
export async function registerDispatcher({ name, email, phone, password }) {
  const res = await axios.post(`${API_BASE}/auth/register`, {
    name,
    email,
    phone,
    password,
    role: 'police'
  });
  const { token, user } = res.data;

  setSession(token, user);
  return { token, user };
}

