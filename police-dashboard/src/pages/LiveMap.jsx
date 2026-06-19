import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import L from 'leaflet';
import { AlertCircle, Navigation, Play, ShieldAlert } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

export default function LiveMap() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersGroupRef = useRef({});
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Initialize Map
  useEffect(() => {
    if (!mapInstance.current && mapRef.current) {
      // Default to Delhi center coordinates [28.6139, 77.2090]
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

  // Helper to create the div icon based on status and risk
  const createMarkerIcon = (status, riskScore) => {
    const isResolved = status === 'resolved';
    const isHighRisk = (riskScore || 0) >= 70;
    const color = isResolved ? '#10b981' : (isHighRisk ? '#ef4444' : '#f59e0b');
    
    const pulseHtml = isResolved ? '' : `
      <div style="
        position: absolute;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: ${color};
        opacity: 0.4;
        animation: pulse-ring 1.8s infinite ease-in-out;
      "></div>
    `;

    const html = `
      <div style="position: relative; width: 20px; height: 20px;">
        ${pulseHtml}
        <div style="
          position: absolute;
          top: 5px;
          left: 5px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: ${color};
          border: 2px solid white;
        "></div>
      </div>
    `;

    return L.divIcon({
      html: html,
      className: 'custom-gps-pin',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  };

  // Fetch initial incidents and hook WebSocket listeners
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

    return () => {
      socket.disconnect();
    };
  }, [selectedIncident]);

  // Sync state incidents with Leaflet markers
  useEffect(() => {
    if (!mapInstance.current) return;

    incidents.forEach((inc) => {
      const lat = parseFloat(inc.latitude);
      const lng = parseFloat(inc.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const markerId = inc.id;
      
      const popupContent = `
        <div style="font-family: sans-serif; font-size: 12px; color: #fff; padding: 4px;">
          <strong style="display: block; font-size: 13px; margin-bottom: 4px;">${inc.userName || 'Registered User'}</strong>
          <span style="display: inline-block; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 10px; margin-bottom: 6px; 
            background-color: ${inc.status === 'resolved' ? '#10b981' : ((inc.riskScore || 0) >= 70 ? '#ef4444' : '#f59e0b')}; color: white;">
            ${inc.status.toUpperCase()} (${inc.riskScore || 0}%)
          </span>
          <span style="display: block; font-size: 11px; opacity: 0.8;">Phone: ${inc.userPhone || 'N/A'}</span>
          <span style="display: block; font-size: 11px; opacity: 0.8; margin-top: 4px;">Trigger: ${inc.triggerType}</span>
        </div>
      `;

      // If marker already exists, update position, icon, and popup content
      if (markersGroupRef.current[markerId]) {
        markersGroupRef.current[markerId].setLatLng([lat, lng]);
        markersGroupRef.current[markerId].setIcon(createMarkerIcon(inc.status, inc.riskScore));
        markersGroupRef.current[markerId].setPopupContent(popupContent);
      } else {
        const icon = createMarkerIcon(inc.status, inc.riskScore);
        const marker = L.marker([lat, lng], { icon }).addTo(mapInstance.current);
        
        marker.bindPopup(popupContent, { closeButton: false });
        marker.on('click', () => {
          setSelectedIncident(inc);
        });

        markersGroupRef.current[markerId] = marker;
      }
    });

    // Auto-focus camera on first active incident if available
    const activeIncidents = incidents.filter(i => i.status === 'active');
    if (activeIncidents.length > 0 && mapInstance.current && !selectedIncident) {
      const first = activeIncidents[0];
      mapInstance.current.setView([first.latitude, first.longitude], 13);
      setSelectedIncident(first);
    }
  }, [incidents]);

  const fetchActiveIncidents = async () => {
    try {
      const res = await axios.get(`${API_BASE}/incidents`);
      // Keep all incidents (active and resolved) to show on the live map
      setIncidents(res.data.incidents || []);
    } catch (err) {
      console.error('Error fetching dashboard incidents:', err);
    }
  };

  const removeMarker = (id) => {
    if (markersGroupRef.current[id]) {
      markersGroupRef.current[id].remove();
      delete markersGroupRef.current[id];
    }
  };

  const updateMarkerCoords = (id, lat, lng, score) => {
    if (markersGroupRef.current[id]) {
      markersGroupRef.current[id].setLatLng([lat, lng]);
      
      const inc = incidents.find(i => i.id === id);
      const status = inc ? inc.status : 'active';
      markersGroupRef.current[id].setIcon(createMarkerIcon(status, score));
      
      const popupContent = `
        <div style="font-family: sans-serif; font-size: 12px; color: #fff; padding: 4px;">
          <strong style="display: block; font-size: 13px; margin-bottom: 4px;">${(inc && inc.userName) || 'Registered User'}</strong>
          <span style="display: inline-block; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 10px; margin-bottom: 6px; 
            background-color: ${status === 'resolved' ? '#10b981' : ((score || 0) >= 70 ? '#ef4444' : '#f59e0b')}; color: white;">
            ${status.toUpperCase()} (${score || 0}%)
          </span>
          <span style="display: block; font-size: 11px; opacity: 0.8;">Phone: ${(inc && inc.userPhone) || 'N/A'}</span>
          <span style="display: block; font-size: 11px; opacity: 0.8; margin-top: 4px;">Trigger: ${(inc && inc.triggerType) || 'unknown'}</span>
        </div>
      `;
      markersGroupRef.current[id].setPopupContent(popupContent);

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
      await axios.put(`${API_BASE}/incidents/${selectedIncident.id}/resolve`);
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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', height: 'calc(100vh - 130px)' }}>
      {/* Map viewport */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#fff' }}>Tactical GPS Telemetry Screen</h2>
          <span className="pulse-badge">
            <span className="pulse-dot"></span>
            Streaming Live Coordinates
          </span>
        </div>
        
        <div ref={mapRef} style={{ flex: 1, borderRadius: '12px', border: '1px solid var(--border-color)', minHeight: '400px' }} />
      </div>

      {/* Side info panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
        
        {/* Selected Incident Details */}
        {selectedIncident ? (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '4px solid #ef4444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#fff' }}>{selectedIncident.userName || 'Registered User'}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {selectedIncident.id}</span>
              </div>
              <span 
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  color: selectedIncident.riskScore >= 70 ? '#ef4444' : '#f59e0b',
                  backgroundColor: selectedIncident.riskScore >= 70 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${selectedIncident.riskScore >= 70 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                }}
              >
                Risk: {selectedIncident.riskScore}%
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Emergency Contacts Alerted:</span>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>SMS notifications sent out</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Trigger Cause:</span>
                <span style={{ color: '#fff', textTransform: 'capitalize' }}>{selectedIncident.triggerType}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block' }}>GPS Coordinates:</span>
                <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                  {selectedIncident.latitude.toFixed(6)}, {selectedIncident.longitude.toFixed(6)}
                </span>
              </div>
              {selectedIncident.audioTranscript && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Audio Evidence Capture:</span>
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    &ldquo;{selectedIncident.audioTranscript}&rdquo;
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button 
                onClick={handleResolveSelected}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#10b981',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                Mark Resolved
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <AlertCircle size={32} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
            Select an active incident beacon to inspect coordinates.
          </div>
        )}

        {/* Active Dispatch Index */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          <h3 style={{ fontSize: '1rem', color: '#fff' }}>Active Beacons ({incidents.length})</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
            {incidents.map((inc) => (
              <div 
                key={inc.id}
                onClick={() => handleCenterMap(inc)}
                style={{
                  padding: '10px',
                  backgroundColor: selectedIncident?.id === inc.id ? 'var(--bg-tertiary)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${selectedIncident?.id === inc.id ? '#3b82f6' : 'var(--border-color)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: '0.2s'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff' }}>{inc.userName || 'Registered User'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Trigger: {inc.triggerType}</div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ef4444' }}>{inc.riskScore}%</span>
                  <Navigation size={12} style={{ transform: 'rotate(45deg)', color: '#3b82f6' }} />
                </div>
              </div>
            ))}
            {incidents.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
                No active threats detected.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
