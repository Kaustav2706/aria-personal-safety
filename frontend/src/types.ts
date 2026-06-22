/**
 * ARIA Safety Companion App Types
 */

export type Screen =
  | 'SPLASH'
  | 'ONBOARDING_1'
  | 'ONBOARDING_2'
  | 'PERMISSION_SETUP'
  | 'SECURE_LOGIN'
  | 'SECURE_SIGNUP'
  | 'DASHBOARD' // Home
  | 'MONITORING'
  | 'SAFE_RIDE'
  | 'SOS_ACTIVE'
  | 'INCIDENT_DETAILS'
  | 'HISTORY'
  | 'PROFILE'
  | 'CONTACTS';

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  phone: string;
  emergencyPhone: string;
  gender?: string;
  age?: number;
  homeAddress?: string;
  notificationsEnabled?: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  priority: 'High' | 'Medium' | 'Low';
  avatar: string;
}

export interface IncidentItem {
  id: string;
  date: string;
  time: string;
  title: string;
  riskScore: number;
  location: string;
  coordinates: string;
  mapImage: string;
  status: 'Active' | 'Resolved';
  audioSnippet?: string;
  recordingDuration?: string;
  timeline: TimelineEvent[];
}

export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  description: string;
  type: 'sensor' | 'critical' | 'call' | 'status' | 'info';
}

export interface SystemStatus {
  backend: boolean;
  aiConnected: boolean;
  gpsConnected: boolean;
  voiceMonitoring: 'ACTIVE' | 'OFFLINE';
  motionPatterns: 'STEADY' | 'ANOMALOUS' | 'OFFLINE';
  envScore: 'Safe' | 'Warning' | 'High Risk';
  riskScore: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// Backend-aligned types — match the shapes returned by the production API
// ═════════════════════════════════════════════════════════════════════════════

/** User shape from GET /api/user/profile */
export interface BackendUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  emergencyContacts: { name: string; phone: string }[];
  createdAt: string;
}

/** Incident shape from GET /api/incidents */
export interface BackendIncident {
  id: string;
  userId: string;
  status: 'active' | 'resolved';
  triggerType: string;
  latitude: number;
  longitude: number;
  riskScore: number;
  audioTranscript: string;
  createdAt: string;
  userName?: string;
  userPhone?: string;
}

/** Response from POST /api/monitoring/chunk */
export interface ChunkAnalysis {
  success: boolean;
  distress: boolean;
  confidence: number;
  transcript: string;
  riskScore: number;
  autoIncident: {
    incidentId: string;
    riskScore: number;
    triggerType: string;
  } | null;
}

/** Monitoring session shape */
export interface MonitoringSessionData {
  id: string;
  userId: string;
  startedAt: string;
  lastActivity: string;
  status: 'active' | 'inactive';
}

/** Location history point from GET /api/incidents/:id */
export interface LocationHistoryPoint {
  id: number;
  incidentId: string;
  latitude: number;
  longitude: number;
  riskScore: number;
  timestamp: string;
}
