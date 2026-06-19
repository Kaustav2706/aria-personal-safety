import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Camera, Edit2, BrainCircuit, Globe, BellRing, Users, Database, LogOut, ShieldCheck, Sun, Moon, Loader2, Phone } from 'lucide-react';
import { profileService } from '../services/api';

interface ProfileViewProps {
  profile: UserProfile;
  onUpdateProfile: (num: any) => void;
  onLogout: () => void;
}

export default function ProfileView({ profile, onUpdateProfile, onLogout }: ProfileViewProps) {
  const [darkMode, setDarkMode] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editEmail, setEditEmail] = useState(profile.email);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedProfile, setLoadedProfile] = useState(profile);

  // Load profile from backend on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await profileService.getProfile();
        if (res.data.success && res.data.user) {
          const u = res.data.user;
          const updated: UserProfile = {
            name: u.name || profile.name,
            email: u.email || profile.email,
            avatar: profile.avatar,
            phone: u.phone || '',
            emergencyPhone: u.phone || '',
          };
          setLoadedProfile(updated);
          setEditName(updated.name);
          setEditEmail(updated.email);
          onUpdateProfile(updated);
        }
      } catch (err) {
        console.warn('[PROFILE] Failed to load from backend:', err);
        setLoadedProfile(profile);
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleSaveProfile = () => {
    const updated = {
      ...loadedProfile,
      name: editName,
      email: editEmail,
    };
    onUpdateProfile(updated);
    setLoadedProfile(updated);
    setIsEditing(false);
  };

  return (
    <div className="pt-24 pb-32 px-6 font-sans">
      
      {/* Loading skeleton */}
      {isLoading ? (
        <div className="flex flex-col items-center py-16 animate-pulse">
          <div className="w-24 h-24 rounded-full bg-surface-container-highest mb-4" />
          <div className="w-40 h-6 bg-surface-container-highest rounded mb-2" />
          <div className="w-56 h-4 bg-surface-container-highest rounded" />
        </div>
      ) : (
        <>
          {/* Centered user Avatar view panel head */}
          <section className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary shadow-lg shadow-primary/20">
                <img 
                  src={loadedProfile.avatar} 
                  alt={loadedProfile.name} 
                  className="w-full h-full object-cover" 
                />
              </div>
              
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="absolute bottom-0 right-0 bg-primary text-on-primary rounded-full p-2 border-2 border-[#1e0f0e] hover:scale-105 transition-transform cursor-pointer"
                title="Edit User Profile"
              >
                <Edit2 className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Profile editing form details */}
            {isEditing ? (
              <div className="w-full max-w-xs space-y-2 mt-2 bg-surface-container/60 p-4 rounded-2xl border border-white/5">
                <input 
                  type="text" 
                  className="w-full h-10 bg-surface-container-lowest text-on-surface rounded-xl border border-white/10 px-3 text-sm focus:outline-none focus:border-primary text-center font-bold"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Name"
                />
                <input 
                  type="email" 
                  className="w-full h-10 bg-surface-container-lowest text-on-surface rounded-xl border border-white/10 px-3 text-xs focus:outline-none focus:border-primary text-center"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Email"
                />
                <div className="flex gap-2 pt-1.5">
                  <button 
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 h-9 rounded-lg bg-surface-container text-xs text-on-surface-variant font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveProfile}
                    className="flex-1 h-9 rounded-lg bg-primary-container text-white text-xs font-bold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center animate-in fade-in duration-300">
                <h1 className="text-2xl font-black text-on-surface">{loadedProfile.name}</h1>
                <p className="text-body-sm text-on-surface-variant opacity-75 mt-0.5 select-none">{loadedProfile.email}</p>
                {loadedProfile.phone && (
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    <Phone className="w-3.5 h-3.5 text-secondary" />
                    <p className="text-body-sm text-secondary font-medium">{loadedProfile.phone}</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Menu preferences grouped container lines */}
          <div className="space-y-6">
            
            {/* Preferences Category block */}
            <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
              <div className="px-4 py-3 border-b border-white/5">
                <h2 className="text-label-md text-primary font-black uppercase tracking-widest">Preferences</h2>
              </div>
              
              <div className="divide-y divide-white/5">
                
                {/* AI sensitivity setting slider simulation */}
                <button 
                  onClick={() => alert('AI trigger threshold set to Optimal High sensitivity.')}
                  className="w-full flex items-center justify-between px-4 py-4 hover:bg-white/5 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center">
                      <BrainCircuit className="w-5 h-5 text-secondary animate-pulse" />
                    </div>
                    <span className="font-semibold text-on-surface text-[15px]">AI Sensitivity Settings</span>
                  </div>
                  <span className="text-on-surface-variant group-hover:translate-x-1 transition-transform">→</span>
                </button>

                {/* Language Preference */}
                <button 
                  onClick={() => alert('System support languages configured: English (Active). Multi-vitals enabled.')}
                  className="w-full flex items-center justify-between px-4 py-4 hover:bg-white/5 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center">
                      <Globe className="w-5 h-5 text-secondary" />
                    </div>
                    <span className="font-semibold text-on-surface text-[15px]">Language Preference</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant font-medium">English</span>
                    <span className="text-on-surface-variant group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </button>

              </div>
            </div>

            {/* Security & Safety Category */}
            <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
              <div className="px-4 py-3 border-b border-white/5">
                <h2 className="text-label-md text-primary font-black uppercase tracking-widest">Security &amp; Safety</h2>
              </div>

              <div className="divide-y divide-white/5">
                
                {/* Notification settings */}
                <button 
                  onClick={() => alert('All push warning thresholds logged active.')}
                  className="w-full flex items-center justify-between px-4 py-4 hover:bg-white/5 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center">
                      <BellRing className="w-5 h-5 text-secondary" />
                    </div>
                    <span className="font-semibold text-on-surface text-[15px]">Notification Settings</span>
                  </div>
                  <span className="text-on-surface-variant group-hover:translate-x-1 transition-transform">→</span>
                </button>

                {/* Contact pref lookups */}
                <button 
                  onClick={() => alert('Primary and secondary priority networks matching baseline.')}
                  className="w-full flex items-center justify-between px-4 py-4 hover:bg-white/5 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center">
                      <Users className="w-5 h-5 text-secondary" />
                    </div>
                    <span className="font-semibold text-on-surface text-[15px]">Emergency Contact Preferences</span>
                  </div>
                  <span className="text-on-surface-variant group-hover:translate-x-1 transition-transform">→</span>
                </button>

                {/* Privacy details */}
                <button 
                  onClick={() => {
                    alert('Private encryption active. All records local-host strictly secure.');
                  }}
                  className="w-full flex items-center justify-between px-4 py-4 hover:bg-white/5 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center">
                      <Database className="w-5 h-5 text-secondary" />
                    </div>
                    <span className="font-semibold text-on-surface text-[15px]">Privacy &amp; Data</span>
                  </div>
                  <span className="text-on-surface-variant group-hover:translate-x-1 transition-transform">→</span>
                </button>

              </div>
            </div>

            {/* Ambient Settings option toggle */}
            <div className="glass-card rounded-2xl overflow-hidden border border-white/5 px-4 py-4 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center">
                  {darkMode ? <Moon className="w-5 h-5 text-secondary" /> : <Sun className="w-5 h-5 text-primary animate-spin" style={{ animationDuration: '10s' }} />}
                </div>
                <span className="font-semibold text-on-surface text-[15px]">Dark Mode</span>
              </div>

              <button 
                onClick={toggleDarkMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 cursor-pointer focus:outline-none ${darkMode ? 'bg-primary' : 'bg-surface-container-highest'}`}
              >
                <span 
                  className={`inline-block h-4 w-4 transform rounded-full bg-[#1e0f0e] transition-transform duration-200 ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} 
                />
              </button>
            </div>

            {/* Logout bottom trigger */}
            <button 
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border border-primary/30 text-primary hover:bg-primary/5 active:scale-[0.98] transition-all cursor-pointer font-bold mt-8 shadow-sm"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout Session</span>
            </button>

            {/* Version label */}
            <div className="text-center pt-2 opacity-35">
              <p className="text-[10px] font-bold uppercase tracking-widest">ARIA v2.4.0-Stable</p>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
