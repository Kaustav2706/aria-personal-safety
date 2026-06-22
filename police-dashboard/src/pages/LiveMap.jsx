import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import L from 'leaflet';
import { 
  AlertCircle, 
  Navigation, 
  ShieldAlert, 
  MapPin, 
  Phone, 
  Clock, 
  Crosshair, 
  CheckCircle2, 
  Radio, 
  Activity, 
  Shield,
  Trash2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const POLICE_API_KEY = import.meta.env.VITE_POLICE_API_KEY || '';
const policeHeaders = { 'X-Police-API-Key': POLICE_API_KEY };

export default function LiveMap() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersGroupRef = useRef({});
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const targetIncidentId = queryParams.get('incidentId');
  const hasFocusedTarget = useRef(false);

  useEffect(() => {
    hasFocusedTarget.current = false;
  }, [targetIncidentId]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapInstance.current && mapRef.current) {
      mapInstance.current = L.map(mapRef.current).setView([28.6139, 77.2090], 12);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapInstance.current);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  const createMarkerIcon = (status, riskScore) => {
    const isResolved = status === 'resolved';
    const isHighRisk = (riskScore || 0) >= 70;
    const color = isResolved ? '#10b981' : (isHighRisk ? '#ef4444' : '#f59e0b');

    const pulseHtml = isResolved ? '' : `
      <div style="
        position: absolute;
        width: 32px;
        height: 32px;
        top: -4px;
        left: -4px;
        border-radius: 50%;
        background-color: ${color};
        opacity: 0.25;
        animation: pulse-ring 1.5s infinite ease-in-out;
      "></div>
    `;

    const html = `
      <div style="position: relative; width: 24px; height: 24px;">
        ${pulseHtml}
        <div style="
          position: absolute;
          top: 4px; left: 4px;
          width: 16px; height: 16px;
          border-radius: 50%;
          background-color: ${color};
          border: 2px solid white;
          box-shadow: 0 0 12px ${color};
        "></div>
      </div>
    `;

    return L.divIcon({
      html: html,
      className: 'custom-gps-pin',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  };

  useEffect(() => {
    fetchActiveIncidents();

    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1500
    });

    socket.on('incidentCreated', (newIncident) => {
      setIncidents((prev) => {
        const exists = prev.some(i => i.id === newIncident.id);
        if (exists) return prev;
        return [newIncident, ...prev];
      });
      setSelectedIncident(newIncident);
      if (mapInstance.current) {
        mapInstance.current.setView([newIncident.latitude, newIncident.longitude], 14);
      }
    });

    socket.on('incidentResolved', ({ incidentId }) => {
      setIncidents((prev) => prev.map(inc =>
        inc.id === incidentId ? { ...inc, status: 'resolved' } : inc
      ));
      if (selectedIncident?.id === incidentId) {
        setSelectedIncident(prev => prev ? { ...prev, status: 'resolved' } : null);
      }
    });

    socket.on('globalLocationUpdate', (data) => {
      updateMarkerCoords(data.incidentId, data.latitude, data.longitude, data.riskScore);
      setIncidents((prev) => prev.map(inc =>
        inc.id === data.incidentId
          ? { ...inc, latitude: data.latitude, longitude: data.longitude, riskScore: data.riskScore || inc.riskScore }
          : inc
      ));
    });

    return () => { socket.disconnect(); };
  }, [selectedIncident]);

  useEffect(() => {
    if (!mapInstance.current) return;

    // Clean up markers for incidents that are no longer present
    Object.keys(markersGroupRef.current).forEach((markerId) => {
      const exists = incidents.some(inc => inc.id === markerId);
      if (!exists) {
        markersGroupRef.current[markerId].remove();
        delete markersGroupRef.current[markerId];
      }
    });

    incidents.forEach((inc) => {
      const lat = parseFloat(inc.latitude);
      const lng = parseFloat(inc.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const markerId = inc.id;

      const popupContent = `
        <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #edf2f7; padding: 6px; min-width: 160px;">
          <strong style="display: block; font-size: 13px; margin-bottom: 6px; font-weight: 800;">${inc.userName || 'User'}</strong>
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 9px; margin-bottom: 6px;
            background-color: ${inc.status === 'resolved' ? '#10b981' : ((inc.riskScore || 0) >= 70 ? '#ef4444' : '#f59e0b')}; color: white;">
            ${inc.status.toUpperCase()} (${inc.riskScore || 0}%)
          </span>
          <span style="display: block; font-size: 11px; opacity: 0.8; margin-top: 4px;">Phone: ${inc.userPhone || 'N/A'}</span>
          <span style="display: block; font-size: 11px; opacity: 0.8; margin-top: 2px;">Trigger: ${inc.triggerType}</span>
          <span style="display: block; font-size: 10px; opacity: 0.6; margin-top: 4px; font-family: monospace;">LAT: ${lat.toFixed(5)}° LNG: ${lng.toFixed(5)}°</span>
        </div>
      `;

      if (markersGroupRef.current[markerId]) {
        markersGroupRef.current[markerId].setLatLng([lat, lng]);
        markersGroupRef.current[markerId].setIcon(createMarkerIcon(inc.status, inc.riskScore));
        markersGroupRef.current[markerId].setPopupContent(popupContent);
      } else {
        const icon = createMarkerIcon(inc.status, inc.riskScore);
        const marker = L.marker([lat, lng], { icon }).addTo(mapInstance.current);
        marker.bindPopup(popupContent, { closeButton: false });
        marker.on('click', () => { setSelectedIncident(inc); });
        markersGroupRef.current[markerId] = marker;
      }
    });

    if (targetIncidentId && !hasFocusedTarget.current) {
      const targetInc = incidents.find(i => i.id === targetIncidentId);
      if (targetInc && mapInstance.current) {
        mapInstance.current.setView([targetInc.latitude, targetInc.longitude], 15);
        setSelectedIncident(targetInc);
        hasFocusedTarget.current = true;
      }
    } else {
      const activeIncidents = incidents.filter(i => i.status === 'active');
      if (activeIncidents.length > 0 && mapInstance.current && !selectedIncident) {
        const first = activeIncidents[0];
        mapInstance.current.setView([first.latitude, first.longitude], 13);
        setSelectedIncident(first);
      }
    }
  }, [incidents]);

  const fetchActiveIncidents = async () => {
    try {
      const res = await axios.get(`${API_BASE}/police/incidents`, { headers: policeHeaders });
      setIncidents(res.data.incidents || []);
    } catch (err) {
      console.error('Error fetching dashboard incidents:', err);
    }
  };

  const updateMarkerCoords = (id, lat, lng, score) => {
    if (markersGroupRef.current[id]) {
      markersGroupRef.current[id].setLatLng([lat, lng]);

      const inc = incidents.find(i => i.id === id);
      const status = inc ? inc.status : 'active';
      markersGroupRef.current[id].setIcon(createMarkerIcon(status, score));

      if (selectedIncident && selectedIncident.id === id) {
        setSelectedIncident(prev => ({ ...prev, latitude: lat, longitude: lng, riskScore: score || prev.riskScore }));
        if (mapInstance.current) {
          mapInstance.current.panTo([lat, lng]);
        }
      }
    }
  };

  const handleResolveSelected = async () => {
    if (!selectedIncident) return;
    try {
      await axios.put(`${API_BASE}/police/incidents/${selectedIncident.id}/resolve`, {}, { headers: policeHeaders });
      setIncidents(prev => prev.map(i =>
        i.id === selectedIncident.id ? { ...i, status: 'resolved' } : i
      ));
      setSelectedIncident(prev => prev ? { ...prev, status: 'resolved' } : null);
      if (window.showToast) window.showToast('Incident marked resolved successfully.', 'success');
    } catch (err) {
      console.error('Error resolving incident:', err);
      if (window.showToast) window.showToast('Failed to resolve incident.', 'error');
    }
  };

  const handleDeleteSelected = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this incident record? This will remove it from the map HUD and database.')) {
      return;
    }
    try {
      await axios.delete(`${API_BASE}/incidents/${id}`);
      if (window.showToast) window.showToast('Incident record deleted permanently.', 'success');
      setSelectedIncident(null);
      fetchActiveIncidents();
    } catch (err) {
      console.error('Error deleting incident:', err);
      if (window.showToast) window.showToast('Failed to delete incident record.', 'error');
    }
  };

  const handleCenterMap = (inc) => {
    setSelectedIncident(inc);
    if (mapInstance.current) {
      mapInstance.current.setView([inc.latitude, inc.longitude], 15);
    }
  };

  const activeCount = incidents.filter(i => i.status === 'active').length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', height: 'calc(100vh - 148px)' }} className="animate-fade-in-up">

      {/* ── Map Viewport ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
              Tactical GPS Telemetry
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '2px' }}>
              GIS mapping system plotting live incident coordinates and emergency channels
            </p>
          </div>
          <div className="badge badge-live" style={{ gap: '6px' }}>
            <span className="pulse-dot" />
            Triangulating Coordinates
          </div>
        </div>

        {/* Leaflet map wrapper container */}
        <div style={{ position: 'relative', flex: 1, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
          
          {/* Tactical Floating HUD HUD-overlay */}
          <div className="tactical-hud">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(56, 78, 122, 0.3)', paddingBottom: '6px', marginBottom: '2px' }}>
              <Activity size={12} style={{ color: 'var(--color-cyan)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Tactical HUD</span>
            </div>
            <div className="tactical-hud-item">
              <span className="tactical-hud-label">GPS Nodes:</span>
              <span className="tactical-hud-value" style={{ color: activeCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {activeCount} Active Beacons
              </span>
            </div>
            <div className="tactical-hud-item">
              <span className="tactical-hud-label">GIS Stream:</span>
              <span className="tactical-hud-value">98.5% (Secure)</span>
            </div>
            <div className="tactical-hud-item">
              <span className="tactical-hud-label">Nearest Dispatch:</span>
              <span className="tactical-hud-value" style={{ color: selectedIncident ? 'var(--color-cyan)' : 'var(--text-muted)' }}>
                {selectedIncident && selectedIncident.status === 'active' ? 'Unit 5 (Responding)' : 'Standby'}
              </span>
            </div>
            {selectedIncident && selectedIncident.status === 'active' && (
              <>
                <div className="tactical-hud-item">
                  <span className="tactical-hud-label">ETA to Target:</span>
                  <span className="tactical-hud-value">~6 mins</span>
                </div>
              </>
            )}
          </div>

          <div
            ref={mapRef}
            style={{
              width: '100%',
              height: '100%',
              minHeight: '400px',
              zIndex: 1,
            }}
          />
        </div>
      </div>

      {/* ── Side Panel ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '4px' }}>

        {/* Selected Incident Detail Card */}
        {selectedIncident ? (
          <div className="glass-card animate-fade-in-up" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            borderLeft: `4px solid ${selectedIncident.status === 'active' ? 'var(--color-danger)' : 'var(--color-success)'}`,
            padding: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                  {selectedIncident.userName || 'Registered User'}
                </h3>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  ID: #{selectedIncident.id?.slice(-12).toUpperCase()}
                </span>
              </div>
              <span className={`badge ${selectedIncident.riskScore >= 70 ? 'badge-danger border-glow-red' : 'badge-warning'}`} style={{ fontSize: '0.65rem', fontWeight: 800 }}>
                RISK: {selectedIncident.riskScore}%
              </span>
            </div>

            <div className="section-divider" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '2px' }}>
                  Trigger Cause
                </span>
                <span className="badge badge-info" style={{ textTransform: 'capitalize', fontSize: '0.6rem' }}>{selectedIncident.triggerType}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                  <Crosshair size={10} style={{ color: 'var(--text-muted)' }} /> Coordinates
                </span>
                <span style={{ color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600 }}>
                  LAT: {selectedIncident.latitude?.toFixed(6)}° • LNG: {selectedIncident.longitude?.toFixed(6)}°
                </span>
              </div>
              {selectedIncident.audioTranscript && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '2px' }}>
                    Speech Transcription
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.78rem', display: 'block', padding: '6px 10px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', borderLeft: '2.5px solid var(--color-cyan)' }}>
                    "{selectedIncident.audioTranscript}"
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              {selectedIncident.status === 'active' ? (
                <button className="btn btn-success" onClick={handleResolveSelected} style={{ width: '100%', justifyContent: 'center', borderRadius: '8px', fontWeight: 800 }}>
                  <CheckCircle2 size={14} /> Resolve Beacon
                </button>
              ) : (
                <button className="btn btn-ghost" onClick={() => navigate(`/reports/${selectedIncident.id}`)} style={{ width: '100%', justifyContent: 'center', borderRadius: '8px', fontWeight: 800 }}>
                  View Report Dossier
                </button>
              )}
              <button 
                className="btn btn-danger" 
                onClick={(e) => handleDeleteSelected(selectedIncident.id, e)} 
                style={{ width: '100%', justifyContent: 'center', borderRadius: '8px', fontWeight: 800, gap: '6px' }}
              >
                <Trash2 size={13} /> Delete Beacon Record
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <AlertCircle size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 10px', opacity: 0.3 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
              Select a tactical map beacon to inspect GPS metadata
            </p>
          </div>
        )}

        {/* Active Beacons List */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflow: 'hidden', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Radio size={13} style={{ color: 'var(--color-info)' }} />
              Live Beacons
            </h3>
            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 700 }}>
              {activeCount} active / {incidents.length} logs
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }}>
            {incidents.map((inc) => (
              <div
                key={inc.id}
                onClick={() => handleCenterMap(inc)}
                style={{
                  padding: '11px 14px',
                  backgroundColor: selectedIncident?.id === inc.id ? 'var(--bg-elevated)' : 'rgba(255,255,255,0.015)',
                  border: `1px solid ${selectedIncident?.id === inc.id ? 'rgba(59, 130, 246, 0.45)' : 'rgba(56, 78, 122, 0.15)'}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>{inc.userName || 'Registered User'}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                    <span className={`badge ${inc.status === 'active' ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.55rem', padding: '0px 5px', border: 'none' }}>
                      {inc.status === 'active' ? '●' : '✓'}
                    </span>
                    {inc.triggerType}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color: inc.riskScore >= 70 ? 'var(--color-danger)' : 'var(--color-warning)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {inc.riskScore}%
                  </span>
                  <Navigation size={11} style={{ transform: 'rotate(45deg)', color: 'var(--color-info)', opacity: 0.6 }} />
                </div>
              </div>
            ))}
            {incidents.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '24px 0' }}>
                No active threats detected
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
