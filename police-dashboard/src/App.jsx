import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Shield, Map, History, Radio, Zap, Clock } from 'lucide-react';

// Pages imports
import Dashboard from './pages/Dashboard.jsx';
import LiveMap from './pages/LiveMap.jsx';
import IncidentLog from './pages/IncidentLog.jsx';
import ReportView from './pages/ReportView.jsx';

function AppContent() {
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { to: '/', icon: Shield, label: 'Command Center' },
    { to: '/map', icon: Map, label: 'Tactical Map' },
    { to: '/logs', icon: History, label: 'Incident Logs' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', position: 'relative' }}>
      
      {/* Ambient background glows */}
      <div className="ambient-glow" style={{ top: '-200px', right: '-100px', background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)' }} />
      <div className="ambient-glow" style={{ bottom: '-200px', left: '-100px', background: 'radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)' }} />

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
        background: 'linear-gradient(180deg, rgba(12, 18, 32, 0.97) 0%, rgba(12, 18, 32, 0.92) 100%)',
        backdropFilter: 'blur(20px) saturate(1.2)',
        borderBottom: '1px solid var(--border-color)',
        boxShadow: '0 1px 20px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Logo + Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            background: 'linear-gradient(135deg, #dc2626 0%, #e11d48 100%)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(225, 29, 72, 0.3)',
          }}>
            <Shield size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>ARIA</h1>
            <p style={{ fontSize: '0.6rem', fontWeight: 700, color: '#f43f5e', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1, marginTop: '2px' }}>
              POLICE DISPATCH CENTER
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            <Clock size={13} />
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>

          {/* Separator */}
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

          {/* Live Feed Badge */}
          <div className="badge badge-live" style={{ gap: '6px' }}>
            <span className="pulse-dot" />
            LIVE FEED
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
        background: 'rgba(6, 10, 19, 0.6)',
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
