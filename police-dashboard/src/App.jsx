import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Shield, Map, History, Radio, Zap, Clock, Volume2, VolumeX } from 'lucide-react';
import io from 'socket.io-client';
import axios from 'axios';

// Pages imports
import Dashboard from './pages/Dashboard.jsx';
import LiveMap from './pages/LiveMap.jsx';
import IncidentLog from './pages/IncidentLog.jsx';
import ReportView from './pages/ReportView.jsx';

function AppContent() {
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [toasts, setToasts] = useState([]);
  const [activeCount, setActiveCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Force solid, professional dark charcoal theme background, removing any vibecoded gradient glows
    document.body.style.backgroundColor = '#0b0c10';
    document.body.style.background = '#0b0c10';
  }, []);

  useEffect(() => {
    window.showToast = (message, type = 'info') => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    return () => {
      window.showToast = undefined;
    };
  }, []);

  // Monitor active threats count from WebSocket and API
  useEffect(() => {
    const checkActiveIncidents = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const POLICE_API_KEY = import.meta.env.VITE_POLICE_API_KEY || '';
        const res = await axios.get(`${API_BASE}/police/incidents`, {
          headers: { 'X-Police-API-Key': POLICE_API_KEY }
        });
        const active = (res.data.incidents || []).filter(i => i.status === 'active').length;
        setActiveCount(active);
      } catch (err) {
        console.error('Failed to query active incidents status:', err);
      }
    };

    checkActiveIncidents();

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
    });

    socket.on('incidentCreated', (newIncident) => {
      if (newIncident.status === 'active') {
        setActiveCount(prev => prev + 1);
        if (window.showToast) {
          window.showToast(`🚨 CRITICAL SOS: Alert triggered by ${newIncident.userName || 'User'}!`, 'error');
        }
      }
    });

    socket.on('incidentResolved', () => {
      checkActiveIncidents();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Synthetic alarm chime using Web Audio API
  useEffect(() => {
    if (activeCount === 0 || isMuted) return;

    let audioCtx = null;
    const playWarningBeep = () => {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Classic electronic high-tech warning siren
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(350, audioCtx.currentTime + 0.35);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(350, audioCtx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.35);

        gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(audioCtx.currentTime + 0.45);
        osc2.stop(audioCtx.currentTime + 0.45);
      } catch (e) {
        console.warn("Audio Context error:", e);
      }
    };

    playWarningBeep();
    const interval = setInterval(playWarningBeep, 4000);

    return () => {
      clearInterval(interval);
      if (audioCtx) {
        audioCtx.close();
      }
    };
  }, [activeCount, isMuted]);

  const navItems = [
    { to: '/', icon: Shield, label: 'Command Center' },
    { to: '/map', icon: Map, label: 'Tactical Map' },
    { to: '/logs', icon: History, label: 'Incident Logs' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', position: 'relative' }}>
      

      {/* Dynamic Siren Overlay screen flash */}
      {activeCount > 0 && <div className="siren-active-overlay" />}

      {/* Top Command Bar */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 32px',
        height: '64px',
        background: 'linear-gradient(180deg, rgba(19, 20, 26, 0.96) 0%, rgba(19, 20, 26, 0.90) 100%)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        borderBottom: '1px solid var(--border-color)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)',
      }}>
        {/* Logo + Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            background: activeCount > 0 
              ? 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)' 
              : 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: activeCount > 0 
              ? '0 0 15px rgba(239, 68, 68, 0.5)' 
              : '0 2px 12px rgba(59, 130, 246, 0.3)',
            animation: activeCount > 0 ? 'pulse-ring 1.5s infinite ease-in-out' : 'none',
          }}>
            <Shield size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>ARIA</h1>
            <p style={{ 
              fontSize: '0.62rem', 
              fontWeight: 800, 
              color: activeCount > 0 ? 'var(--color-danger)' : 'var(--color-info)', 
              letterSpacing: '0.12em', 
              textTransform: 'uppercase', 
              lineHeight: 1, 
              marginTop: '3px',
              transition: 'color 0.3s ease'
            }}>
              {activeCount > 0 ? 'SOS INCIDENT DISPATCH' : 'POLICE DISPATCH CENTER'}
            </p>
          </div>
        </div>

        {/* Center Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right Status Cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Mute alarm button */}
          {activeCount > 0 && (
            <button 
              className="mute-button" 
              onClick={() => setIsMuted(!isMuted)} 
              title={isMuted ? "Unmute Alarm Sound" : "Mute Alarm Sound"}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} className="pulse-dot" style={{ color: 'var(--color-danger)' }} />}
            </button>
          )}

          {/* Clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            <Clock size={13} style={{ color: 'var(--text-muted)' }} />
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>

          {/* Separator */}
          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

          {/* Live Feed Badge */}
          <div className={`badge ${activeCount > 0 ? 'badge-danger border-glow-red' : 'badge-live'}`} style={{ gap: '6px', transition: 'all 0.3s ease' }}>
            <span className="pulse-dot" />
            {activeCount > 0 ? `${activeCount} ACTIVE SOS` : 'LIVE FEED'}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        padding: '28px 36px',
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        position: 'relative',
        zIndex: 1,
      }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<LiveMap />} />
          <Route path="/logs" element={<IncidentLog />} />
          <Route path="/reports/:id" element={<ReportView />} />
        </Routes>
      </main>

      {/* Toast Overlay Component */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: t.type === 'success' ? 'var(--color-success)' : t.type === 'error' ? 'var(--color-danger)' : 'var(--color-info)',
            }} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer style={{
        padding: '14px 32px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.68rem',
        color: 'var(--text-muted)',
        fontWeight: 500,
        background: 'rgba(11, 12, 16, 0.6)',
        backdropFilter: 'blur(10px)',
      }}>
        <span>© 2026 ARIA Safety Systems — Encrypted Dispatch Network</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Zap size={11} style={{ color: 'var(--color-success)' }} />
            System Operational
          </span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>v2.1.0</span>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
