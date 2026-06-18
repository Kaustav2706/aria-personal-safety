import React, { useState } from 'react';
import { initialProfile, initialContacts, initialIncidents } from './data';
import { UserProfile, EmergencyContact, IncidentItem, Screen } from './types';

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
import { Home, Eye, Car, History, Users, User, Bell, Shield, Settings, AlertTriangle, Radio } from 'lucide-react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen | 'CONTACTS'>('SPLASH');
  
  // Core state collections
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [contacts, setContacts] = useState<EmergencyContact[]>(initialContacts);
  const [incidents, setIncidents] = useState<IncidentItem[]>(initialIncidents);
  const [selectedIncident, setSelectedIncident] = useState<IncidentItem | null>(null);
  
  // Interactive simulations
  const [riskScore, setRiskScore] = useState(12);
  const [activeNotifications, setActiveNotifications] = useState<string[]>([
    'Welcome to ARIA. Safe space telemetry is active.',
    'GPS Coordinates Locked: Precision level high.'
  ]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSimPanel, setShowSimPanel] = useState(false);

  // Fallbacks for profile updates
  const handleUpdateProfile = (updated: UserProfile) => {
    setProfile(updated);
  };

  // Contacts mutations
  const handleAddContact = (newContact: Omit<EmergencyContact, 'id'>) => {
    const created: EmergencyContact = {
      ...newContact,
      id: `c-${Date.now()}`
    };
    setContacts((prev) => [...prev, created]);
  };

  const handleDeleteContact = (id: string) => {
    setContacts((prev) => prev.filter((cnt) => cnt.id !== id));
  };

  // Authenticate triggers
  const handleLoginSuccess = (email: string, name: string) => {
    setProfile((prev) => ({
      ...prev,
      name,
      email,
    }));
    setCurrentScreen('DASHBOARD');
  };

  const handleRegisterComplete = (email: string, name: string, emergencyPhone: string) => {
    setProfile((prev) => ({
      ...prev,
      name,
      email,
      emergencyPhone,
    }));
    setCurrentScreen('DASHBOARD');
  };

  // Triggering the Active SOS Screen state
  const handleTriggerSOS = () => {
    // Append a mock active incident to history
    const freshIncident: IncidentItem = {
      id: `AR-${Math.floor(Math.random() * 9000) + 1000}`,
      date: 'Today',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      title: 'Current SOS Dispatch',
      riskScore: 92,
      location: 'Current GPS Coordinates',
      coordinates: '37.7749° N, 122.4194° W',
      mapImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=400',
      status: 'Active',
      audioSnippet: '"...dispatch route synced, backup units mobilized..."',
      timeline: [
        {
          id: 's1',
          time: 'Active',
          title: 'Emergency SOS Broadcasted',
          description: 'Live coordinate streaming and audio feeds routing to Municipal dispatch.',
          type: 'critical'
        }
      ]
    };

    setIncidents((prev) => [freshIncident, ...prev]);
    setCurrentScreen('SOS_ACTIVE');
  };

  // Safe navigation checker bounds
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
          <SplashView onComplete={() => setCurrentScreen('ONBOARDING_1')} />
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
          <header className="fixed top-0 w-full z-50 flex justify-between items-center max-w-md mx-auto px-6 h-16 bg-[#1e0f0e]/80 backdrop-blur-xl border-b border-white/10 shadow-sm">
            <div className="flex items-center gap-3">
              <div 
                onClick={() => setCurrentScreen('PROFILE')}
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20 cursor-pointer hover:border-primary shrink-0 transition-colors"
                title="View Profile details"
              >
                <img 
                  alt="Profile Avatar" 
                  src={profile.avatar} 
                  className="w-full h-full object-cover" 
                />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-extrabold text-on-surface-variant leading-none">
                  Hello, {profile.name.split(' ')[0]}
                </p>
                <h1 
                  onClick={() => setCurrentScreen('DASHBOARD')}
                  className="text-xl font-black text-primary tracking-tighter cursor-pointer"
                >
                  ARIA
                </h1>
              </div>
            </div>

            {/* Notification triggers */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 rounded-full bg-surface-container-highest/20 hover:bg-surface-container-highest flex items-center justify-center text-primary active:scale-95 transition-all cursor-pointer relative"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary" />
              </button>

              {/* Toast Panel Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-card p-4 border border-primary/25 space-y-3 z-50 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Alert Center</span>
                    <button 
                      onClick={() => setActiveNotifications([])}
                      className="text-[9px] uppercase font-bold text-on-surface-variant hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="space-y-2">
                    {activeNotifications.map((note, index) => (
                      <p key={index} className="text-xs text-on-surface-variant leading-normal">
                        • {note}
                      </p>
                    ))}
                    {activeNotifications.length === 0 && (
                      <p className="text-xs text-on-surface-variant/40 italic text-center py-2">
                        All safety check systems normal.
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
          />
        )}

        {currentScreen === 'MONITORING' && (
          <MonitoringView />
        )}

        {currentScreen === 'SAFE_RIDE' && (
          <SafeRideView onTriggerSOS={handleTriggerSOS} />
        )}

        {currentScreen === 'SOS_ACTIVE' && (
          <ActiveSOSView 
            onCancelSOS={() => {
              setRiskScore(12);
              setCurrentScreen('DASHBOARD');
            }}
            primaryContactName={contacts[0]?.name || 'Sarah Miller'}
          />
        )}

        {currentScreen === 'HISTORY' && (
          <HistoryView 
            incidents={incidents}
            userAvatar={profile.avatar}
            onSelectIncident={(inc) => {
              setSelectedIncident(inc);
              setCurrentScreen('INCIDENT_DETAILS');
            }}
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
            onLogout={() => {
              const out = window.confirm('Logout of safe session?');
              if (out) setCurrentScreen('SECURE_LOGIN');
            }}
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
          <nav className="fixed bottom-0 w-full max-w-md mx-auto z-40 rounded-t-[20px] bg-[#2c1b1a]/85 backdrop-blur-2xl border-t border-white/10 flex justify-around items-center h-20 px-2 pb-safe-area-bottom shadow-2xl">
            {/* Home Trigger button */}
            <button 
              onClick={() => setCurrentScreen('DASHBOARD')}
              className={`flex flex-col items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
                currentScreen === 'DASHBOARD' ? 'text-primary font-bold' : 'text-on-surface-variant'
              }`}
            >
              <Home className="w-5.5 h-5.5" />
              <span className="text-[10px] font-semibold tracking-wide uppercase mt-1 leading-none">Home</span>
            </button>

            {/* Monitoring Trigger */}
            <button 
              onClick={() => setCurrentScreen('MONITORING')}
              className={`flex flex-col items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
                currentScreen === 'MONITORING' ? 'text-primary font-bold' : 'text-on-surface-variant'
              }`}
            >
              <Eye className="w-5.5 h-5.5" />
              <span className="text-[10px] font-semibold tracking-wide uppercase mt-1 leading-none">Monitor</span>
            </button>

            {/* Safe Ride */}
            <button 
              onClick={() => setCurrentScreen('SAFE_RIDE')}
              className={`flex flex-col items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
                currentScreen === 'SAFE_RIDE' ? 'text-primary font-bold' : 'text-on-surface-variant'
              }`}
            >
              <Car className="w-5.5 h-5.5" />
              <span className="text-[10px] font-semibold tracking-wide uppercase mt-1 leading-none">Ride</span>
            </button>

            {/* History */}
            <button 
              onClick={() => setCurrentScreen('HISTORY')}
              className={`flex flex-col items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
                currentScreen === 'HISTORY' || currentScreen === 'INCIDENT_DETAILS' ? 'text-primary font-bold' : 'text-on-surface-variant'
              }`}
            >
              <History className="w-5.5 h-5.5" />
              <span className="text-[10px] font-semibold tracking-wide uppercase mt-1 leading-none">Logs</span>
            </button>

            {/* Contacts */}
            <button 
              onClick={() => setCurrentScreen('CONTACTS')}
              className={`flex flex-col items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
                currentScreen === 'CONTACTS' ? 'text-primary font-bold' : 'text-on-surface-variant'
              }`}
            >
              <Users className="w-5.5 h-5.5" />
              <span className="text-[10px] font-semibold tracking-wide uppercase mt-1 leading-none">Contacts</span>
            </button>

            {/* Profile */}
            <button 
              onClick={() => setCurrentScreen('PROFILE')}
              className={`flex flex-col items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer ${
                currentScreen === 'PROFILE' ? 'text-primary font-bold' : 'text-on-surface-variant'
              }`}
            >
              <User className="w-5.5 h-5.5" />
              <span className="text-[10px] font-semibold tracking-wide uppercase mt-1 leading-none">Profile</span>
            </button>
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

            {/* Simulator Triggers */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest pl-1">
                Telemetry Scenarios
              </h4>
              <button 
                onClick={() => {
                  setRiskScore(92);
                  setActiveNotifications((prev) => [
                    'Decibel Alarm: High decibel spike detected!',
                    ...prev
                  ]);
                  setCurrentScreen('SOS_ACTIVE');
                  alert('Decibel Anomaly Mocked: Automatic SOS response initiated!');
                }}
                className="w-full text-left p-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary text-xs font-semibold leading-relaxed border border-primary/20 cursor-pointer flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Trigger Voice Distress (Risk 92)
              </button>

              <button 
                onClick={() => {
                  setCurrentScreen('SAFE_RIDE');
                  alert('Ride anomaly simulated! Unplanned deviation alert broadcasted in SafeRide screen.');
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
                ] as const).map((scKey) => (
                  <button
                    key={scKey}
                    onClick={() => {
                      if (scKey === 'CONTACTS') {
                        setCurrentScreen('CONTACTS');
                      } else {
                        setCurrentScreen(scKey as Screen);
                      }
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
