import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import { AlertOctagon, CheckCircle2, ShieldAlert, ArrowRight, User, Phone, MapPin, Activity } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

export default function Dashboard() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({ active: 0, resolved: 0, avgRisk: 0 });
  const [alertBanner, setAlertBanner] = useState(null);

  useEffect(() => {
    fetchIncidents();

    // Setup socket connection
    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1500
    });

    socket.on('incidentCreated', (newIncident) => {
      setIncidents(prev => [newIncident, ...prev]);
      setAlertBanner(newIncident);
      // Automatically clear banner after 10 seconds
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

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    // Recalculate stats when incidents array changes
    const active = incidents.filter(i => i.status === 'active').length;
    const resolved = incidents.filter(i => i.status === 'resolved').length;
    const totalRisk = incidents.reduce((sum, i) => sum + (i.riskScore || 0), 0);
    const avgRisk = incidents.length ? Math.round(totalRisk / incidents.length) : 0;

    setStats({ active, resolved, avgRisk });
  }, [incidents]);

  const fetchIncidents = async () => {
    try {
      const res = await axios.get(`${API_BASE}/incidents`);
      setIncidents(res.data.incidents || []);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    }
  };

  const handleResolve = async (id, e) => {
    e.stopPropagation();
    try {
      await axios.put(`${API_BASE}/incidents/${id}/resolve`);
      fetchIncidents();
    } catch (err) {
      console.error('Error resolving incident:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Real-time Toast Banner for incoming threat */}
      {alertBanner && (
        <div 
          onClick={() => navigate(`/reports/${alertBanner.id}`)}
          style={{
            background: 'linear-gradient(90deg, #be123c 0%, #e11d48 100%)',
            border: '2px solid #f43f5e',
            borderRadius: '12px',
            padding: '16px 24px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'between',
            boxShadow: '0 0 30px rgba(225, 29, 72, 0.4)',
            cursor: 'pointer',
            animation: 'glow-red 2.5s infinite',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '8px' }}>
              <AlertOctagon size={28} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '1.1rem', fontFamily: 'var(--font-display)' }}>CRITICAL SOS TRIGGERED</strong>
                <span className="pulse-badge" style={{ backgroundColor: '#fff', color: '#be123c', border: 'none' }}>
                  RISK: {alertBanner.riskScore}%
                </span>
              </div>
              <p style={{ fontSize: '0.9rem', opacity: 0.95, marginTop: '2px' }}>
                Victim: {alertBanner.userName || 'Registered User'} | Phone: {alertBanner.userPhone} | Trigger: {alertBanner.triggerType.toUpperCase()}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '0.9rem' }}>
            RESPOND DISPATCH <ArrowRight size={16} />
          </div>
        </div>
      )}

      {/* Grid Stats Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        {/* Active Threats */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Active Threats</p>
            <h3 style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: '#ef4444', marginTop: '4px' }}>{stats.active}</h3>
          </div>
          <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#ef4444' }}>
            <AlertOctagon size={32} />
          </div>
        </div>

        {/* Resolved Actions */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Resolved Incidents</p>
            <h3 style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: '#10b981', marginTop: '4px' }}>{stats.resolved}</h3>
          </div>
          <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', color: '#10b981' }}>
            <CheckCircle2 size={32} />
          </div>
        </div>

        {/* Mean Risk Score */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Mean Threat Risk</p>
            <h3 style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: '#f59e0b', marginTop: '4px' }}>{stats.avgRisk}%</h3>
          </div>
          <div style={{ padding: '12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px', color: '#f59e0b' }}>
            <Activity size={32} />
          </div>
        </div>

      </div>

      {/* Main View Grid: Active List vs Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Active Threats Log */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', color: '#fff' }}>Recent Activity Dispatch Feed</h3>
            <button 
              onClick={() => navigate('/logs')}
              style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              All Logs <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {incidents.slice(0, 5).map((inc) => (
              <div 
                key={inc.id}
                onClick={() => navigate(`/reports/${inc.id}`)}
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: `1px solid ${inc.status === 'active' ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: '0.2s'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span 
                      style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold', 
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        backgroundColor: inc.status === 'active' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: inc.status === 'active' ? '#ef4444' : '#10b981',
                        border: `1px solid ${inc.status === 'active' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                      }}
                    >
                      {inc.status.toUpperCase()}
                    </span>
                    <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{inc.userName || 'Registered User'}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{inc.id}</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={13} /> {inc.userPhone}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={13} /> {inc.latitude.toFixed(4)}, {inc.longitude.toFixed(4)}
                    </span>
                  </div>

                  {inc.audioTranscript && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                      &ldquo;{inc.audioTranscript}&rdquo;
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Risk Level</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: inc.riskScore >= 75 ? '#ef4444' : '#f59e0b' }}>
                      {inc.riskScore}%
                    </div>
                  </div>

                  {inc.status === 'active' ? (
                    <button 
                      onClick={(e) => handleResolve(inc.id, e)}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        borderRadius: '6px',
                        color: '#10b981',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        transition: '0.2s'
                      }}
                      onMouseOver={(e) => e.target.style.backgroundColor = '#10b981' + '33'}
                      onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(16, 185, 129, 0.2)'}
                    >
                      Resolve
                    </button>
                  ) : (
                    <div style={{ width: '70px', textAlign: 'center', color: '#10b981' }}>
                      <CheckCircle2 size={20} style={{ margin: '0 auto' }} />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {incidents.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No recorded safety incidents found.
              </div>
            )}
          </div>
        </div>

        {/* System Diagnostics status panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} className="text-rose-500" />
              ARIA Status Engine
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>AI Engine</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>ONLINE (8000)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Websocket Bridge</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>ACTIVE (5000)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Twilio Service</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>MOCK_ACTIVE</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Firebase SDK</span>
                <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>MOCK_ACTIVE</span>
              </div>
            </div>
          </div>

          <div 
            className="glass-card" 
            style={{ 
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.02) 100%)', 
              borderColor: 'rgba(59, 130, 246, 0.3)',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/map')}
          >
            <h4 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 'bold' }}>Tactical Dispatch Map</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
              Open tactical GIS display with live telemetry plotting for responders.
            </p>
            <div style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#3b82f6', fontWeight: 'bold' }}>
              Launch GIS Panel <ArrowRight size={14} />
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
