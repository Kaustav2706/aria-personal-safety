import React, { useState, useEffect } from 'react';
import { IncidentItem } from '../types';
import { ArrowLeft, Download, Share2, MapPin, ShieldCheck, CheckCircle, Loader2 } from 'lucide-react';
import { incidentService, reportService } from '../services/api';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';

const startIcon = L.divIcon({
  html: `<div style="position: relative; width: 24px; height: 24px;">
           <div style="position: absolute; width: 12px; height: 12px; border-radius: 50%; background-color: #10b981; border: 2px solid white; top: 6px; left: 6px;"></div>
         </div>`,
  className: 'start-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const checkpointIcon = L.divIcon({
  html: `<div style="position: relative; width: 16px; height: 16px;">
           <div style="position: absolute; width: 8px; height: 8px; border-radius: 50%; background-color: #f59e0b; border: 1.5px solid white; top: 4px; left: 4px;"></div>
         </div>`,
  className: 'checkpoint-marker',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const latestIcon = L.divIcon({
  html: `<div style="position: relative; width: 24px; height: 24px;">
           <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background-color: #ef4444; opacity: 0.3; animation: pulse-ring 1.5s infinite ease-in-out;"></div>
           <div style="position: absolute; top: 6px; left: 6px; width: 12px; height: 12px; border-radius: 50%; background-color: #ef4444; border: 2px solid white;"></div>
         </div>`,
  className: 'latest-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

function parseCoordinates(coordStr: string): [number, number] {
  if (!coordStr) return [28.6139, 77.2090];
  const clean = coordStr.replace(/[^\d.,-]/g, '');
  const parts = clean.split(',');
  if (parts.length === 2) {
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return [lat, lng];
    }
  }
  return [28.6139, 77.2090];
}


interface IncidentDetailsProps {
  incident: IncidentItem;
  onBack: () => void;
}

export default function IncidentDetailsView({ incident, onBack }: IncidentDetailsProps) {
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [reportError, setReportError] = useState('');

  // Load full incident details from backend
  const [detailLoading, setDetailLoading] = useState(true);
  const [locationHistory, setLocationHistory] = useState<any[]>([]);

  useEffect(() => {
    const loadDetails = async () => {
      try {
        const res = await incidentService.getById(incident.id);
        if (res.data.success) {
          if (res.data.locationHistory) {
            setLocationHistory(res.data.locationHistory);
          }
        }
      } catch (err) {
        console.warn('[INCIDENT_DETAILS] Failed to load full details:', err);
      } finally {
        setDetailLoading(false);
      }
    };
    loadDetails();
  }, [incident.id]);

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setReportError('');
    try {
      const res = await reportService.generate(incident.id);
      if (res.data.success && res.data.reportUrl) {
        setReportUrl(res.data.reportUrl);
      } else {
        setReportError(res.data.message || 'Failed to generate report.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setReportError(msg || 'Failed to generate report. Please try again.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Build timeline from location history + incident data
  const fullTimeline = [
    ...incident.timeline,
    ...locationHistory.map((loc: any, idx: number) => ({
      id: `loc-${idx}`,
      time: new Date(loc.timestamp).toLocaleTimeString(),
      title: 'GPS Checkpoint',
      description: `Location: ${loc.latitude.toFixed(4)}°, ${loc.longitude.toFixed(4)}° | Risk: ${loc.riskScore}%`,
      type: 'sensor' as const,
    })),
  ];

  return (
    <div className="pt-20 pb-32 px-6 font-sans">
      
      {/* Top back control banner */}
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container active:scale-90 transition-transform cursor-pointer border border-white/5"
        >
          <ArrowLeft className="w-5 h-5 text-primary" />
        </button>
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          Incident Directory / Lookback
        </span>
      </div>

      {/* Loading indicator */}
      {detailLoading && (
        <div className="flex items-center justify-center py-4 mb-4">
          <Loader2 className="w-5 h-5 text-secondary animate-spin" />
          <span className="ml-2 text-xs text-on-surface-variant">Loading details...</span>
        </div>
      )}

      {/* Main Title Metadata row */}
      <section className="flex flex-col gap-2 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black text-on-surface">{incident.title}</h2>
            <p className="text-xs text-on-surface-variant font-medium mt-0.5">
              {incident.date} • {incident.time}
            </p>
          </div>
          <span className="px-3.5 py-1 bg-primary/10 text-primary border border-primary/25 font-bold text-xs tracking-wider uppercase rounded-full shrink-0 select-none">
            {incident.status}
          </span>
        </div>
      </section>

      {/* Map visual section */}
      <section className="w-full h-64 rounded-2xl overflow-hidden glass-card relative mb-6 z-0">
        <MapContainer
          center={
            locationHistory.length > 0
              ? [locationHistory[locationHistory.length - 1].latitude, locationHistory[locationHistory.length - 1].longitude]
              : parseCoordinates(incident.coordinates)
          }
          zoom={14}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {locationHistory.length > 1 && (
            <Polyline
              positions={locationHistory.map((loc: any) => [loc.latitude, loc.longitude])}
              color="#3b82f6"
              weight={4}
            />
          )}
          {locationHistory.map((loc: any, idx: number) => {
            const isFirst = idx === 0;
            const isLast = idx === locationHistory.length - 1;
            const icon = isFirst ? startIcon : isLast ? latestIcon : checkpointIcon;
            
            return (
              <Marker 
                key={loc.id || idx} 
                position={[loc.latitude, loc.longitude]} 
                icon={icon}
              >
                <Popup>
                  <div className="text-xs font-sans text-white bg-slate-900 p-1 rounded">
                    <p className="font-bold font-sans">Checkpoint {idx + 1}</p>
                    <p className="text-[10px] text-gray-400 font-sans">{new Date(loc.timestamp).toLocaleTimeString()}</p>
                    <p className="text-secondary font-sans font-semibold">Risk: {loc.riskScore}%</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
          {locationHistory.length === 0 && (
            <Marker position={parseCoordinates(incident.coordinates)} icon={latestIcon}>
              <Popup>
                <div className="text-xs font-sans text-white p-1">
                  <p className="font-bold font-sans">{incident.title}</p>
                  <p className="text-[10px] text-gray-400 font-sans">{incident.time}</p>
                  <p className="text-primary font-sans font-semibold">Risk: {incident.riskScore}%</p>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
        
        {/* Floating coordinates stamp */}
        <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-1.5 bg-surface-container-highest/65 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 select-none">
          <MapPin className="w-4.5 h-4.5 text-secondary animate-pulse" />
          <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">
            {incident.coordinates}
          </span>
        </div>
      </section>



      {/* Timelines of events lookback list */}
      <section className="flex flex-col gap-5">
        <h3 className="text-[17px] font-bold text-on-surface uppercase tracking-wider">
          Timeline of Events
        </h3>
        
        {/* Cascade line container */}
        <div className="relative pl-1 border-l-2 border-outline-variant/20 ml-3 space-y-6">
          {fullTimeline.map((evt, idx) => (
            <div key={evt.id} className="relative pl-6">
              
              {/* Central status timeline dot badge icon indicator */}
              <div className="absolute -left-[14px] top-0.5 w-6 h-6 rounded-full bg-surface-container-highest border border-white/10 flex items-center justify-center shadow-lg">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  evt.type === 'critical' 
                    ? 'bg-primary shadow-[0_0_8px_#ffb4ac]' 
                    : evt.type === 'sensor' 
                    ? 'bg-secondary' 
                    : 'bg-tertiary'
                }`} />
              </div>

              {/* Text content details */}
              <div className="space-y-1">
                <span className="font-mono text-xs text-primary font-bold">{evt.time}</span>
                <h4 className="font-bold text-on-surface text-[15px]">{evt.title}</h4>
                <p className="text-body-sm text-on-surface-variant leading-relaxed">{evt.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Download / Share action panel buttons */}
      <section className="flex flex-col gap-3.5 pt-4 pb-12">
        {reportUrl ? (
          <a 
            href={reportUrl.startsWith('http') ? reportUrl : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${reportUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-13 bg-secondary text-on-secondary font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-lg text-xs uppercase tracking-wider"
          >
            <Download className="w-4 h-4" />
            Open PDF Report
          </a>
        ) : (
          <button 
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
            className="w-full h-13 bg-primary text-on-primary font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-primary/10 text-xs uppercase tracking-wider disabled:opacity-50"
          >
            {isGeneratingReport ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isGeneratingReport ? 'Generating Report...' : 'Generate Incident Report'}
          </button>
        )}

        {reportError && (
          <p className="text-xs text-error text-center">{reportError}</p>
        )}

        <button 
          onClick={() => alert('Incident link securely broadcasted to emergency contact group.')}
          className="w-full h-13 border-2 border-secondary text-secondary font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-secondary/15 active:scale-[0.98] transition-all cursor-pointer text-xs uppercase tracking-wider"
        >
          <Share2 className="w-4 h-4" />
          Share with Emergency Contacts
        </button>
      </section>

    </div>
  );
}
