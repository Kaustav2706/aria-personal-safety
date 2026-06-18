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
  | 'PROFILE';

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  emergencyPhone: string;
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
