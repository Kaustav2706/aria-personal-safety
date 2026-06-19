import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import { AlertOctagon, CheckCircle2, ShieldAlert, ArrowRight, ArrowUpRight, Phone, MapPin, Activity, Users, Clock, TrendingUp, Radio, Zap, Eye } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const POLICE_API_KEY = import.meta.env.VITE_POLICE_API_KEY || '';
const policeHeaders = { 'X-Police-API-Key': POLICE_API_KEY };

export default function Dashboard() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({ active: 0, resolved: 0, avgRisk: 0, total: 0 });
  const [alertBanner, setAlertBanner] = useState(null);

  useEffect(() => {
    fetchIncidents();

    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1500
    });

    socket.on('incidentCreated', (newIncident) => {
      setIncidents(prev => [newIncident, ...prev]);
      setAlertBanner(newIncident);
      setTimeout(() => setAlertBanner(null), 10000);
    });

    socket.on('incidentResolved', ({ incidentId }) => {
      setIncidents(prev => prev.map(inc =>
        inc.id === incidentId ? { ...inc, status: 'resolved' } : inc
      ));
    });

    socket.on('globalLocationUpdate', (data) => {
      setIncidents(prev => prev.map(inc =>
        inc.id === data.incidentId
          ? { ...inc, latitude: data.latitude, longitude: data.longitude, riskScore: data.riskScore || inc.riskScore }
          : inc
      ));
    });

    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    const active = incidents.filter(i => i.status === 'active').length;
    const resolved = incidents.filter(i => i.status === 'resolved').length;
    const totalRisk = incidents.reduce((sum, i) => sum + (i.riskScore || 0), 0);
    const avgRisk = incidents.length ? Math.round(totalRisk / incidents.length) : 0;
    setStats({ active, resolved, avgRisk, total: incidents.length });
  }, [incidents]);

  const fetchIncidents = async () => {
    try {
      const res = await axios.get(`${API_BASE}/police/incidents`, { headers: policeHeaders });
      setIncidents(res.data.incidents || []);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    }
  };

  const handleResolve = async (id, e) => {
    e.stopPropagation();
    try {
      await axios.put(`${API_BASE}/police/incidents/${id}/resolve`, {}, { headers: policeHeaders });
      fetchIncidents();
    } catch (err) {
      console.error('Error resolving incident:', err);
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Critical SOS Alert Banner ─────────────────────────────────── */}
      {alertBanner && (
        <div className="alert-banner" onClick={() => navigate(`/map?incidentId=${alertBanner.id}`)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 1 }}>
            <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '10px', backdropFilter: 'blur(4px)' }}>
              <AlertOctagon size={26} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em' }}>CRITICAL SOS TRIGGERED</strong>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.9)', color: '#be123c', border: 'none', fontWeight: 800 }}>
                  RISK: {alertBanner.riskScore}%
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', opacity: 0.92, marginTop: '3px', fontWeight: 500 }}>
                Victim: {alertBanner.userName || 'Registered User'} • Phone: {alertBanner.userPhone} • Trigger: {alertBanner.triggerType?.toUpperCase()}
              </p>
            </div>
          </div>
          <div className="btn" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', zIndex: 1, backdropFilter: 'blur(4px)', fontSize: '0.78rem' }}>
            RESPOND <ArrowRight size={14} />
          </div>
        </div>
      )}

      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>
          Command Center
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '4px', fontWeight: 500 }}>
          Real-time safety threat intelligence and incident dispatch overview
        </p>
      </div>

      {/* ── Stats Grid ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px' }}>

        {/* Active Threats */}
        <div className="glass-card glass-card-danger stat-card" style={{ padding: '22px' }}>
          <div>
            <p className="stat-label">Active Threats</p>
            <h3 className="stat-value" style={{ color: stats.active > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>{stats.active}</h3>
            {stats.active > 0 && (
              <p style={{ fontSize: '0.7rem', color: 'var(--color-danger)', fontWeight: 600, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Radio size={10} style={{ animation: 'pulse-ring 1.5s infinite' }} /> Requires attention
              </p>
            )}
          </div>
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)' }}>
            <AlertOctagon size={24} />
          </div>
        </div>

        {/* Resolved */}
        <div className="glass-card stat-card" style={{ padding: '22px' }}>
          <div>
            <p className="stat-label">Resolved</p>
            <h3 className="stat-value" style={{ color: 'var(--color-success)' }}>{stats.resolved}</h3>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '6px' }}>Successfully closed</p>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--color-success)' }}>
            <CheckCircle2 size={24} />
          </div>
        </div>

        {/* Mean Risk */}
        <div className="glass-card stat-card" style={{ padding: '22px' }}>
          <div>
            <p className="stat-label">Mean Risk Score</p>
            <h3 className="stat-value" style={{ color: stats.avgRisk >= 60 ? 'var(--color-danger)' : stats.avgRisk >= 30 ? 'var(--color-warning)' : 'var(--color-success)' }}>{stats.avgRisk}%</h3>
            <div className="risk-gauge" style={{ width: '80px', marginTop: '8px' }}>
              <div className="risk-gauge-fill" style={{
                width: `${stats.avgRisk}%`,
                background: stats.avgRisk >= 60
                  ? 'linear-gradient(90deg, #ef4444, #f87171)'
                  : stats.avgRisk >= 30
                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                    : 'linear-gradient(90deg, #10b981, #34d399)',
              }} />
            </div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', color: 'var(--color-warning)' }}>
            <Activity size={24} />
          </div>
        </div>

        {/* Total Incidents */}
        <div className="glass-card stat-card" style={{ padding: '22px' }}>
          <div>
            <p className="stat-label">Total Incidents</p>
            <h3 className="stat-value" style={{ color: 'var(--text-accent)' }}>{stats.total}</h3>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '6px' }}>All time records</p>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--color-info)' }}>
            <TrendingUp size={24} />
          </div>
        </div>

      </div>

      {/* ── Main Content Grid ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>

        {/* ── Activity Feed ───────────────────────────────────────────── */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Recent Activity Feed</h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 500 }}>Latest {Math.min(incidents.length, 5)} dispatch events</p>
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => navigate('/logs')}
              style={{ fontSize: '0.75rem', padding: '7px 14px' }}
            >
              All Logs <ArrowUpRight size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {incidents.slice(0, 5).map((inc, idx) => (
              <div
                key={inc.id}
                className={`incident-row ${inc.status === 'active' ? 'incident-row-active' : 'incident-row-resolved'}`}
                onClick={() => {
                  if (inc.status === 'active') {
                    navigate(`/map?incidentId=${inc.id}`);
                  } else {
                    navigate(`/reports/${inc.id}`);
                  }
                }}
                style={{ animationDelay: `${idx * 0.06}s` }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span className={`badge ${inc.status === 'active' ? 'badge-danger' : 'badge-success'}`}>
                      {inc.status === 'active' ? '● ACTIVE' : '✓ RESOLVED'}
                    </span>
                    <strong style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 700 }}>{inc.userName || 'Registered User'}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                      {inc.id?.slice(-8)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                    {inc.userPhone && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={12} /> {inc.userPhone}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} /> Latitude: {inc.latitude?.toFixed(4)}°, Longitude: {inc.longitude?.toFixed(4)}°
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {formatTimeAgo(inc.createdAt)}
                    </span>
                  </div>

                  {inc.audioTranscript && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      "{inc.audioTranscript}"
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Risk</div>
                    <div style={{
                      fontSize: '1.3rem',
                      fontWeight: 800,
                      color: inc.riskScore >= 75 ? 'var(--color-danger)' : inc.riskScore >= 40 ? 'var(--color-warning)' : 'var(--color-success)',
                      fontFamily: 'var(--font-sans)',
                      lineHeight: 1,
                    }}>
                      {inc.riskScore}%
                    </div>
                  </div>

                  {inc.status === 'active' ? (
                    <button
                      className="btn btn-success"
                      onClick={(e) => handleResolve(inc.id, e)}
                      style={{ padding: '7px 12px', fontSize: '0.72rem' }}
                    >
                      Resolve
                    </button>
                  ) : (
                    <div style={{ width: '28px', display: 'flex', justifyContent: 'center' }}>
                      <CheckCircle2 size={18} style={{ color: 'var(--color-success)', opacity: 0.6 }} />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {incidents.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                <Eye size={36} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>No recorded safety incidents found</p>
                <p style={{ fontSize: '0.72rem', marginTop: '4px' }}>Incidents will appear here in real-time when triggered</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Sidebar ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* System Health Panel */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
                <Zap size={14} />
              </div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>ARIA Infrastructure</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {[
                { name: 'AI Engine', status: 'ONLINE', port: '8000', color: 'var(--color-success)' },
                { name: 'WebSocket Bridge', status: 'ACTIVE', port: '5000', color: 'var(--color-success)' },
                { name: 'Twilio Service', status: 'CONNECTED', port: null, color: 'var(--color-cyan)' },
                { name: 'Firebase SDK', status: 'CONNECTED', port: null, color: 'var(--color-cyan)' },
              ].map((service, idx) => (
                <div key={service.name} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: idx < 3 ? '1px solid rgba(56, 78, 122, 0.2)' : 'none',
                }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500 }}>{service.name}</span>
                  <span style={{
                    color: service.color,
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    fontFamily: 'var(--font-mono)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    letterSpacing: '0.03em',
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: service.color, display: 'inline-block' }} />
                    {service.status}{service.port ? ` (${service.port})` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Action — Tactical Map */}
          <div
            className="glass-card"
            style={{
              cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, var(--bg-card) 100%)',
              borderColor: 'rgba(59, 130, 246, 0.2)',
              position: 'relative',
              overflow: 'hidden',
            }}
            onClick={() => navigate('/map')}
          >
            {/* Subtle scan line effect */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '40%',
              background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.04) 0%, transparent 100%)',
              pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <MapPin size={15} style={{ color: 'var(--color-info)' }} />
                <h4 style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 700 }}>Tactical Dispatch Map</h4>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: 1.5, fontWeight: 500 }}>
                Live GPS telemetry plotting with incident tracking and real-time coordinate streaming
              </p>
              <div style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-info)', fontWeight: 700, letterSpacing: '0.02em' }}>
                Launch GIS Panel <ArrowUpRight size={13} />
              </div>
            </div>
          </div>

          {/* Quick Action — Incident Logs */}
          <div
            className="glass-card"
            style={{
              cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, var(--bg-card) 100%)',
              borderColor: 'rgba(99, 102, 241, 0.15)',
            }}
            onClick={() => navigate('/logs')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <ShieldAlert size={15} style={{ color: 'var(--color-accent)' }} />
              <h4 style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 700 }}>Audit Log Archive</h4>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: 1.5, fontWeight: 500 }}>
              Search and filter historical incident records with full diagnostic telemetry
            </p>
            <div style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-accent)', fontWeight: 700, letterSpacing: '0.02em' }}>
              Browse Records <ArrowUpRight size={13} />
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
