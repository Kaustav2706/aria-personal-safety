import React, { useState, useEffect, useRef } from 'react';
import { Shield, Bell, Phone, Star, AlertTriangle, AlertCircle, Trash, MapPin } from 'lucide-react';
import { monitoringService } from '../services/api';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';

const userIcon = L.divIcon({
  html: `<div style="position: relative; width: 24px; height: 24px;">
           <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background-color: #3b82f6; opacity: 0.3; animation: pulse-ring 1.5s infinite ease-in-out;"></div>
           <div style="position: absolute; top: 6px; left: 6px; width: 12px; height: 12px; border-radius: 50%; background-color: #3b82f6; border: 2px solid white;"></div>
         </div>`,
  className: 'user-gps-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const destinationIcon = L.divIcon({
  html: `<div style="position: relative; width: 30px; height: 30px;">
           <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
             <circle cx="12" cy="10" r="3"></circle>
           </svg>
         </div>`,
  className: 'destination-marker',
  iconSize: [30, 30],
  iconAnchor: [15, 30]
});

function RecenterMap({ coords }: { coords: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.setView([coords.lat, coords.lng], map.getZoom());
    }
  }, [coords, map]);
  return null;
}

interface SafeRideProps {
  onTriggerSOS: () => void;
}

export default function SafeRideView({ onTriggerSOS }: SafeRideProps) {
  const [showAlert, setShowAlert] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [routeWaypoints, setRouteWaypoints] = useState<{ lat: number; lng: number }[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [isTracking, setIsTracking] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<{ lat: number; lng: number } | null>(null);

  // Track GPS and detect route deviation
  useEffect(() => {
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newCoord = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsCoords(newCoord);

        setDestination((prev) => {
          if (prev) return prev;
          return { lat: newCoord.lat + 0.012, lng: newCoord.lng + 0.012 };
        });

        // Append to route waypoints
        setRouteWaypoints((prev) => {
          const updated = [...prev, newCoord];
          
          // Calculate total distance
          if (lastPointRef.current) {
            const d = haversineDistance(lastPointRef.current, newCoord);
            setDistanceKm((prevDist) => prevDist + d);
          }
          lastPointRef.current = newCoord;

          // Detect route deviation: if we have enough points, check bearing change
          if (updated.length >= 5) {
            const recent = updated.slice(-5);
            const bearing1 = calculateBearing(recent[0], recent[2]);
            const bearing2 = calculateBearing(recent[2], recent[4]);
            const bearingDiff = Math.abs(bearing1 - bearing2);
            
            // > 90 degree change in a short span = deviation
            if (bearingDiff > 90 && bearingDiff < 270) {
              setShowAlert(true);
              // Trigger monitoring analysis on deviation
              triggerDeviationMonitoring();
            }
          }

          return updated;
        });
      },
      (err) => {
        console.warn('[SAFE_RIDE] GPS error:', err.message);
        // Set fallback coords
        setGpsCoords({ lat: 37.7749, lng: -122.4194 });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Trigger monitoring on deviation (reuse existing endpoints)
  const triggerDeviationMonitoring = async () => {
    try {
      await monitoringService.startSession();
      console.log('[SAFE_RIDE] Deviation detected — monitoring session started.');
    } catch (err) {
      console.warn('[SAFE_RIDE] Failed to start monitoring on deviation:', err);
    }
  };

  // Haversine distance formula
  function haversineDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371; // km
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  // Calculate bearing between two coordinates
  function calculateBearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const dLon = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  }

  const distanceRemaining = gpsCoords && destination ? haversineDistance(gpsCoords, destination) : 0;
  const estimatedEta = Math.max(1, Math.round(distanceRemaining * 5));

  return (
    <div className="pt-20 pb-36 px-6 font-sans select-none">
      
      {/* Top Banner Warning Overlay simulation toggle helper */}
      {showAlert && (
        <div className="glass-card mb-4 p-4 rounded-xl border border-primary/25 bg-primary/5 flex items-start justify-between animate-in slide-in-from-top duration-300">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-body-sm font-bold text-primary">Unplanned Route Change Detected</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                The vehicle has deviated from the typical route. ARIA is conducting distress checks.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowAlert(false)}
            className="text-on-surface-variant hover:text-white text-xs font-bold pl-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Map Section */}
      <section className="relative w-full h-[250px] rounded-xl overflow-hidden glass-card shadow-lg mb-4 z-0">
        {gpsCoords ? (
          <MapContainer 
            center={[gpsCoords.lat, gpsCoords.lng]} 
            zoom={14} 
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <Marker position={[gpsCoords.lat, gpsCoords.lng]} icon={userIcon} />
            {destination && (
              <Marker position={[destination.lat, destination.lng]} icon={destinationIcon} />
            )}
            {routeWaypoints.length > 1 && (
              <Polyline 
                positions={routeWaypoints.map(w => [w.lat, w.lng])} 
                color={showAlert ? '#ef4444' : '#3b82f6'} 
                weight={4}
              />
            )}
            <RecenterMap coords={gpsCoords} />
          </MapContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-container/30">
            <span className="text-xs text-on-surface-variant animate-pulse">Acquiring GPS Signal...</span>
          </div>
        )}
        
        {/* Floating Indicator over map */}
        <div className="absolute top-4 left-4 glass-card px-3 py-1.5 rounded-full flex items-center gap-2 border-white/10" style={{ zIndex: 1000 }}>
          <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">
            Route Safety Monitor: Active
          </span>
        </div>

        {/* Live GPS coordinates */}
        <div className="absolute bottom-4 left-4 glass-card px-3 py-1.5 rounded-full flex items-center gap-2 border-white/10" style={{ zIndex: 1000 }}>
          <MapPin className="w-3.5 h-3.5 text-secondary" />
          <span className="text-[10px] font-mono font-bold text-white">
            {gpsCoords 
              ? `${gpsCoords.lat.toFixed(4)}°, ${gpsCoords.lng.toFixed(4)}°`
              : 'Acquiring GPS...'}
          </span>
        </div>

        {/* Warning Indicator Over Map */}
        {showAlert && (
          <div className="absolute bottom-14 left-4 right-4 glass-card border-primary/45 bg-primary/10 px-4 py-3 rounded-lg flex items-center gap-3 animate-bounce" style={{ zIndex: 1000 }}>
            <AlertTriangle className="w-5 h-5 text-primary animate-pulse" />
            <div>
              <p className="text-[11px] font-extrabold text-primary uppercase tracking-wide">Unplanned Route Change</p>
              <p className="text-[10px] text-on-surface-variant font-medium">Are you still on your planned journey?</p>
            </div>
          </div>
        )}
      </section>

      {/* Trip Status Card Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="glass-card p-4 rounded-xl text-center flex flex-col justify-center border-white/5">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">ETA</p>
          <h3 className="text-xl font-bold text-primary">{estimatedEta} mins</h3>
        </div>
        <div className="glass-card p-4 rounded-xl text-center flex flex-col justify-center border-white/5">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">Distance Remaining</p>
          <h3 className="text-xl font-bold text-on-surface">{distanceRemaining.toFixed(1)} km</h3>
        </div>
      </div>

      {/* Driver / Vehicle Card */}
      <div className="glass-card p-5 rounded-2xl space-y-4 border border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden border border-primary/20 shrink-0">
              <img 
                className="w-full h-full object-cover" 
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200" 
                alt="Marcus Chen Driver portrait" 
              />
            </div>
            <div>
              <h4 className="text-body-lg font-bold text-on-surface">Marcus Chen</h4>
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                <span className="text-xs font-semibold text-on-surface-variant">4.9 stars</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => alert('Dialing Marcus Chen via Private encrypted proxy...')}
            className="w-11 h-11 rounded-full glass-card flex items-center justify-center text-secondary active:scale-90 transition-transform cursor-pointer"
          >
            <Phone className="w-5 h-5 text-secondary" />
          </button>
        </div>

        <div className="pt-4 border-t border-outline-variant/20 flex justify-between items-center text-xs">
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Vehicle</p>
            <p className="text-body-sm font-bold text-white/95 mt-0.5">Toyota Camry (Black)</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Plate</p>
            <p className="text-body-sm font-bold text-primary bg-surface-container-highest/60 px-2 py-0.5 rounded border border-outline-variant inline-block mt-0.5">
              AR-8821
            </p>
          </div>
        </div>
      </div>

      {/* Safety Actions */}
      <div className="space-y-4 pt-6">
        <button 
          onClick={() => {
            alert('Suspicious behavior logged. Local AI dispatcher monitoring has been elevated.');
          }}
          className="w-full h-12 border border-outline text-on-surface hover:bg-white/5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-transform flex items-center justify-center gap-2 cursor-pointer"
        >
          <AlertTriangle className="w-4 h-4 text-primary" />
          Report Suspicious Activity
        </button>

        {/* Central Pulse Emergency Trigger Button */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <button 
            onClick={onTriggerSOS}
            className="w-20 h-24 rounded-full bg-primary-container text-white flex items-center justify-center sos-glow active:scale-90 transition-transform cursor-pointer animate-pulse"
          >
            <AlertCircle className="w-10 h-10 text-white" />
          </button>
          <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
            TAP TO FORCE INSTANT SOS
          </span>
        </div>
      </div>

    </div>
  );
}
