import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import L from 'leaflet';
import { AlertCircle, Navigation, ShieldAlert, MapPin, Phone, Clock, Crosshair, CheckCircle2, Radio } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const POLICE_API_KEY = import.meta.env.VITE_POLICE_API_KEY || '';
const policeHeaders = { 'X-Police-API-Key': POLICE_API_KEY };

export default function LiveMap() {
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

  // Initialize Map
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
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: ${color};
        opacity: 0.3;
        animation: pulse-ring 1.8s infinite ease-in-out;
      "></div>
    `;

    const html = `
      <div style="position: relative; width: 24px; height: 24px;">
        ${pulseHtml}
        <div style="
          position: absolute;
          top: 5px; left: 5px;
          width: 14px; height: 14px;
          border-radius: 50%;
          background-color: ${color};
          border: 2.5px solid white;
          box-shadow: 0 2px 8px ${color}66;
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

    incidents.forEach((inc) => {
      const lat = parseFloat(inc.latitude);
      const lng = parseFloat(inc.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const markerId = inc.id;

      const popupContent = `
        <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #edf2f7; padding: 6px;">
          <strong style="display: block; font-size: 13px; margin-bottom: 6px; font-weight: 700;">${inc.userName || 'Registered User'}</strong>
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; margin-bottom: 6px;
            background-color: ${inc.status === 'resolved' ? '#10b981' : ((inc.riskScore || 0) >= 70 ? '#ef4444' : '#f59e0b')}; color: white;">
            ${inc.status.toUpperCase()} (${inc.riskScore || 0}%)
          </span>
          <span style="display: block; font-size: 11px; opacity: 0.8; margin-top: 4px;">Phone: ${inc.userPhone || 'N/A'}</span>
          <span style="display: block; font-size: 11px; opacity: 0.8; margin-top: 2px;">Trigger: ${inc.triggerType}</span>
          <span style="display: block; font-size: 11px; opacity: 0.8; margin-top: 2px; font-family: monospace;">Lat: ${lat.toFixed(6)}°, Lng: ${lng.toFixed(6)}°</span>
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
      // Keep all incidents (active and resolved) to show on the live map
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
      // Update state status to resolved instead of deleting
      setIncidents(prev => prev.map(i =>
        i.id === selectedIncident.id ? { ...i, status: 'resolved' } : i
      ));
      setSelectedIncident(prev => prev ? { ...prev, status: 'resolved' } : null);
    } catch (err) {
      console.error('Error resolving incident:', err);
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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', height: 'calc(100vh - 148px)' }}>

      {/* ── Map Viewport ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>
              Tactical GPS Telemetry
            </h2>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>
              Live coordinate streaming and incident beacon visualization
            </p>
          </div>
          <div className="badge badge-live" style={{ gap: '6px' }}>
            <span className="pulse-dot" />
            Streaming Coordinates
          </div>
        </div>

        <div
          ref={mapRef}
          style={{
            flex: 1,
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            minHeight: '400px',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}
        />
      </div>

      {/* ── Side Panel ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '4px' }}>

        {/* Selected Incident Detail Card */}
        {selectedIncident ? (
          <div className="glass-card animate-fade-in-up" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            borderLeft: `3px solid ${selectedIncident.status === 'active' ? 'var(--color-danger)' : 'var(--color-success)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                  {selectedIncident.userName || 'Registered User'}
                </h3>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {selectedIncident.id?.slice(-12)}
                </span>
              </div>
              <span className={`badge ${selectedIncident.riskScore >= 70 ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                RISK: {selectedIncident.riskScore}%
              </span>
            </div>

            <div className="section-divider" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '2px' }}>
                  Trigger Cause
                </span>
                <span className="badge badge-info" style={{ textTransform: 'capitalize', fontSize: '0.6rem' }}>{selectedIncident.triggerType}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                  <Crosshair size={9} /> Coordinates
                </span>
                <span style={{ color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600 }}>
                  Latitude: {selectedIncident.latitude?.toFixed(6)}° | Longitude: {selectedIncident.longitude?.toFixed(6)}°
                </span>
              </div>
              {selectedIncident.audioTranscript && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '2px' }}>
                    Audio Transcript
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                    "{selectedIncident.audioTranscript}"
                  </span>
                </div>
              )}
            </div>

            {selectedIncident.status === 'active' && (
              <button className="btn btn-success" onClick={handleResolveSelected} style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}>
                <CheckCircle2 size={14} /> Mark Resolved
              </button>
            )}
          </div>
        ) : (
          <div className="glass-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <AlertCircle size={30} style={{ color: 'var(--text-muted)', margin: '0 auto 10px', opacity: 0.4 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500 }}>
              Select an incident beacon to inspect
            </p>
          </div>
        )}

        {/* Active Beacons List */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Radio size={13} style={{ color: 'var(--color-info)' }} />
              Beacons
            </h3>
            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 600 }}>
              {activeCount} active / {incidents.length} total
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }}>
            {incidents.map((inc) => (
              <div
                key={inc.id}
                onClick={() => handleCenterMap(inc)}
                style={{
                  padding: '10px 12px',
                  backgroundColor: selectedIncident?.id === inc.id ? 'var(--bg-elevated)' : 'rgba(255,255,255,0.015)',
                  border: `1px solid ${selectedIncident?.id === inc.id ? 'rgba(59, 130, 246, 0.35)' : 'rgba(56, 78, 122, 0.15)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>{inc.userName || 'Registered User'}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <span className={`badge ${inc.status === 'active' ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.55rem', padding: '1px 6px' }}>
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
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', padding: '24px 0' }}>
                No active threats detected
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
