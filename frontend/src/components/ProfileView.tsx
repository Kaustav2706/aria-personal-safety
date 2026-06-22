import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Edit2, Globe, BellRing, Users, Database, LogOut, MapPin, Phone } from 'lucide-react';
import { profileService } from '../services/api';

interface ProfileViewProps {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  onLogout: () => void;
}

export default function ProfileView({ profile, onUpdateProfile, onLogout }: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedProfile, setLoadedProfile] = useState<UserProfile>(profile);

  // Form edit states
  const [editName, setEditName] = useState(profile.name);
  const [editEmail, setEditEmail] = useState(profile.email);
  const [editGender, setEditGender] = useState(profile.gender || '');
  const [editAge, setEditAge] = useState<number | undefined>(profile.age);
  const [editHomeAddress, setEditHomeAddress] = useState(profile.homeAddress || '');

  // Load profile from backend & merge localStorage overrides on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await profileService.getProfile();
        if (res.data.success && res.data.user) {
          const u = res.data.user;
          const local = localStorage.getItem('aria_user_profile_overrides');
          const parsedLocal = local ? JSON.parse(local) : {};

          const updated: UserProfile = {
            name: u.name || profile.name,
            email: u.email || profile.email,
            avatar: profile.avatar,
            phone: u.phone || '',
            emergencyPhone: u.phone || '',
            gender: parsedLocal.gender || profile.gender || '',
            age: parsedLocal.age !== undefined ? parsedLocal.age : profile.age,
            homeAddress: parsedLocal.homeAddress || profile.homeAddress || '',
            notificationsEnabled: parsedLocal.notificationsEnabled !== undefined
              ? parsedLocal.notificationsEnabled
              : (profile.notificationsEnabled !== undefined ? profile.notificationsEnabled : true),
          };
          setLoadedProfile(updated);
          setEditName(updated.name);
          setEditEmail(updated.email);
          setEditGender(updated.gender || '');
          setEditAge(updated.age);
          setEditHomeAddress(updated.homeAddress || '');
          onUpdateProfile(updated);
        }
      } catch (err) {
        console.warn('[PROFILE] Failed to load from backend:', err);
        const local = localStorage.getItem('aria_user_profile_overrides');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            setLoadedProfile(parsed);
            setEditName(parsed.name);
            setEditEmail(parsed.email);
            setEditGender(parsed.gender || '');
            setEditAge(parsed.age);
            setEditHomeAddress(parsed.homeAddress || '');
            onUpdateProfile(parsed);
          } catch {
            setLoadedProfile(profile);
          }
        } else {
          setLoadedProfile(profile);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSaveProfile = () => {
    const updated = {
      ...loadedProfile,
      name: editName,
      email: editEmail,
      gender: editGender,
      age: editAge ? Number(editAge) : undefined,
      homeAddress: editHomeAddress,
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
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-surface-container-high via-[#372624] to-surface-container-lowest flex items-center justify-center border-2 border-primary shadow-lg shadow-primary/20">
                <span className="text-3xl font-black tracking-tighter text-gradient bg-gradient-to-tr from-primary to-[#ffcec8] drop-shadow-[0_0_12px_rgba(255,180,172,0.4)] select-none">
                  {(() => {
                    const name = loadedProfile.name || 'User';
                    const parts = name.trim().split(/\s+/);
                    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
                    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
                  })()}
                </span>
              </div>
              
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="absolute bottom-0 right-0 bg-primary text-on-primary rounded-full p-2 border-2 border-[#1e0f0e] hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md"
                title="Edit User Profile"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>

            {/* Profile editing form details */}
            {isEditing ? (
              <div className="w-full max-w-xs space-y-3.5 mt-2 bg-surface-container/60 p-5 rounded-2xl border border-white/5 text-left animate-fade-in-scale">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-primary/60 font-black pl-1">Name</label>
                  <input 
                    type="text" 
                    className="w-full h-10 bg-surface-container-lowest text-on-surface rounded-xl border border-white/10 px-3 text-sm focus:outline-none focus:border-primary font-bold"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Name"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-primary/60 font-black pl-1">Email</label>
                  <input 
                    type="email" 
                    className="w-full h-10 bg-surface-container-lowest text-on-surface rounded-xl border border-white/10 px-3 text-xs focus:outline-none focus:border-primary"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="Email"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-primary/60 font-black pl-1">Gender</label>
                    <select
                      className="w-full h-10 bg-surface-container-lowest text-on-surface rounded-xl border border-white/10 px-2 text-xs focus:outline-none focus:border-primary"
                      value={editGender}
                      onChange={(e) => setEditGender(e.target.value)}
                    >
                      <option value="" disabled>Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-primary/60 font-black pl-1">Age</label>
                    <input 
                      type="number" 
                      min="1"
                      max="120"
                      className="w-full h-10 bg-surface-container-lowest text-on-surface rounded-xl border border-white/10 px-3 text-xs focus:outline-none focus:border-primary"
                      value={editAge !== undefined ? editAge : ''}
                      onChange={(e) => setEditAge(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="Age"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-primary/60 font-black pl-1">Home Address</label>
                  <textarea 
                    className="w-full h-16 bg-surface-container-lowest text-on-surface rounded-xl border border-white/10 p-3 text-xs focus:outline-none focus:border-primary resize-none"
                    value={editHomeAddress}
                    onChange={(e) => setEditHomeAddress(e.target.value)}
                    placeholder="Enter Home Address"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(loadedProfile.name);
                      setEditEmail(loadedProfile.email);
                      setEditGender(loadedProfile.gender || '');
                      setEditAge(loadedProfile.age);
                      setEditHomeAddress(loadedProfile.homeAddress || '');
                    }}
                    className="flex-1 h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs text-on-surface-variant font-bold cursor-pointer transition-colors active:scale-95"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveProfile}
                    className="flex-1 h-10 rounded-xl bg-gradient-to-r from-primary to-primary-container text-white text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-md shadow-primary-container/20"
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

                {/* Demographic attributes grid */}
                {(loadedProfile.gender || loadedProfile.age || loadedProfile.homeAddress) && (
                  <div className="mt-5 w-full max-w-xs mx-auto grid grid-cols-2 gap-2 text-left animate-in slide-in-from-bottom-2 duration-300">
                    {loadedProfile.gender && (
                      <div className="glass-card p-3 rounded-2xl border border-white/5 flex flex-col justify-between hover-lift">
                        <span className="text-[9px] uppercase tracking-widest text-primary/60 font-black">Gender</span>
                        <span className="text-xs font-bold text-white mt-1">{loadedProfile.gender}</span>
                      </div>
                    )}
                    {loadedProfile.age && (
                      <div className="glass-card p-3 rounded-2xl border border-white/5 flex flex-col justify-between hover-lift">
                        <span className="text-[9px] uppercase tracking-widest text-primary/60 font-black">Age</span>
                        <span className="text-xs font-bold text-white mt-1">{loadedProfile.age} yrs</span>
                      </div>
                    )}
                    {loadedProfile.homeAddress && (
                      <div className="glass-card p-3 rounded-2xl border border-white/5 flex flex-col justify-between col-span-2 hover-lift">
                        <span className="text-[9px] uppercase tracking-widest text-primary/60 font-black flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-secondary" /> Home Address
                        </span>
                        <span className="text-xs font-bold text-white/90 leading-relaxed mt-1 break-words">{loadedProfile.homeAddress}</span>
                      </div>
                    )}
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
              
              <div className="px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center">
                    <Globe className="w-5 h-5 text-secondary" />
                  </div>
                  <span className="font-semibold text-on-surface text-[15px]">Language Preference</span>
                </div>
                <span className="text-xs text-secondary font-black uppercase tracking-wider px-2.5 py-1 bg-secondary/10 border border-secondary/20 rounded-full select-none">
                  English Only
                </span>
              </div>
            </div>

            {/* Security & Safety Category */}
            <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
              <div className="px-4 py-3 border-b border-white/5">
                <h2 className="text-label-md text-primary font-black uppercase tracking-widest">Security &amp; Safety</h2>
              </div>

              <div className="divide-y divide-white/5">
                
                {/* Push Notifications Toggle */}
                <div className="w-full flex items-center justify-between px-4 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center">
                      <BellRing className="w-5 h-5 text-secondary" />
                    </div>
                    <span className="font-semibold text-on-surface text-[15px]">Push Notifications</span>
                  </div>

                  <button 
                    onClick={() => {
                      const updated = {
                        ...loadedProfile,
                        notificationsEnabled: loadedProfile.notificationsEnabled === false ? true : false,
                      };
                      setLoadedProfile(updated);
                      onUpdateProfile(updated);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 cursor-pointer focus:outline-none ${
                      loadedProfile.notificationsEnabled !== false ? 'bg-primary' : 'bg-surface-container-highest'
                    }`}
                  >
                    <span 
                      className={`inline-block h-4 w-4 transform rounded-full bg-[#1e0f0e] transition-transform duration-200 ${
                        loadedProfile.notificationsEnabled !== false ? 'translate-x-6' : 'translate-x-1'
                      }`} 
                    />
                  </button>
                </div>

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
