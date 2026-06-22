import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, FileText, CheckCircle2, AlertOctagon, Filter, RefreshCw, Trash2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const POLICE_API_KEY = import.meta.env.VITE_POLICE_API_KEY || '';
const policeHeaders = { 'X-Police-API-Key': POLICE_API_KEY };

export default function IncidentLog() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [triggerFilter, setTriggerFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/police/incidents`, { headers: policeHeaders });
      setIncidents(res.data.incidents || []);
    } catch (err) {
      console.error('Error fetching incident logs:', err);
    } finally {
      setLoading(false);
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
      if (window.showToast) window.showToast('Failed to resolve incident.', 'error');
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

  const filteredIncidents = incidents.filter(inc => {
    const matchesSearch =
      (inc.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inc.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inc.userPhone || '').includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || inc.status === statusFilter;
    const matchesTrigger = triggerFilter === 'all' || inc.triggerType === triggerFilter;
    return matchesSearch && matchesStatus && matchesTrigger;
  });

  return (
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', background: 'linear-gradient(90deg, #fff 0%, #a5b4fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Incident Dispatch Records
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', fontWeight: 600 }}>
            Audit database repository containing live telemetry and historical threat archives
          </p>
        </div>
        <button className="btn btn-ghost" onClick={fetchIncidents} style={{ fontSize: '0.78rem', padding: '8px 14px', borderRadius: '8px' }}>
          <RefreshCw size={13} /> Refresh List
        </button>
      </div>

      {/* ── Filters Bar ───────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '16px 24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.04em' }}>
          <Filter size={14} style={{ color: 'var(--color-info)' }} /> ARCHIVE SEARCH
        </div>

        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flex: 1,
          minWidth: '240px',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '0 14px',
          transition: 'border-color 0.2s',
        }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Filter by victim name, ID hash, or phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input"
            style={{ border: 'none', padding: '10px 0', background: 'transparent', flex: 1 }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Status:</span>
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ borderRadius: '8px' }}>
            <option value="all">All States</option>
            <option value="active">Active Threats</option>
            <option value="resolved">Resolved Cases</option>
          </select>
        </div>

        {/* Trigger Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Channel:</span>
          <select className="select" value={triggerFilter} onChange={(e) => setTriggerFilter(e.target.value)} style={{ borderRadius: '8px' }}>
            <option value="all">All Triggers</option>
            <option value="manual">Manual SOS Button</option>
            <option value="monitoring">AI Monitoring</option>
            <option value="audio">Voice Distress Trigger</option>
            <option value="motion">Fall Detection Sensor</option>
          </select>
        </div>

        {/* Results count */}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
          {filteredIncidents.length} records found
        </div>
      </div>

      {/* ── Results Table ─────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden', borderRadius: '14px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: '24px' }}>Incident ID</th>
                <th>Victim Profile</th>
                <th>Trigger mechanism</th>
                <th>Threat Risk Score</th>
                <th>Logged Timestamp</th>
                <th>Dispatch State</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map((inc, idx) => (
                <tr
                  key={inc.id}
                  onClick={() => {
                    if (inc.status === 'active') {
                      navigate(`/map?incidentId=${inc.id}`);
                    } else {
                      navigate(`/reports/${inc.id}`);
                    }
                  }}
                  style={{ 
                    cursor: 'pointer', 
                    animation: `fadeInUp 0.3s ease-out ${idx * 0.02}s backwards`,
                  }}
                >
                  <td style={{ paddingLeft: '24px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-accent)', fontSize: '0.8rem', fontWeight: 600 }}>
                      #{inc.id?.slice(-12).toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.88rem' }}>{inc.userName || 'Registered User'}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{inc.userPhone}</div>
                  </td>
                  <td>
                    <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '0.62rem', fontWeight: 800 }}>
                      {inc.triggerType}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <strong style={{
                        color: inc.riskScore >= 70 ? 'var(--color-danger)' : inc.riskScore >= 40 ? 'var(--color-warning)' : 'var(--color-success)',
                        fontSize: '0.95rem',
                        fontWeight: 900,
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {inc.riskScore}%
                      </strong>
                      <div className="risk-gauge" style={{ width: '60px' }}>
                        <div className="risk-gauge-fill" style={{
                          width: `${inc.riskScore}%`,
                          background: inc.riskScore >= 70 ? 'var(--color-danger)' : inc.riskScore >= 40 ? 'var(--color-warning)' : 'var(--color-success)',
                        }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {new Date(inc.createdAt).toLocaleString(undefined, { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${inc.status === 'active' ? 'badge-danger' : 'badge-success'}`} style={{ fontWeight: 800, fontSize: '0.62rem' }}>
                      {inc.status === 'active' ? '● ACTIVE' : '✓ RESOLVED'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          if (inc.status === 'active') {
                            navigate(`/map?incidentId=${inc.id}`);
                          } else {
                            navigate(`/reports/${inc.id}`);
                          }
                        }}
                        style={{ padding: '6px 12px', fontSize: '0.72rem', borderRadius: '6px', fontWeight: 800 }}
                      >
                        <FileText size={12} /> Dossier
                      </button>
                      {inc.status === 'active' && (
                        <button
                          className="btn btn-success"
                          onClick={(e) => handleResolve(inc.id, e)}
                          style={{ padding: '6px 12px', fontSize: '0.72rem', borderRadius: '6px', fontWeight: 800 }}
                        >
                          Resolve
                        </button>
                      )}
                      <button
                        className="btn btn-danger"
                        onClick={(e) => handleDelete(inc.id, e)}
                        style={{ padding: '6px 10px', fontSize: '0.72rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Delete Dossier"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredIncidents.length === 0 && !loading && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '64px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    <Search size={32} style={{ opacity: 0.25, margin: '0 auto 10px' }} />
                    <p style={{ fontWeight: 600 }}>No incident dispatch records found matching criteria</p>
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan="7" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton" style={{ height: '48px', width: '100%', borderRadius: '8px' }} />
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
