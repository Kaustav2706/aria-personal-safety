import { UserProfile, EmergencyContact, IncidentItem } from './types';

/**
 * Default profile used as fallback before backend data loads.
 * All real profile data comes from GET /api/user/profile.
 */
export const defaultProfile: UserProfile = {
  name: 'User',
  email: '',
  avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
  phone: '',
  emergencyPhone: '',
};

/**
 * Seed contacts — loaded into localStorage on first app boot only.
 * After that, contacts are managed through the contacts service.
 */
export const seedContacts: EmergencyContact[] = [
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
