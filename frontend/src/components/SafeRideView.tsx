import React, { useState, useEffect, useRef } from 'react';
import { Shield, Bell, Phone, Star, AlertTriangle, AlertCircle, Trash, MapPin, User, Car, Check, Navigation, Play, Compass, History } from 'lucide-react';
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
  onTriggerSOS: (triggerType?: string, extraInfo?: string, coords?: { lat: number; lng: number } | null) => void;
}

export default function SafeRideView({ onTriggerSOS }: SafeRideProps) {
  // Ride state management
  const [rideState, setRideState] = useState<'setup' | 'active' | 'arrived'>('setup');
  
  // Custom Driver & Ride Form details
  const [driverName, setDriverName] = useState('');
  const [carNumber, setCarNumber] = useState('');
  const [carModel, setCarModel] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropLocation, setDropLocation] = useState('');
  const [showSuspiciousModal, setShowSuspiciousModal] = useState(false);

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [prevRides, setPrevRides] = useState<any[]>([]);

  // Load previous rides on mount
  useEffect(() => {
    const saved = localStorage.getItem('aria_prev_rides');
    if (saved) {
      try {
        setPrevRides(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse previous rides:', e);
      }
    }
  }, []);

  const handleDeleteRide = (id: string) => {
    const updated = prevRides.filter((ride) => ride.id !== id);
    setPrevRides(updated);
    localStorage.setItem('aria_prev_rides', JSON.stringify(updated));
  };

  // Live simulation states
  const [showAlert, setShowAlert] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [routeWaypoints, setRouteWaypoints] = useState<{ lat: number; lng: number }[]>([]);
  const [simulationPath, setSimulationPath] = useState<{ lat: number; lng: number }[]>([]);
  const [currentPathIndex, setCurrentPathIndex] = useState(0);
  const [hasReachedDestination, setHasReachedDestination] = useState(false);

  const simulationIntervalRef = useRef<number | null>(null);

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

  // Generate a realistic grid-like route with turns
  function generatePath(start: { lat: number; lng: number }, end: { lat: number; lng: number }) {
    const points = [];
    const stepsPerLeg = 8;
    
    // Create two intermediate corners to simulate street navigation
    const mid1 = { lat: start.lat, lng: start.lng + (end.lng - start.lng) * 0.4 };
    const mid2 = { lat: start.lat + (end.lat - start.lat) * 0.7, lng: mid1.lng };
    
    // Leg 1: start to mid1
    for (let i = 0; i < stepsPerLeg; i++) {
      const t = i / stepsPerLeg;
      points.push({
        lat: start.lat + (mid1.lat - start.lat) * t,
        lng: start.lng + (mid1.lng - start.lng) * t,
      });
    }
    
    // Leg 2: mid1 to mid2
    for (let i = 0; i < stepsPerLeg; i++) {
      const t = i / stepsPerLeg;
      points.push({
        lat: mid1.lat + (mid2.lat - mid1.lat) * t,
        lng: mid1.lng + (mid2.lng - mid1.lng) * t,
      });
    }
    
    // Leg 3: mid2 to end
    for (let i = 0; i <= stepsPerLeg; i++) {
      const t = i / stepsPerLeg;
      points.push({
        lat: mid2.lat + (end.lat - mid2.lat) * t,
        lng: mid2.lng + (end.lng - mid2.lng) * t,
      });
    }
    
    return points;
  }

  // Start the safe journey
  const handleStartJourney = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName || !carNumber || !carModel || !pickupLocation || !dropLocation) return;

    // Reset alert flags
    setShowAlert(false);

    // Get current GPS coordinates or use Kolkata fallback from screenshots
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const start = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          initializeSimulation(start);
        },
        (err) => {
          console.warn('[SAFE_RIDE] GPS unavailable, using fallback coordinates.');
          initializeSimulation({ lat: 22.4823, lng: 88.2987 });
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      initializeSimulation({ lat: 22.4823, lng: 88.2987 });
    }
  };

  const initializeSimulation = (start: { lat: number; lng: number }) => {
    // Generate a destination about 2.5 km away
    const end = { lat: start.lat + 0.014, lng: start.lng + 0.018 };
    const path = generatePath(start, end);

    setGpsCoords(start);
    setDestination(end);
    setRouteWaypoints(path);
    setSimulationPath(path);
    setCurrentPathIndex(0);
    setHasReachedDestination(false);
    setRideState('active');
  };

  // Run the animated coordinate simulation
  useEffect(() => {
    if (rideState !== 'active' || simulationPath.length === 0) return;

    simulationIntervalRef.current = window.setInterval(() => {
      setCurrentPathIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        
        if (nextIndex < simulationPath.length) {
          const currentPoint = simulationPath[nextIndex];
          setGpsCoords(currentPoint);

          // Simulate unplanned route deviation at 60% of the journey
          if (nextIndex === Math.floor(simulationPath.length * 0.6)) {
            setShowAlert(true);
            triggerDeviationMonitoring();
          }

          return nextIndex;
        } else {
          // Reached destination but don't automatically end
          if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current);
          }
          setHasReachedDestination(true);
          return prevIndex;
        }
      });
    }, 1500);

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, [rideState, simulationPath]);

  // Trigger backend monitoring session on deviation
  const triggerDeviationMonitoring = async () => {
    try {
      await monitoringService.startSession();
      console.log('[SAFE_RIDE] Route deviation detected — elevated monitoring active.');
    } catch (err) {
      console.warn('[SAFE_RIDE] Failed to trigger deviation monitoring session:', err);
    }
  };

  // Complete journey manually
  const handleCompleteJourney = () => {
    const newRide = {
      id: 'ride-' + Date.now(),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      driverName,
      carModel,
      carNumber,
      pickupLocation,
      dropLocation
    };

    const updatedRides = [newRide, ...prevRides].slice(0, 5);
    setPrevRides(updatedRides);
    localStorage.setItem('aria_prev_rides', JSON.stringify(updatedRides));

    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }
    setRideState('arrived');
  };

  // Cancel current journey
  const handleCancelJourney = () => {
    if (window.confirm('Are you sure you want to cancel the safety monitoring session?')) {
      resetJourneyState();
    }
  };

  const handleReportToPolice = () => {
    setShowSuspiciousModal(false);
    const info = `Suspicious Activity reported during Safe Ride. Driver: ${driverName}, Car: ${carModel} (${carNumber}), Route: From ${pickupLocation} to ${dropLocation}`;
    onTriggerSOS('suspicious', info, gpsCoords);
  };

  // Reset journey state back to setup
  const resetJourneyState = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }
    setRideState('setup');
    setGpsCoords(null);
    setDestination(null);
    setRouteWaypoints([]);
    setSimulationPath([]);
    setCurrentPathIndex(0);
    setShowAlert(false);
    setHasReachedDestination(false);
  };

  // Calculations for active trip
  const distanceRemaining = gpsCoords && destination ? haversineDistance(gpsCoords, destination) : 0;
  const estimatedEta = Math.max(1, Math.round(distanceRemaining * 5));

  return (
    <div className="pt-20 pb-36 px-6 font-sans select-none">
      
      {/* Sleek Sub-Header with History Toggle */}
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
        <h2 className="text-xs font-black uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-primary" />
          Safe Ride Monitor
        </h2>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-3 py-1.5 rounded-full glass-card hover:bg-white/5 border-white/10 text-[10px] font-bold text-primary flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
        >
          <History className="w-3.5 h-3.5" />
          {showHistory ? "Active View" : "History"}
        </button>
      </div>

      {/* 0. PREVIOUS RIDES HISTORY PANEL */}
      {showHistory ? (
        <div className="glass-card rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in duration-200">
          <div className="pb-2 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-2">
              <History className="w-4.5 h-4.5 text-primary" />
              Previous Rides (Max 5)
            </h3>
            <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded border border-white/5">
              {prevRides.length} / 5
            </span>
          </div>

          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 no-scrollbar">
            {prevRides.length > 0 ? (
              prevRides.map((ride) => (
                <div key={ride.id} className="p-4 rounded-xl bg-surface-container/60 border border-white/5 space-y-3 relative group animate-in slide-in-from-bottom-2 duration-150">
                  <button
                    onClick={() => handleDeleteRide(ride.id)}
                    className="absolute top-4 right-4 text-on-surface-variant hover:text-red-400 active:scale-90 transition-all cursor-pointer"
                    title="Delete Ride"
                  >
                    <Trash className="w-4 h-4" />
                  </button>

                  <div className="flex justify-between items-center text-[10px] text-on-surface-variant/80 font-mono">
                    <span>📅 {ride.date}</span>
                    <span className="mr-6">🕒 {ride.time}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-on-surface-variant text-[10px] block uppercase tracking-wider">Driver</span>
                      <span className="font-bold text-white">{ride.driverName}</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant text-[10px] block uppercase tracking-wider">Vehicle</span>
                      <span className="font-bold text-white truncate block">{ride.carModel} ({ride.carNumber})</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 text-xs text-on-surface-variant space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
                      <span className="truncate">From: <strong>{ride.pickupLocation}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="truncate">To: <strong>{dropLocation}</strong></span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-on-surface-variant/50 space-y-2">
                <Car className="w-10 h-10 mx-auto opacity-30 animate-pulse" />
                <p className="text-xs italic">No previous rides logged yet.</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowHistory(false)}
            className="w-full h-11 bg-surface-container border border-outline-variant hover:bg-white/5 text-on-surface font-bold text-xs uppercase tracking-wider rounded-xl active:scale-[0.98] transition-transform cursor-pointer"
          >
            Back to Monitor
          </button>
        </div>
      ) : (
        <>
          {/* 1. SETUP STATE FORM */}
          {rideState === 'setup' && (
        <div className="glass-card rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="flex flex-col items-center text-center pb-2 border-b border-white/10">
            <div className="w-12 h-12 bg-primary-container/20 rounded-full flex items-center justify-center mb-2">
              <Car className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-black text-primary uppercase tracking-wider">Configure Safe Ride</h3>
            <p className="text-[11px] text-on-surface-variant font-medium opacity-80 mt-1">
              Manually set details to start route monitoring
            </p>
          </div>

          <form onSubmit={handleStartJourney} className="space-y-4">
            
            {/* Driver Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant ml-1 tracking-wider uppercase">
                Driver's Name
              </label>
              <div className="relative rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary transition-all">
                <User className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-70" />
                <input
                  type="text"
                  className="w-full h-11 bg-transparent text-on-surface pl-11 pr-4 rounded-xl focus:ring-0 focus:outline-none text-sm"
                  placeholder="e.g. Marcus Chen"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Vehicle Model & Car Number Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Vehicle Model */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant ml-1 tracking-wider uppercase">
                  Vehicle Model
                </label>
                <div className="relative rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary transition-all">
                  <Car className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-70" />
                  <input
                    type="text"
                    className="w-full h-11 bg-transparent text-on-surface pl-10 pr-3 rounded-xl focus:ring-0 focus:outline-none text-sm"
                    placeholder="e.g. Toyota Camry"
                    value={carModel}
                    onChange={(e) => setCarModel(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Car Number / Plate */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant ml-1 tracking-wider uppercase">
                  Plate Number
                </label>
                <div className="relative rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary transition-all">
                  <Compass className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-70" />
                  <input
                    type="text"
                    className="w-full h-11 bg-transparent text-on-surface pl-10 pr-3 rounded-xl focus:ring-0 focus:outline-none text-sm"
                    placeholder="e.g. AR-8821"
                    value={carNumber}
                    onChange={(e) => setCarNumber(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Pickup Location */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant ml-1 tracking-wider uppercase">
                Pickup Location
              </label>
              <div className="relative rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary transition-all">
                <MapPin className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-secondary opacity-70" />
                <input
                  type="text"
                  className="w-full h-11 bg-transparent text-on-surface pl-11 pr-4 rounded-xl focus:ring-0 focus:outline-none text-sm"
                  placeholder="Enter pickup point"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Destination Location */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant ml-1 tracking-wider uppercase">
                Drop Location
              </label>
              <div className="relative rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary transition-all">
                <Navigation className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-primary opacity-70" />
                <input
                  type="text"
                  className="w-full h-11 bg-transparent text-on-surface pl-11 pr-4 rounded-xl focus:ring-0 focus:outline-none text-sm"
                  placeholder="Enter drop destination"
                  value={dropLocation}
                  onChange={(e) => setDropLocation(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-13 bg-[#3394f1] hover:brightness-110 text-white font-bold text-sm uppercase tracking-wider rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-6 cursor-pointer"
            >
              Start Safe Journey
              <Play className="w-4 h-4 fill-white" />
            </button>
          </form>
        </div>
      )}

      {/* 2. ACTIVE MONITORING STATE */}
      {rideState === 'active' && (
        <div className="space-y-4">
          
          {/* Top Banner Warning Overlay */}
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
            
            {/* Floating Status Indicator */}
            <div className="absolute top-4 left-4 glass-card px-3 py-1.5 rounded-full flex items-center gap-2 border-white/10" style={{ zIndex: 1000 }}>
              <span className={`w-2 h-2 rounded-full ${hasReachedDestination ? 'bg-secondary animate-pulse' : showAlert ? 'bg-red-500 animate-ping' : 'bg-tertiary animate-pulse'}`} />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider font-sans">
                {hasReachedDestination ? 'Arrived: Complete Journey' : showAlert ? 'Route Deviation: Active Check' : 'Route Safety Monitor: Active'}
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
          </section>

          {/* Trip Status Card Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="glass-card p-4 rounded-xl text-center flex flex-col justify-center border-white/5">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">ETA</p>
              <h3 className="text-xl font-bold text-primary">{hasReachedDestination ? 0 : estimatedEta} mins</h3>
            </div>
            <div className="glass-card p-4 rounded-xl text-center flex flex-col justify-center border-white/5">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">Distance Remaining</p>
              <h3 className="text-xl font-bold text-on-surface">{hasReachedDestination ? 0 : distanceRemaining.toFixed(1)} km</h3>
            </div>
          </div>

          {/* User-provided Driver / Vehicle Card */}
          <div className="glass-card p-5 rounded-2xl space-y-4 border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full border border-primary/20 bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-body-lg font-bold text-on-surface">{driverName}</h4>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                    <span className="text-xs font-semibold text-on-surface-variant">4.9 stars</span>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => alert(`Dialing ${driverName} via secure encrypted proxy...`)}
                className="w-11 h-11 rounded-full glass-card flex items-center justify-center text-secondary active:scale-90 transition-transform cursor-pointer"
              >
                <Phone className="w-5 h-5 text-secondary" />
              </button>
            </div>

            <div className="pt-4 border-t border-outline-variant/20 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Vehicle</p>
                <p className="text-body-sm font-bold text-white/95 mt-0.5">{carModel}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Plate</p>
                <p className="text-body-sm font-bold text-primary bg-surface-container-highest/60 px-2 py-0.5 rounded border border-outline-variant inline-block mt-0.5">
                  {carNumber}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-outline-variant/20 flex flex-col gap-1.5 text-xs text-on-surface-variant">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
                <span className="truncate">From: <strong>{pickupLocation}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Navigation className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">To: <strong>{dropLocation}</strong></span>
              </div>
            </div>
          </div>

          {/* Safety Actions */}
          <div className="space-y-3 pt-4">
            {/* Complete Ride Button */}
            <button 
              onClick={handleCompleteJourney}
              className="w-full h-12 bg-secondary hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer safe-glow"
            >
              <Check className="w-4 h-4" />
              {hasReachedDestination ? "Arrived! Complete Journey & End Ride" : "Complete Journey & End Ride"}
            </button>

            <button 
              onClick={() => setShowSuspiciousModal(true)}
              className="w-full h-12 border border-outline text-on-surface hover:bg-white/5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-transform flex items-center justify-center gap-2 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-primary" />
              Report Suspicious Activity
            </button>

            <button 
              onClick={handleCancelJourney}
              className="w-full h-12 border border-outline-variant text-on-surface-variant hover:bg-white/5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-transform flex items-center justify-center gap-2 cursor-pointer"
            >
              Cancel Journey Monitor
            </button>

            {/* Central Pulse Emergency Trigger Button */}
            <div className="flex flex-col items-center gap-2 pt-2">
              <button 
                onClick={() => onTriggerSOS('manual', undefined, gpsCoords)}
                className="w-20 h-20 rounded-full bg-primary-container text-white flex items-center justify-center sos-glow active:scale-90 transition-transform cursor-pointer animate-pulse"
              >
                <AlertCircle className="w-10 h-10 text-white" />
              </button>
              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                TAP TO FORCE INSTANT SOS
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. ARRIVED STATE */}
      {rideState === 'arrived' && (
        <div className="glass-card rounded-2xl p-6 text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-secondary/15 rounded-full flex items-center justify-center mx-auto safe-glow">
            <Check className="w-8 h-8 text-secondary" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-black text-secondary uppercase tracking-wider">Arrived Safely!</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              You have successfully arrived at your destination: <strong>{dropLocation}</strong>. The ARIA safe tracking session has concluded.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-container/50 border border-white/5 text-left text-xs space-y-2 font-mono">
            <p className="flex justify-between">
              <span className="text-on-surface-variant">👤 DRIVER:</span>
              <span className="text-white font-bold">{driverName}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-on-surface-variant">🚗 VEHICLE:</span>
              <span className="text-white font-bold">{carModel} ({carNumber})</span>
            </p>
            <p className="flex justify-between">
              <span className="text-on-surface-variant">📍 FROM:</span>
              <span className="text-white font-bold truncate max-w-[150px]">{pickupLocation}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-on-surface-variant">🏁 TO:</span>
              <span className="text-white font-bold truncate max-w-[150px]">{dropLocation}</span>
            </p>
          </div>

          <button
            onClick={resetJourneyState}
            className="w-full h-12 bg-primary text-on-primary font-bold text-sm uppercase tracking-wider rounded-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            Start New Journey
          </button>
        </div>
      )}
          </>
        )}

      {/* Custom Report Suspicious Activity Modal Dialog */}
      {showSuspiciousModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-sm glass-card p-6 border border-primary/20 space-y-6 animate-in zoom-in-95 duration-200 shadow-2xl relative">
            <button 
              onClick={() => setShowSuspiciousModal(false)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-white text-sm font-black p-1 cursor-pointer active:scale-95 transition-transform"
            >
              ✕
            </button>

            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mb-1">
                <AlertTriangle className="w-6 h-6 text-primary animate-pulse" />
              </div>
              <h3 className="text-base font-black text-primary uppercase tracking-wider">Report Suspicious Activity</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Choose a response protocol below to secure your safety immediately.
              </p>
            </div>

            <div className="space-y-3">
              {/* Option 1: Alert Emergency Contacts */}
              <button
                onClick={() => {
                  setShowSuspiciousModal(false);
                  onTriggerSOS('manual', undefined, gpsCoords); // Deploys standard contacts alert sequence
                }}
                className="w-full py-3.5 px-4 bg-surface-container hover:bg-surface-container-highest text-white border border-white/10 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Phone className="w-4 h-4 text-secondary" />
                Call/SMS Emergency Contacts
              </button>

              {/* Option-2: Directly Report to Police */}
              <button
                onClick={handleReportToPolice}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white border border-red-500/30 rounded-xl font-black text-xs uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer safe-glow"
                style={{
                  boxShadow: '0 0 15px rgba(220, 38, 39, 0.3)'
                }}
              >
                <Shield className="w-4 h-4 text-white" />
                Directly Report to Police
              </button>
            </div>

            <button
              onClick={() => setShowSuspiciousModal(false)}
              className="w-full py-2.5 text-on-surface-variant hover:text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

