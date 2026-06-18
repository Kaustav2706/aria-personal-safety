import { UserProfile, EmergencyContact, IncidentItem } from './types';

export const initialProfile: UserProfile = {
  name: 'Elena Vance',
  email: 'elena.vance@lumon.corp',
  avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
  emergencyPhone: '+1 (555) 123-4567',
};

export const initialContacts: EmergencyContact[] = [
  {
    id: '1',
    name: 'Sarah Miller',
    phone: '+1 (555) 123-4567',
    priority: 'High',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
  },
  {
    id: '2',
    name: 'James Wilson',
    phone: '+1 (555) 987-6543',
    priority: 'High',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
  },
  {
    id: '3',
    name: 'Elena Rodriguez',
    phone: '+1 (555) 246-8135',
    priority: 'Medium',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
  },
];

export const initialIncidents: IncidentItem[] = [
  {
    id: 'AR-8291',
    date: 'Oct 24, 2023',
    time: '11:42 PM',
    title: 'Incident #AR-8291',
    riskScore: 84,
    location: 'San Francisco, CA',
    coordinates: '37.7749° N, 122.4194° W',
    mapImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=500',
    status: 'Resolved',
    audioSnippet: '"...stay back, I\'ve already alerted ARIA emergency services. They are tracking my location in real-time. Please leave me alone..."',
    recordingDuration: '1:45',
    timeline: [
      {
        id: 't1',
        time: '23:40:12',
        title: 'Anomalous Heart Rate Detected',
        description: 'System baseline exceeded by 45%. Passive monitoring elevated to Active Awareness state.',
        type: 'sensor',
      },
      {
        id: 't2',
        time: '23:42:05',
        title: 'SOS Triggered',
        description: 'User initiated SOS via long-press. Recording and GPS broadcasting started.',
        type: 'critical',
      },
      {
        id: 't3',
        time: '23:43:10',
        title: 'Dispatch Contacted',
        description: 'Local emergency services notified with precise coordinates and audio stream.',
        type: 'call',
      },
      {
        id: 't4',
        time: '23:58:45',
        title: 'Status: Safe',
        description: 'User confirmed safety. Incident logged and monitoring reverted to passive.',
        type: 'status',
      }
    ]
  },
  {
    id: 'AR-7940',
    date: 'Oct 21, 2023',
    time: '08:15 PM',
    title: 'Incident #AR-7940',
    riskScore: 32,
    location: 'London, UK',
    coordinates: '51.5074° N, 0.1278° W',
    mapImage: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=500',
    status: 'Resolved',
    audioSnippet: '"...I am walking through the dark alley, but I feel quiet secure with ARIA active. All coordinates locked..."',
    recordingDuration: '0:52',
    timeline: [
      {
        id: 't1_2',
        time: '20:10:05',
        title: 'Unusual Stopping Pattern',
        description: 'No movement detected in isolated high-risk neighborhood. AI tracking engaged.',
        type: 'sensor',
      },
      {
        id: 't2_2',
        time: '20:12:44',
        title: 'Check-in Confirmed',
        description: 'User prompt acknowledged. Safety verified via biometric audio sweep.',
        type: 'status',
      }
    ]
  },
  {
    id: 'AR-7612',
    date: 'Oct 18, 2023',
    time: '02:30 AM',
    title: 'Incident #AR-7612',
    riskScore: 56,
    location: 'Tokyo, JP',
    coordinates: '35.6762° N, 139.6503° E',
    mapImage: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?auto=format&fit=crop&q=80&w=500',
    status: 'Resolved',
    audioSnippet: '"...excuse me, I am currently navigating home and have direct law enforcement synchronization enabled..."',
    recordingDuration: '2:10',
    timeline: [
      {
        id: 't1_3',
        time: '02:22:10',
        title: 'Loud Decibel Spike',
        description: 'Acoustic background noise check triggered biometric confirmation prompt.',
        type: 'sensor',
      },
      {
        id: 't2_3',
        time: '02:24:15',
        title: 'Pre-emptive SafeRide Shift',
        description: 'Gait speed anomalies detected. SafeRide monitoring initialized.',
        type: 'info',
      }
    ]
  }
];
