import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, Calendar, FileText, CheckCircle2, AlertOctagon, HelpCircle } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function IncidentLog() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [triggerFilter, setTriggerFilter] = useState('all');

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      const res = await axios.get(`${API_BASE}/incidents`);
      setIncidents(res.data.incidents || []);
    } catch (err) {
      console.error('Error fetching incident logs:', err);
    }
  };

  const handleResolve = async (id) => {
    try {
      await axios.put(`${API_BASE}/incidents/${id}/resolve`);
      fetchIncidents();
    } catch (err) {
      console.error('Error resolving incident:', err);
    }
  };

  // Filtering Logic
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
      <div>
        <h2 style={{ fontSize: '1.5rem', color: '#fff' }}>Historical Incident Dispatch Records</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Inspect audit records and diagnostic telemetry from past safety alarms.</p>
      </div>

      {/* Query Filters */}
      <div 
        className="glass-card" 
        style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '16px', 
          alignItems: 'center', 
          padding: '16px 20px',
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-color)'
        }}
      >
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 12px' }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by name, ID or phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ backgroundColor: 'transparent', border: 'none', color: '#fff', fontSize: '0.875rem', outline: 'none', width: '100%' }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status:</span>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {/* Trigger Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Trigger:</span>
          <select 
            value={triggerFilter}
            onChange={(e) => setTriggerFilter(e.target.value)}
            style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">All Triggers</option>
            <option value="manual">Manual SOS</option>
            <option value="audio">Voice Distress</option>
            <option value="motion">Fall Sensor</option>
          </select>
        </div>
      </div>

      {/* Results table */}
      <div className="glass-card" style={{ padding: 0, overflowX: 'auto', border: '1px solid var(--border-color)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
              <th style={{ padding: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Incident ID</th>
              <th style={{ padding: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>User info</th>
              <th style={{ padding: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Trigger</th>
              <th style={{ padding: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Risk Score</th>
              <th style={{ padding: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Timestamp</th>
              <th style={{ padding: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncidents.map((inc) => (
              <tr 
                key={inc.id}
                style={{ 
                  borderBottom: '1px solid var(--border-color)',
                  transition: '0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <td style={{ padding: '16px', fontSize: '0.9rem', color: '#3b82f6', fontFamily: 'monospace' }}>
                  {inc.id}
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9rem' }}>{inc.userName || 'Registered User'}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{inc.userPhone}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.8rem', color: '#fff', textTransform: 'capitalize' }}>
                    {inc.triggerType}
                  </span>
                </td>
                <td style={{ padding: '16px' }}>
                  <strong style={{ color: inc.riskScore >= 70 ? '#ef4444' : '#f59e0b', fontSize: '0.95rem' }}>
                    {inc.riskScore}%
                  </strong>
                </td>
                <td style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {new Date(inc.createdAt).toLocaleString()}
                </td>
                <td style={{ padding: '16px' }}>
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
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: '8px' }}>
                    <button
                      onClick={() => navigate(`/reports/${inc.id}`)}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: '#fff',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <FileText size={14} /> Details
                    </button>

                    {inc.status === 'active' && (
                      <button
                        onClick={() => handleResolve(inc.id)}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          borderRadius: '4px',
                          color: '#10b981',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {filteredIncidents.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No incident logs found matching criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
