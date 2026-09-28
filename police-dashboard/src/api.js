/**
 * Police Dashboard API helper
 *
 * Centralises auth state management and axios configuration.
 * The JWT token is stored in localStorage (session-scoped, never in env vars).
 * All police API calls automatically include the Bearer token.
 */

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const TOKEN_KEY = 'aria_police_token';
const USER_KEY  = 'aria_police_user';

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

export { API_BASE };
