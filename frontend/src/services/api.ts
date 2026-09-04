/**
 * ARIA API Service — Centralized Axios Instance
 * All backend API calls go through this module.
 * JWT is automatically attached via request interceptor.
 */

import axios, { type AxiosError } from 'axios';
import { getRefreshToken, getToken, logout, setRefreshToken, setToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean } | undefined;
    const isAuthRequest = originalRequest?.url?.includes('/api/auth/');
    const canRefresh = !!getRefreshToken() && !!originalRequest && !isAuthRequest && !originalRequest._retry;

    if ((error.response?.status === 401 || error.response?.status === 403) && canRefresh) {
      originalRequest._retry = true;
      return api.post('/api/auth/refresh', { refreshToken: getRefreshToken() })
        .then((response) => {
          setToken(response.data.token);
          setRefreshToken(response.data.refreshToken);
          originalRequest.headers.Authorization = 'Bearer ' + response.data.token;
          return api(originalRequest);
        })
        .catch((refreshError) => {
          logout();
          window.dispatchEvent(new CustomEvent('aria:unauthorized'));
          return Promise.reject(refreshError);
        });
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      logout();
      window.dispatchEvent(new CustomEvent('aria:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
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
  refresh: (refreshToken: string) =>
    api.post('/api/auth/refresh', { refreshToken }),
  logout: () => api.post('/api/auth/logout'),
  logoutAll: () => api.post('/api/auth/logout-all'),
};

export const profileService = {
  getProfile: () => api.get('/api/user/profile'),
};

export const monitoringService = {
  startSession: () => api.post('/api/monitoring/start'),
  uploadChunk: (formData: FormData) =>
    api.post('/api/monitoring/chunk', formData, {
      timeout: 15000,
    }),
  stopSession: (sessionId: string) =>
    api.post('/api/monitoring/stop', { sessionId }),
  getStatus: (sessionId: string) =>
    api.get(`/api/monitoring/status/${sessionId}`),
};

export const incidentService = {
  create: (formData: FormData) =>
    api.post('/api/incidents/create', formData),
  getAll: () => api.get('/api/incidents'),
  getById: (id: string) => api.get(`/api/incidents/${id}`),
  delete: (id: string) => api.delete(`/api/incidents/${id}`),
  resolve: (id: string) => api.put(`/api/incidents/${id}/resolve`),
};

export const reportService = {
  generate: (incidentId: string) =>
    api.post('/api/incidents/report/generate', { incidentId }),
};

export const healthService = {
  check: () => api.get('/health', { timeout: 5000 }),
};

export default api;
