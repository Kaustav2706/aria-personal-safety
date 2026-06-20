/**
 * ARIA API Service — Centralized Axios Instance
 * All backend API calls go through this module.
 * JWT is automatically attached via request interceptor.
 */

import axios, { type AxiosError } from 'axios';
import { getToken, logout } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ── Axios instance ──────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach JWT ─────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401 ────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      logout();
      // Dispatch a custom event so App.tsx can redirect to login
      window.dispatchEvent(new CustomEvent('aria:unauthorized'));
    }
    return Promise.reject(error);
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// AUTH APIs
// ═════════════════════════════════════════════════════════════════════════════
export const authService = {
  /** POST /api/auth/login */
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),

  /** POST /api/auth/register */
  register: (
    name: string,
    email: string,
    phone: string,
    password: string,
    emergencyContacts?: { name: string; phone: string }[]
  ) =>
    api.post('/api/auth/register', {
      name,
      email,
      phone,
      password,
      emergencyContacts: emergencyContacts || [],
    }),
};

// ═════════════════════════════════════════════════════════════════════════════
// PROFILE APIs
// ═════════════════════════════════════════════════════════════════════════════
export const profileService = {
  /** GET /api/user/profile */
  getProfile: () => api.get('/api/user/profile'),
};

// ═════════════════════════════════════════════════════════════════════════════
// MONITORING APIs
// ═════════════════════════════════════════════════════════════════════════════
export const monitoringService = {
  /** POST /api/monitoring/start */
  startSession: () => api.post('/api/monitoring/start'),

  /** POST /api/monitoring/chunk — multipart/form-data */
  uploadChunk: (formData: FormData) =>
    api.post('/api/monitoring/chunk', formData, {
      timeout: 15000,
    }),

  /** POST /api/monitoring/stop */
  stopSession: (sessionId: string) =>
    api.post('/api/monitoring/stop', { sessionId }),

  /** GET /api/monitoring/status/:sessionId */
  getStatus: (sessionId: string) =>
    api.get(`/api/monitoring/status/${sessionId}`),
};

// ═════════════════════════════════════════════════════════════════════════════
// INCIDENT APIs
// ═════════════════════════════════════════════════════════════════════════════
export const incidentService = {
  /** POST /api/incidents/create — supports multipart/form-data for audio upload */
  create: (formData: FormData) =>
    api.post('/api/incidents/create', formData),

  /** GET /api/incidents */
  getAll: () => api.get('/api/incidents'),

  /** GET /api/incidents/:id */
  getById: (id: string) => api.get(`/api/incidents/${id}`),

  /** DELETE /api/incidents/:id */
  delete: (id: string) => api.delete(`/api/incidents/${id}`),

  /** PUT /api/incidents/:id/resolve */
  resolve: (id: string) => api.put(`/api/incidents/${id}/resolve`),
};

// ═════════════════════════════════════════════════════════════════════════════
// REPORT APIs
// ═════════════════════════════════════════════════════════════════════════════
export const reportService = {
  /** POST /api/incidents/report/generate */
  generate: (incidentId: string) =>
    api.post('/api/incidents/report/generate', { incidentId }),
};

// ═════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═════════════════════════════════════════════════════════════════════════════
export const healthService = {
  /** GET /health */
  check: () => api.get('/health', { timeout: 5000 }),
};

export default api;
