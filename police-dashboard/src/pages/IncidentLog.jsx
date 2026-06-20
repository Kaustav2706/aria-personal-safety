import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, FileText, CheckCircle2, AlertOctagon, Filter, RefreshCw, ExternalLink } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

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
      const res = await axios.get(`${API_BASE}/incidents`);
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
      await axios.put(`${API_BASE}/incidents/${id}/resolve`);
      fetchIncidents();
    } catch (err) {
      console.error('Error resolving incident:', err);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>
            Incident Dispatch Records
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px', fontWeight: 500 }}>
            Inspect audit records and diagnostic telemetry from past safety alarms
          </p>
        </div>
        <button className="btn btn-ghost" onClick={fetchIncidents} style={{ fontSize: '0.75rem', padding: '8px 14px' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── Filters Bar ───────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
          <Filter size={13} /> FILTERS
        </div>

        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: 1,
          minWidth: '220px',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '0 12px',
          transition: 'border-color 0.2s',
        }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by name, ID, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input"
            style={{ border: 'none', padding: '8px 0', background: 'transparent', flex: 1 }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {/* Trigger Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Trigger:</span>
          <select className="select" value={triggerFilter} onChange={(e) => setTriggerFilter(e.target.value)}>
            <option value="all">All Triggers</option>
            <option value="manual">Manual SOS</option>
            <option value="monitoring">AI Monitoring</option>
            <option value="audio">Voice Distress</option>
            <option value="motion">Fall Sensor</option>
          </select>
        </div>

        {/* Results count */}
        <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
          {filteredIncidents.length} records
        </div>
      </div>

      {/* ── Results Table ─────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Incident ID</th>
                <th>User Info</th>
                <th>Trigger</th>
                <th>Risk Score</th>
                <th>Timestamp</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
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
                  style={{ cursor: 'pointer', animation: `fadeInUp 0.3s ease-out ${idx * 0.03}s backwards` }}
                >
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-accent)', fontSize: '0.8rem', fontWeight: 600 }}>
                      {inc.id?.slice(-12) || inc.id}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.85rem' }}>{inc.userName || 'Registered User'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{inc.userPhone}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>
                      Latitude: {inc.latitude?.toFixed(4)}°, Longitude: {inc.longitude?.toFixed(4)}°
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-info" style={{ textTransform: 'capitalize', fontSize: '0.65rem' }}>
                      {inc.triggerType}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{
                        color: inc.riskScore >= 70 ? 'var(--color-danger)' : inc.riskScore >= 40 ? 'var(--color-warning)' : 'var(--color-success)',
                        fontSize: '0.95rem',
                        fontWeight: 800,
                      }}>
                        {inc.riskScore}%
                      </strong>
                      <div className="risk-gauge" style={{ width: '48px' }}>
                        <div className="risk-gauge-fill" style={{
                          width: `${inc.riskScore}%`,
                          background: inc.riskScore >= 70 ? 'var(--color-danger)' : inc.riskScore >= 40 ? 'var(--color-warning)' : 'var(--color-success)',
                        }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                      {new Date(inc.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${inc.status === 'active' ? 'badge-danger' : 'badge-success'}`}>
                      {inc.status === 'active' ? '● ACTIVE' : '✓ RESOLVED'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (inc.status === 'active') {
                            navigate(`/map?incidentId=${inc.id}`);
                          } else {
                            navigate(`/reports/${inc.id}`);
                          }
                        }}
                        style={{ padding: '5px 10px', fontSize: '0.72rem' }}
                      >
                        <FileText size={12} /> Details
                      </button>
                      {inc.status === 'active' && (
                        <button
                          className="btn btn-success"
                          onClick={(e) => handleResolve(inc.id, e)}
                          style={{ padding: '5px 10px', fontSize: '0.72rem' }}
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredIncidents.length === 0 && !loading && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <Search size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                    <p>No incident logs found matching criteria</p>
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan="7" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton" style={{ height: '42px', width: '100%' }} />
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
