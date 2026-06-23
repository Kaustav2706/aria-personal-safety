import React, { useState, useEffect, useCallback } from 'react';
import { defaultProfile, seedContacts } from './data';
import { UserProfile, EmergencyContact, IncidentItem, Screen, BackendIncident } from './types';

// Services
import { isAuthenticated, logout as authLogout, getUser, setToken, setUser, getToken } from './services/auth';
import { profileService, incidentService, healthService } from './services/api';
import { connectSocket, disconnectSocket, onIncidentCreated, onIncidentResolved } from './services/socket';
import { getContacts, saveContacts, seedDefaultContacts, addContact as addContactLocal, removeContact as removeContactLocal } from './services/contacts';

// Views
import SplashView from './components/SplashView';
import Onboarding1View from './components/Onboarding1View';
import Onboarding2View from './components/Onboarding2View';
import PermissionSetupView from './components/PermissionSetupView';
import LoginView from './components/LoginView';
import SignupView from './components/SignupView';
import DashboardView from './components/DashboardView';
import MonitoringView from './components/MonitoringView';
import SafeRideView from './components/SafeRideView';
import ActiveSOSView from './components/ActiveSOSView';
import HistoryView from './components/HistoryView';
import IncidentDetailsView from './components/IncidentDetailsView';
import ProfileView from './components/ProfileView';
import ContactsView from './components/ContactsView';

// Nav and layout helpers
import { Home, Eye, Car, History, Users, User, Bell, Shield, Settings, AlertTriangle, Radio, X } from 'lucide-react';

// ── Helper: Convert BackendIncident to frontend IncidentItem ────────────────
function backendToIncidentItem(inc: BackendIncident): IncidentItem {
  const d = new Date(inc.createdAt);
  return {
    id: inc.id,
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    title: `Incident #${inc.id.slice(-6).toUpperCase()}`,
    riskScore: inc.riskScore,
    location: `${inc.latitude.toFixed(4)}°, ${inc.longitude.toFixed(4)}°`,
    coordinates: `${inc.latitude.toFixed(4)}° N, ${inc.longitude.toFixed(4)}° W`,
    mapImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=500',
    status: inc.status === 'active' ? 'Active' : 'Resolved',
    audioSnippet: inc.audioTranscript || 'No audio transcript available.',
    timeline: [
      {
        id: 't-created',
        time: d.toLocaleTimeString(),
        title: 'Incident Created',
        description: `Trigger: ${inc.triggerType}. Risk score: ${inc.riskScore}%.`,
        type: 'critical' as const,
      },
    ],
  };
}

function getUserInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('SPLASH');

  // Core state collections
  const [profile, setProfile] = useState<UserProfile>(() => {
    const local = localStorage.getItem('aria_user_profile_overrides');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {}
    }
    return defaultProfile;
  });
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<IncidentItem | null>(null);

  // Live state
  const [riskScore, setRiskScore] = useState(0);
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [activeNotifications, setActiveNotifications] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSimPanel, setShowSimPanel] = useState(false);

  // SOS state
  const [sosIncidentId, setSosIncidentId] = useState<string | null>(null);
  const [sosRiskScore, setSosRiskScore] = useState(0);
  const [sosTranscript, setSosTranscript] = useState('');

  // ── Auth state check on mount ───────────────────────────────────────────
  useEffect(() => {
    // Listen for 401 unauthorized events from the API interceptor
    const handleUnauthorized = () => {
      authLogout();
      setProfile(defaultProfile);
      setCurrentScreen('SECURE_LOGIN');
    };
    window.addEventListener('aria:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('aria:unauthorized', handleUnauthorized);
  }, []);

  // ── Load user data after authentication ─────────────────────────────────
  const loadUserData = useCallback(async () => {
    setIncidentsLoading(true);
    try {
      // Load profile from backend
      const profileRes = await profileService.getProfile();
      if (profileRes.data.success && profileRes.data.user) {
        const u = profileRes.data.user;
        const base = {
          name: u.name || 'User',
          email: u.email || '',
          avatar: defaultProfile.avatar,
          phone: u.phone || '',
          emergencyPhone: u.phone || '',
        };
        const local = localStorage.getItem('aria_user_profile_overrides');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            setProfile({
              ...base,
              ...parsed,
              name: parsed.name || base.name,
              email: parsed.email || base.email,
              phone: parsed.phone || base.phone,
            });
          } catch {}
        } else {
          setProfile(base);
        }
      }
    } catch (err: any) {
      console.warn('[APP] Failed to load profile:', err);
      if (err.response?.status === 404) {
        authLogout();
        setProfile(defaultProfile);
        setCurrentScreen('SECURE_LOGIN');
        setIncidentsLoading(false);
        return;
      }
      const local = localStorage.getItem('aria_user_profile_overrides');
      if (local) {
        try {
          setProfile(JSON.parse(local));
        } catch {}
      }
    }

    try {
      // Load incidents from backend
      const incidentsRes = await incidentService.getAll();
      if (incidentsRes.data.success && incidentsRes.data.incidents) {
        const mapped = incidentsRes.data.incidents.map(backendToIncidentItem);
        setIncidents(mapped);
      }
    } catch (err) {
      console.warn('[APP] Failed to load incidents:', err);
    } finally {
      setIncidentsLoading(false);
    }

    // Load contacts from local storage
    const storedContacts = getContacts().filter(c => c.id !== '1' && c.id !== '2' && c.id !== '3');
    saveContacts(storedContacts);
    setContacts(storedContacts);

    // Connect Socket.IO
    connectSocket();
  }, []);

  // ── Socket event listeners ──────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated()) return;

    const unsubCreated = onIncidentCreated((data: any) => {
      console.log('[SOCKET] Incident created:', data);
      const newItem = backendToIncidentItem(data);
      setIncidents((prev) => {
        const exists = prev.some(i => i.id === newItem.id);
        if (exists) return prev;
        return [newItem, ...prev];
      });
      setActiveNotifications((prev) => [
        `🚨 New incident detected: ${data.id}`,
        ...prev,
      ]);
    });

    const unsubResolved = onIncidentResolved((data: { incidentId: string }) => {
      console.log('[SOCKET] Incident resolved:', data);
      setIncidents((prev) =>
        prev.map((inc) =>
          inc.id === data.incidentId ? { ...inc, status: 'Resolved' as const } : inc
        )
      );

      // Auto-redirect to dashboard if currently active SOS incident is resolved
      if (sosIncidentId && data.incidentId === sosIncidentId) {
        setRiskScore(0);
        setSosIncidentId(null);
        setCurrentScreen('DASHBOARD');
      }

      setActiveNotifications((prev) => [
        `✅ Incident ${data.incidentId} resolved.`,
        ...prev,
      ]);
    });

    return () => {
      unsubCreated();
      unsubResolved();
    };
  }, [currentScreen, sosIncidentId]);

  // ── Backend health check ────────────────────────────────────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    const checkHealth = async () => {
      try {
        const res = await healthService.check();
        setBackendOnline(res.data.success === true);
      } catch {
        setBackendOnline(false);
      }
    };

    if (isAuthenticated()) {
      checkHealth();
      interval = setInterval(checkHealth, 30000);
    }

    return () => { if (interval) clearInterval(interval); };
  }, [currentScreen]);

  // ── Profile updates ─────────────────────────────────────────────────────
  const handleUpdateProfile = (updated: UserProfile) => {
    setProfile(updated);
    localStorage.setItem('aria_user_profile_overrides', JSON.stringify(updated));
  };

  // ── Contacts mutations ──────────────────────────────────────────────────
  const handleAddContact = (newContact: Omit<EmergencyContact, 'id'>) => {
    const created = addContactLocal(newContact);
    setContacts(getContacts());
  };

  const handleDeleteContact = (id: string) => {
    removeContactLocal(id);
    setContacts(getContacts());
  };

  // ── Authentication handlers ─────────────────────────────────────────────
  const handleLoginSuccess = async () => {
    await loadUserData();
    setCurrentScreen('DASHBOARD');
  };

  const handleRegisterComplete = async () => {
    await loadUserData();
    setCurrentScreen('DASHBOARD');
  };

  // ── SOS trigger ─────────────────────────────────────────────────────────
  const handleTriggerSOS = async (triggerType: string = 'manual', extraInfo?: string, coords?: { lat: number; lng: number } | null) => {
    try {
      // Get current GPS
      let latitude = 0;
      let longitude = 0;
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
      } else {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch {
          console.warn('[SOS] GPS unavailable, using defaults.');
        }
      }

      const formData = new FormData();
      formData.append('latitude', latitude.toString());
      formData.append('longitude', longitude.toString());
      formData.append('triggerType', triggerType);
      if (extraInfo) {
        formData.append('audioTranscript', extraInfo);
      }

      const res = await incidentService.create(formData);

      if (res.data.success && res.data.incident) {
        const inc = res.data.incident;
        setSosIncidentId(inc.id);
        setSosRiskScore(inc.riskScore);
        setSosTranscript(inc.audioTranscript || '');
        setRiskScore(inc.riskScore);

        // Add to local incidents list if not already present (prevents duplicates from socket events)
        const newItem = backendToIncidentItem(inc);
        setIncidents((prev) => {
          const exists = prev.some(i => i.id === newItem.id);
          if (exists) return prev;
          return [newItem, ...prev];
        });

        setCurrentScreen('SOS_ACTIVE');
      }
    } catch (err: any) {
      console.error('[SOS] Failed to create incident:', err);
      // Fallback: still go to SOS screen with mock data
      setSosIncidentId('SOS-' + Date.now());
      setSosRiskScore(80);
      setSosTranscript('Emergency SOS triggered.');
      setCurrentScreen('SOS_ACTIVE');
    }
  };

  const handleDeleteIncident = async (id: string) => {
    console.log('[APP] handleDeleteIncident called for ID:', id);
    const confirmDelete = window.confirm('Are you sure you want to permanently delete this incident record?');
    if (!confirmDelete) return;
    try {
      const res = await incidentService.delete(id);
      console.log('[APP] Delete API response:', res.data);
      setIncidents((prev) => {
        const filtered = prev.filter((inc) => inc.id !== id);
        console.log('[APP] Incidents after deletion filter:', filtered.map(i => i.id));
        return filtered;
      });
    } catch (err: any) {
      console.error('[APP] Failed to delete incident:', err);
      if (err.response?.status === 404) {
        console.log('[APP] Incident already deleted on backend (404), removing from local state.');
        setIncidents((prev) => prev.filter((inc) => inc.id !== id));
      } else {
        alert('Failed to delete incident. Please try again.');
      }
    }
  };

  const handleResolveIncident = async (id: string) => {
    try {
      const res = await incidentService.resolve(id);
      if (res.data.success) {
        setIncidents((prev) =>
          prev.map((inc) =>
            inc.id === id ? { ...inc, status: 'Resolved' as const } : inc
          )
        );
      }
    } catch (err) {
      console.error('[APP] Failed to resolve incident:', err);
      alert('Failed to resolve incident. Please try again.');
    }
  };

  const handleCancelSOS = async () => {
    if (sosIncidentId) {
      try {
        await incidentService.resolve(sosIncidentId);
      } catch (err) {
        console.warn('[SOS] Failed to resolve cancelled incident on backend:', err);
      }
    }
    setRiskScore(0);
    setSosIncidentId(null);
    setCurrentScreen('DASHBOARD');
  };

  // ── Logout handler ──────────────────────────────────────────────────────
  const handleLogout = () => {
    const out = window.confirm('Logout of safe session?');
    if (out) {
      authLogout();
      disconnectSocket();
      setProfile(defaultProfile);
      setIncidents([]);
      setRiskScore(0);
      setCurrentScreen('SECURE_LOGIN');
    }
  };

  // ── Navigation helpers ──────────────────────────────────────────────────
  const hasBottomNav = [
    'DASHBOARD',
    'MONITORING',
    'SAFE_RIDE',
    'HISTORY',
    'PROFILE',
    'CONTACTS'
  ].includes(currentScreen);

  return (
    <div className="min-h-screen bg-[#1e0f0e] text-[#fadcd8] select-none flex flex-col justify-between">
      
      {/* Dynamic Screen View routing frame */}
      <div className="flex-1 w-full max-w-md mx-auto relative">
        
        {/* Core Screen Layout Handlers */}
        {currentScreen === 'SPLASH' && (
          <SplashView onComplete={() => {
            if (isAuthenticated()) {
              loadUserData();
              setCurrentScreen('DASHBOARD');
            } else {
              setCurrentScreen('ONBOARDING_1');
            }
          }} />
        )}
        
        {currentScreen === 'ONBOARDING_1' && (
          <Onboarding1View 
            onNext={() => setCurrentScreen('ONBOARDING_2')} 
            onSkip={() => setCurrentScreen('PERMISSION_SETUP')}
          />
        )}
        
        {currentScreen === 'ONBOARDING_2' && (
          <Onboarding2View 
            onNext={() => setCurrentScreen('PERMISSION_SETUP')} 
            onSkip={() => setCurrentScreen('PERMISSION_SETUP')}
          />
        )}
        
        {currentScreen === 'PERMISSION_SETUP' && (
          <PermissionSetupView 
            onNext={() => setCurrentScreen('SECURE_LOGIN')} 
            onBack={() => setCurrentScreen('ONBOARDING_2')}
          />
        )}
        
        {currentScreen === 'SECURE_LOGIN' && (
          <LoginView 
            onLogin={handleLoginSuccess}
            onGoToSignup={() => setCurrentScreen('SECURE_SIGNUP')}
          />
        )}
        
        {currentScreen === 'SECURE_SIGNUP' && (
          <SignupView 
            onRegisterComplete={handleRegisterComplete}
            onGoToLogin={() => setCurrentScreen('SECURE_LOGIN')}
          />
        )}

        {/* Outer Header Wrapper for Dashboards */}
        {hasBottomNav && (
          <header className="fixed top-0 w-full z-50 flex justify-between items-center max-w-md mx-auto px-6 h-16 bg-[#1e0f0e]/85 backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_1px_12px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-3">
              {/* Avatar with gradient ring */}
              <div 
                onClick={() => setCurrentScreen('PROFILE')}
                className="relative w-10 h-10 rounded-full cursor-pointer group shrink-0"
                title="View Profile"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/60 via-tertiary/40 to-secondary/50 p-[1.5px] group-hover:from-primary group-hover:to-secondary transition-all duration-300">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-surface-container-high to-surface-container-lowest flex items-center justify-center border border-white/[0.04] shadow-inner">
                    <span className="text-[11px] font-black tracking-tight text-gradient bg-gradient-to-r from-primary to-[#ffcec8] drop-shadow-[0_0_4px_rgba(255,180,172,0.3)] select-none">
                      {getUserInitials(profile.name)}
                    </span>
                  </div>
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#34d399] border-2 border-[#1e0f0e]" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-on-surface-variant/70 leading-none">
                  Hello, {profile.name.split(' ')[0]}
                </p>
                <h1 
                  onClick={() => setCurrentScreen('DASHBOARD')}
                  className="text-xl font-black tracking-tighter cursor-pointer text-gradient bg-gradient-to-r from-primary via-[#ffcec8] to-primary"
                >
                  ARIA
                </h1>
              </div>
            </div>

            {/* Notification triggers */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 rounded-full bg-surface-container-highest/20 hover:bg-surface-container-highest/50 flex items-center justify-center text-on-surface-variant hover:text-primary active:scale-95 transition-all duration-200 cursor-pointer relative"
              >
                <Bell className="w-[18px] h-[18px]" />
                {activeNotifications.length > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-primary-container shadow-[0_0_6px_rgba(255,84,76,0.6)]" />
                )}
              </button>

              {/* Toast Panel Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-72 rounded-2xl bg-[#261615] border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.85)] p-5 space-y-3 z-50 animate-fade-in-scale">
                  <div className="flex justify-between items-center pb-3 border-b border-white/[0.06]">
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">Alert Center</span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setActiveNotifications([])}
                        className="text-[9px] uppercase font-bold text-on-surface-variant/65 hover:text-primary transition-colors cursor-pointer"
                      >
                        Clear All
                      </button>
                      <button 
                        onClick={() => setShowNotifications(false)}
                        className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center text-on-surface-variant/60 hover:text-primary transition-colors cursor-pointer"
                        title="Close Alerts"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2.5 max-h-48 overflow-y-auto no-scrollbar">
                    {activeNotifications.map((note, index) => (
                      <div key={index} className="flex items-start gap-2 animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                        <span className="w-1 h-1 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                        <p className="text-xs text-on-surface-variant/80 leading-relaxed">{note}</p>
                      </div>
                    ))}
                    {activeNotifications.length === 0 && (
                      <p className="text-xs text-on-surface-variant/30 italic text-center py-3">
                        All safety systems nominal.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </header>
        )}

        {/* Dashboard View Routing Content */}
        {currentScreen === 'DASHBOARD' && (
          <DashboardView 
            onTriggerSOS={handleTriggerSOS}
            onGoToScreen={(scr) => setCurrentScreen(scr)}
            userName={profile.name}
            userAvatar={profile.avatar}
            riskScore={riskScore}
            backendOnline={backendOnline}
            monitoringActive={monitoringActive}
          />
        )}

        {currentScreen === 'MONITORING' && (
          <MonitoringView 
            onMonitoringChange={setMonitoringActive}
            onRiskScoreChange={setRiskScore}
            onIncidentCreated={(inc) => {
              const newItem = backendToIncidentItem(inc);
              setIncidents((prev) => {
                const exists = prev.some(i => i.id === newItem.id);
                if (exists) return prev;
                return [newItem, ...prev];
              });
            }}
            onTriggerSOS={handleTriggerSOS}
          />
        )}

        {currentScreen === 'SAFE_RIDE' && (
          <SafeRideView onTriggerSOS={handleTriggerSOS} />
        )}

        {currentScreen === 'SOS_ACTIVE' && (
          <ActiveSOSView 
            onCancelSOS={handleCancelSOS}
            primaryContactName={contacts[0]?.name || 'Emergency Contact'}
            incidentId={sosIncidentId}
            riskScore={sosRiskScore}
            transcript={sosTranscript}
          />
        )}

        {currentScreen === 'HISTORY' && (
          <HistoryView 
            incidents={incidents}
            isLoading={incidentsLoading}
            userAvatar={profile.avatar}
            onSelectIncident={(inc) => {
              setSelectedIncident(inc);
              setCurrentScreen('INCIDENT_DETAILS');
            }}
            onRefresh={async () => {
              try {
                const res = await incidentService.getAll();
                if (res.data.success && res.data.incidents) {
                  setIncidents(res.data.incidents.map(backendToIncidentItem));
                }
              } catch (err) {
                console.warn('[APP] Failed to refresh incidents:', err);
              }
            }}
            onDeleteIncident={handleDeleteIncident}
            onResolveIncident={handleResolveIncident}
          />
        )}

        {currentScreen === 'INCIDENT_DETAILS' && selectedIncident && (
          <IncidentDetailsView 
            incident={selectedIncident} 
            onBack={() => setCurrentScreen('HISTORY')} 
          />
        )}

        {currentScreen === 'PROFILE' && (
          <ProfileView 
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            onLogout={handleLogout}
          />
        )}

        {currentScreen === 'CONTACTS' && (
          <ContactsView 
            contacts={contacts}
            userAvatar={profile.avatar}
            onAddContact={handleAddContact}
            onDeleteContact={handleDeleteContact}
          />
        )}

        {/* Bottom Nav Bar Render */}
        {hasBottomNav && (
          <nav className="fixed bottom-0 w-full max-w-md mx-auto z-40 rounded-t-[22px] bg-[#2c1b1a]/90 backdrop-blur-2xl border-t border-white/[0.06] flex justify-around items-center h-[72px] px-3 pb-safe-area-bottom shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
            {/* Subtle gradient glow on top edge */}
            <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

            {[{
              key: 'DASHBOARD', icon: Home, label: 'Home'
            }, {
              key: 'MONITORING', icon: Eye, label: 'Monitor'
            }, {
              key: 'SAFE_RIDE', icon: Car, label: 'Ride'
            }, {
              key: 'HISTORY', icon: History, label: 'Logs', match: ['HISTORY', 'INCIDENT_DETAILS']
            }, {
              key: 'CONTACTS', icon: Users, label: 'Contacts'
            }, {
              key: 'PROFILE', icon: User, label: 'Profile'
            }].map(({ key, icon: Icon, label, match }) => {
              const isActive = match ? match.includes(currentScreen) : currentScreen === key;
              return (
                <button
                  key={key}
                  onClick={() => setCurrentScreen(key as Screen)}
                  className={`relative flex flex-col items-center justify-center py-1.5 px-2 transition-all duration-250 active:scale-90 cursor-pointer group ${
                    isActive ? 'text-primary' : 'text-on-surface-variant/60 hover:text-on-surface-variant'
                  }`}
                >
                  <Icon className="w-[20px] h-[20px]" strokeWidth={isActive ? 2.5 : 1.8} />
                  <span className={`text-[9px] tracking-[0.08em] uppercase mt-1 leading-none ${
                    isActive ? 'font-extrabold' : 'font-semibold'
                  }`}>{label}</span>
                  {/* Active indicator pill */}
                  {isActive && (
                    <span className="absolute -bottom-1 w-5 h-[3px] rounded-full bg-primary shadow-[0_0_8px_rgba(255,180,172,0.5)]" />
                  )}
                </button>
              );
            })}
          </nav>
        )}

      </div>

      {/* Persistent Elegant Screen Switcher / Simulation Controller widget */}
      <div className="fixed top-20 right-4 z-[999] flex flex-col items-end">
        <button 
          onClick={() => setShowSimPanel(!showSimPanel)}
          className="w-10 h-10 rounded-full bg-surface-container-highest border border-white/20 text-[#fadcd8] hover:text-white flex items-center justify-center shadow-lg active:scale-95 duration-200 cursor-pointer"
          title="Interactive Simulator Panel"
        >
          <Settings className={`w-5 h-5 ${showSimPanel ? 'rotate-90' : ''} transition-transform`} />
        </button>

        {showSimPanel && (
          <div className="mt-2 w-72 max-h-[480px] overflow-y-auto glass-card rounded-2xl p-4 border border-white/10 space-y-4 shadow-2xl animate-in slide-in-from-right duration-350 no-scrollbar select-none">
            <div className="pb-2 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-black tracking-widest text-[#72d4ef] uppercase">
                Interactive simulator
              </span>
              <span className="text-[9px] font-bold text-on-surface-variant font-mono">
                Active testbed
              </span>
            </div>

            {/* Backend Status */}
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-container/60">
              <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-secondary animate-pulse' : 'bg-red-500'}`} />
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                Backend: {backendOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Simulator Triggers */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest pl-1">
                Telemetry Scenarios
              </h4>
              <button 
                onClick={() => {
                  handleTriggerSOS();
                }}
                className="w-full text-left p-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary text-xs font-semibold leading-relaxed border border-primary/20 cursor-pointer flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Trigger SOS (Live Backend)
              </button>

              <button 
                onClick={() => {
                  setCurrentScreen('SAFE_RIDE');
                }}
                className="w-full text-left p-2.5 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/15 text-yellow-300 text-xs font-semibold leading-relaxed border border-yellow-500/20 cursor-pointer flex items-center gap-2"
              >
                <Radio className="w-4 h-4 animate-ping" />
                Trigger SafeRide Tour Deviation
              </button>
            </div>

            {/* Fast Nav Screen Jumpers */}
            <div className="space-y-1.5 pt-2 border-t border-white/5">
              <h4 className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest pl-1">
                Direct view jumper
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  'SPLASH', 'ONBOARDING_1', 'ONBOARDING_2', 'PERMISSION_SETUP', 
                  'SECURE_LOGIN', 'SECURE_SIGNUP', 'DASHBOARD', 'CONTACTS',
                  'MONITORING', 'SAFE_RIDE', 'SOS_ACTIVE', 'HISTORY', 'PROFILE'
                ] as Screen[]).map((scKey) => (
                  <button
                    key={scKey}
                    onClick={() => {
                      setCurrentScreen(scKey);
                      setShowSimPanel(false);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-left text-[9px] uppercase tracking-wider font-bold truncate transition-colors duration-150 cursor-pointer ${
                      currentScreen === scKey 
                        ? 'bg-primary text-on-primary' 
                        : 'bg-surface-container-highest/60 hover:bg-surface-container-highest/90 text-on-surface-variant'
                    }`}
                  >
                    {scKey.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
