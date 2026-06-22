import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import { 
  AlertOctagon, 
  CheckCircle2, 
  ShieldAlert, 
  ArrowRight, 
  ArrowUpRight, 
  Phone, 
  MapPin, 
  Activity, 
  Clock, 
  TrendingUp, 
  Radio, 
  Zap, 
  Eye,
  Volume2,
  Trash2
} from 'lucide-react';

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
      setIncidents(prev => {
        const exists = prev.some(i => i.id === newIncident.id);
        if (exists) return prev;
        return [newIncident, ...prev];
      });
      setAlertBanner(newIncident);
      setTimeout(() => setAlertBanner(null), 12000);
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
      if (window.showToast) window.showToast('Incident resolved successfully.', 'success');
      fetchIncidents();
    } catch (err) {
      console.error('Error resolving incident:', err);
      if (window.showToast) window.showToast('Failed to resolve incident. Check authorization.', 'error');
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this incident record? This cannot be undone.')) {
      return;
    }
    try {
      await axios.delete(`${API_BASE}/incidents/${id}`);
      if (window.showToast) window.showToast('Incident record deleted permanently.', 'success');
      fetchIncidents();
    } catch (err) {
      console.error('Error deleting incident:', err);
      if (window.showToast) window.showToast('Failed to delete incident record.', 'error');
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
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Critical SOS Alert Banner ─────────────────────────────────── */}
      {alertBanner && (
        <div 
          className="alert-banner border-glow-red" 
          onClick={() => navigate(`/map?incidentId=${alertBanner.id}`)}
          style={{
            boxShadow: '0 0 25px rgba(239, 68, 68, 0.4), inset 0 0 15px rgba(239, 68, 68, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', zIndex: 1 }}>
            <div style={{ 
              padding: '12px', 
              backgroundColor: 'rgba(239, 68, 68, 0.2)', 
              border: '1.5px solid rgba(255, 255, 255, 0.25)', 
              borderRadius: '12px', 
              backdropFilter: 'blur(8px)',
              animation: 'pulse-ring 2s infinite ease-in-out'
            }}>
              <AlertOctagon size={28} style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '1.15rem', fontWeight: 900, letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.5)', textTransform: 'uppercase' }}>
                  Critical Threat Triggered
                </strong>
                <span className="badge" style={{ background: '#fff', color: '#dc2626', border: 'none', fontWeight: 900, px: '12px' }}>
                  RISK: {alertBanner.riskScore}%
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', opacity: 0.95, marginTop: '4px', fontWeight: 650 }}>
                Victim: {alertBanner.userName || 'Registered User'} • Phone: {alertBanner.userPhone} • Channel: {alertBanner.triggerType?.toUpperCase()}
              </p>
            </div>
          </div>
          <div className="btn" style={{ 
            background: 'rgba(255, 255, 255, 0.15)', 
            border: '1px solid rgba(255, 255, 255, 0.3)', 
            color: '#fff', 
            zIndex: 1, 
            backdropFilter: 'blur(8px)', 
            fontSize: '0.78rem',
            borderRadius: 'var(--radius-sm)',
            transition: 'all 0.2s',
            fontWeight: 800
          }}>
            RESPOND NOW <ArrowRight size={14} />
          </div>
        </div>
      )}

      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', background: 'linear-gradient(90deg, #fff 0%, #93c5fd 50%, #c7d2fe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Command Center
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px', fontWeight: 600 }}>
            Real-time threat intelligence feeds, incident queues, and global safety tracking
          </p>
        </div>
        <div>
          <button className="btn btn-ghost" onClick={fetchIncidents} style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}>
            <Radio size={14} className="pulse-dot" style={{ color: 'var(--color-success)' }} /> Poll Server
          </button>
        </div>
      </div>

      {/* ── Stats Grid ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>

        {/* Active Threats */}
        <div className={`glass-card stat-card ${stats.active > 0 ? 'border-glow-red' : ''}`} style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, var(--bg-card) 100%)' }}>
          <div>
            <p className="stat-label">Active Threats</p>
            <h3 className="stat-value" style={{ color: stats.active > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>{stats.active}</h3>
            {stats.active > 0 ? (
              <p style={{ fontSize: '0.72rem', color: 'var(--color-danger)', fontWeight: 800, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span className="pulse-dot" /> IMMEDIATE THREAT
              </p>
            ) : (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 550, marginTop: '6px' }}>Status clear</p>
            )}
          </div>
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--color-danger)', boxShadow: stats.active > 0 ? '0 0 10px rgba(239, 68, 68, 0.15)' : 'none' }}>
            <AlertOctagon size={24} />
          </div>
        </div>

        {/* Resolved */}
        <div className="glass-card stat-card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.03) 0%, var(--bg-card) 100%)' }}>
          <div>
            <p className="stat-label">Resolved SOS</p>
            <h3 className="stat-value" style={{ color: 'var(--color-success)' }}>{stats.resolved}</h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 550, marginTop: '6px' }}>Resolved cases</p>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: 'var(--color-success)' }}>
            <CheckCircle2 size={24} />
          </div>
        </div>

        {/* Mean Risk */}
        <div className={`glass-card stat-card ${stats.avgRisk >= 60 ? 'border-glow-red' : stats.avgRisk >= 30 ? 'border-glow-purple' : ''}`} style={{ padding: '24px' }}>
          <div>
            <p className="stat-label">Avg Threat Risk</p>
            <h3 className="stat-value" style={{ color: stats.avgRisk >= 60 ? 'var(--color-danger)' : stats.avgRisk >= 30 ? 'var(--color-warning)' : 'var(--color-success)' }}>{stats.avgRisk}%</h3>
            <div className="risk-gauge" style={{ width: '90px', marginTop: '8px' }}>
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
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', color: 'var(--color-warning)' }}>
            <Activity size={24} />
          </div>
        </div>

        {/* Total Incidents */}
        <div className="glass-card stat-card" style={{ padding: '24px' }}>
          <div>
            <p className="stat-label">Total Dossiers</p>
            <h3 className="stat-value" style={{ color: 'var(--text-accent)' }}>{stats.total}</h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 550, marginTop: '6px' }}>Network archive</p>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', color: 'var(--color-info)' }}>
            <TrendingUp size={24} />
          </div>
        </div>

      </div>

      {/* ── Main Content Grid ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>

        {/* ── Activity Feed ───────────────────────────────────────────── */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Live Incident Stream</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>Active emergency beacons and telemetry pipeline</p>
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => navigate('/logs')}
              style={{ fontSize: '0.72rem', padding: '7px 14px', borderRadius: '6px' }}
            >
              Archive logs <ArrowUpRight size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {incidents.slice(0, 5).map((inc, idx) => (
              <div
                key={inc.id}
                className={`incident-row ${inc.status === 'active' ? 'incident-row-active border-glow-red' : 'incident-row-resolved'}`}
                onClick={() => {
                  if (inc.status === 'active') {
                    navigate(`/map?incidentId=${inc.id}`);
                  } else {
                    navigate(`/reports/${inc.id}`);
                  }
                }}
                style={{
                  animationDelay: `${idx * 0.05}s`,
                  background: inc.status === 'active' ? 'rgba(239, 68, 68, 0.015)' : 'var(--bg-tertiary)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: '12px',
                  transition: 'all 0.2s ease',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span className={`badge ${inc.status === 'active' ? 'badge-danger' : 'badge-success'}`} style={{ padding: '2px 8px', fontSize: '0.62rem' }}>
                      {inc.status === 'active' ? '● ACTIVE SOS' : '✓ RESOLVED'}
                    </span>
                    <strong style={{ color: '#fff', fontSize: '0.92rem', fontWeight: 800 }}>{inc.userName || 'Registered User'}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
                      #{inc.id?.slice(-8).toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                    {inc.userPhone && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Phone size={12} style={{ color: 'var(--text-muted)' }} /> {inc.userPhone}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <MapPin size={12} style={{ color: 'var(--text-muted)' }} /> Lat: {inc.latitude?.toFixed(5)}°, Lng: {inc.longitude?.toFixed(5)}°
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Clock size={12} style={{ color: 'var(--text-muted)' }} /> {formatTimeAgo(inc.createdAt)}
                    </span>
                  </div>

                  {inc.audioTranscript && (
                    <div style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      background: 'rgba(6, 10, 19, 0.4)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      marginTop: '4px',
                      borderLeft: '2.5px solid var(--color-cyan)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Volume2 size={12} style={{ color: 'var(--color-cyan)', flexShrink: 0 }} />
                      <span>"{inc.audioTranscript}"</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Risk Rating</div>
                    <div style={{
                      fontSize: '1.35rem',
                      fontWeight: 900,
                      color: inc.riskScore >= 75 ? 'var(--color-danger)' : inc.riskScore >= 40 ? 'var(--color-warning)' : 'var(--color-success)',
                      fontFamily: 'var(--font-mono)',
                      lineHeight: 1,
                      marginTop: '3px',
                    }}>
                      {inc.riskScore}%
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {inc.status === 'active' ? (
                      <button
                        className="btn btn-success"
                        onClick={(e) => handleResolve(inc.id, e)}
                        style={{ padding: '8px 14px', fontSize: '0.75rem', borderRadius: '8px', fontWeight: 800 }}
                      >
                        Resolve
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost"
                        onClick={() => navigate(`/reports/${inc.id}`)}
                        style={{ padding: '8px 10px', border: 'none', background: 'transparent' }}
                        title="View Dossier Report"
                      >
                        <CheckCircle2 size={22} style={{ color: 'var(--color-success)', opacity: 0.9 }} />
                      </button>
                    )}
                    <button
                      className="btn btn-danger"
                      onClick={(e) => handleDelete(inc.id, e)}
                      style={{ padding: '8px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Delete Incident Dossier"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {incidents.length === 0 && (
              <div style={{ textAlign: 'center', padding: '64px 20px', border: '1.5px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                <Eye size={40} style={{ opacity: 0.3, margin: '0 auto 14px', color: 'var(--text-secondary)' }} />
                <h4 style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 800 }}>No safety alarms on record</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>Incident streaming nodes will display here in real-time</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Sidebar ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* System Health Panel */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '8px', 
                background: 'rgba(99, 102, 241, 0.1)', 
                border: '1px solid rgba(99, 102, 241, 0.25)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: 'var(--color-accent)' 
              }}>
                <Zap size={16} />
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>Secure Network Links</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { name: 'AI Tone & Whisper Engine', status: 'ONLINE', port: '8000', color: 'var(--color-success)' },
                { name: 'Express GPS Gateway', status: 'ACTIVE', port: '5000', color: 'var(--color-success)' },
                { name: 'Twilio SMS Outpost', status: 'CONNECTED', port: null, color: 'var(--color-cyan)' },
                { name: 'Firebase APNs Push', status: 'CONNECTED', port: null, color: 'var(--color-cyan)' },
              ].map((service, idx) => (
                <div key={service.name} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: idx < 3 ? '1px solid rgba(56, 78, 122, 0.2)' : 'none',
                }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 650 }}>{service.name}</span>
                  <span style={{
                    color: service.color,
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-mono)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    letterSpacing: '0.03em',
                  }}>
                    <span style={{ 
                      width: '6px', 
                      height: '6px', 
                      borderRadius: '50%', 
                      background: service.color, 
                      display: 'inline-block', 
                      boxShadow: `0 0 10px ${service.color}` 
                    }} />
                    {service.status}{service.port ? `:${service.port}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Action — Tactical Map */}
          <div
            className="glass-card border-glow-blue"
            style={{
              cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.04) 0%, var(--bg-card) 100%)',
              position: 'relative',
              overflow: 'hidden',
              padding: '24px',
            }}
            onClick={() => navigate('/map')}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '40%',
              background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.05) 0%, transparent 100%)',
              pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <MapPin size={16} style={{ color: 'var(--color-info)' }} />
                <h4 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 900 }}>Tactical Response Map</h4>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5, fontWeight: 550 }}>
                Live GPS tracking, geographical signal triangulation, and dispatch responder routes.
              </p>
              <div style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--color-info)', fontWeight: 800, letterSpacing: '0.02em' }}>
                Launch map HUD <ArrowUpRight size={13} />
              </div>
            </div>
          </div>

          {/* Quick Action — Incident Logs */}
          <div
            className="glass-card border-glow-purple"
            style={{
              cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, var(--bg-card) 100%)',
              padding: '24px',
            }}
            onClick={() => navigate('/logs')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <ShieldAlert size={16} style={{ color: 'var(--color-accent)' }} />
              <h4 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 900 }}>Secure Logs Archive</h4>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5, fontWeight: 550 }}>
              Search, filter, and audit past incident logs with complete historical voice analysis records.
            </p>
            <div style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--color-accent)', fontWeight: 800, letterSpacing: '0.02em' }}>
              Browse dossiers <ArrowUpRight size={13} />
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
