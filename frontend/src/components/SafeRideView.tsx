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
    <div className="pt-20 pb-36 px-6 font-sans select-none animate-fade-in-scale">
      
      {/* Sleek Sub-Header with History Toggle */}
      <div className="flex justify-between items-center mb-6 pb-2.5 border-b border-white/10">
        <h2 className="text-xs font-black uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-gradient bg-gradient-to-r from-primary to-on-surface-variant">Safe Ride Monitor</span>
        </h2>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-3.5 py-1.5 rounded-full glass-card hover:bg-white/10 border-white/10 text-[10px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all duration-200"
        >
          <History className="w-3.5 h-3.5" />
          {showHistory ? "Active View" : "History"}
        </button>
      </div>

      {/* 0. PREVIOUS RIDES HISTORY PANEL */}
      {showHistory ? (
        <div className="glass-card-elevated rounded-3xl p-6 shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 relative overflow-hidden gradient-border">
          {/* Background Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-[40px] pointer-events-none animate-glow-pulse" />
          <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />

          <div className="pb-3 border-b border-white/10 flex items-center justify-between relative z-10">
            <h3 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Previous Rides
            </h3>
            <span className="text-[9px] font-mono font-bold text-on-surface-variant bg-surface-container-high px-2.5 py-1 rounded-full border border-white/5">
              {prevRides.length} / 5
            </span>
          </div>

          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 no-scrollbar relative z-10">
            {prevRides.length > 0 ? (
              prevRides.map((ride) => (
                <div key={ride.id} className="p-4 rounded-2xl bg-surface-container-low/60 border border-white/5 space-y-3.5 relative group hover:border-primary/20 hover:bg-surface-container/60 hover-lift transition-all duration-200">
                  <button
                    onClick={() => handleDeleteRide(ride.id)}
                    className="absolute top-4 right-4 text-on-surface-variant/60 hover:text-primary active:scale-90 transition-all cursor-pointer p-1 rounded-full hover:bg-white/5"
                    title="Delete Ride"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex justify-between items-center text-[10px] text-on-surface-variant/80 font-mono">
                    <span className="flex items-center gap-1">📅 {ride.date}</span>
                    <span className="mr-8 flex items-center gap-1">🕒 {ride.time}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-on-surface-variant/60 text-[9px] block uppercase tracking-wider font-bold">Driver</span>
                      <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" />
                        {ride.driverName}
                      </span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant/60 text-[9px] block uppercase tracking-wider font-bold">Vehicle</span>
                      <span className="font-bold text-white truncate block mt-0.5 text-ellipsis overflow-hidden" title={`${ride.carModel} (${ride.carNumber})`}>
                        {ride.carModel} <span className="text-[10px] font-mono text-primary font-normal">[{ride.carNumber}]</span>
                      </span>
                    </div>
                  </div>

                  {/* Route Connection Timeline */}
                  <div className="pt-3.5 border-t border-white/5 space-y-2.5 relative pl-5">
                    {/* Vertical line connector */}
                    <div className="absolute left-[7px] top-4 bottom-4 w-0.5 border-l border-dashed border-white/10" />
                    
                    <div className="relative flex items-center gap-2 text-xs">
                      <div className="absolute -left-[20px] w-2 h-2 rounded-full bg-secondary/80" />
                      <span className="text-on-surface-variant/70 text-[10px] shrink-0">From:</span>
                      <strong className="text-white/95 font-semibold truncate max-w-[180px]">{ride.pickupLocation}</strong>
                    </div>
                    <div className="relative flex items-center gap-2 text-xs">
                      <div className="absolute -left-[20px] w-2 h-2 rounded-full bg-primary/80" />
                      <span className="text-on-surface-variant/70 text-[10px] shrink-0">To:</span>
                      <strong className="text-white/95 font-semibold truncate max-w-[180px]">{ride.dropLocation}</strong>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-on-surface-variant/40 space-y-3">
                <div className="w-12 h-12 rounded-full bg-surface-container-high/40 flex items-center justify-center mx-auto border border-white/5">
                  <Car className="w-6 h-6 text-on-surface-variant/40" />
                </div>
                <p className="text-xs italic font-medium">No previous rides logged yet.</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowHistory(false)}
            className="w-full h-11 bg-surface-container-high border border-outline-variant hover:bg-white/5 text-on-surface font-bold text-xs uppercase tracking-wider rounded-xl active:scale-[0.98] transition-transform cursor-pointer relative z-10"
          >
            Back to Monitor
          </button>
        </div>
      ) : (
        <>
          {/* 1. SETUP STATE FORM */}
          {rideState === 'setup' && (
            <div className="glass-card-elevated rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden gradient-border hover-lift animate-in fade-in duration-300">
              {/* Background Glow Orbs */}
              <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary/10 rounded-full blur-[50px] pointer-events-none animate-glow-pulse" />
              <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-secondary/5 rounded-full blur-[50px] pointer-events-none animate-glow-pulse" style={{ animationDelay: '1s' }} />
              <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />

              <div className="flex flex-col items-center text-center pb-4 border-b border-white/10 relative z-10">
                <div className="w-12 h-12 bg-primary-container/10 border border-primary/20 rounded-full flex items-center justify-center mb-3 relative">
                  <div className="absolute inset-0 bg-primary/10 rounded-full blur-sm" />
                  <Car className="w-5.5 h-5.5 text-primary relative z-10 animate-float" />
                </div>
                <h3 className="text-base font-black text-white tracking-widest uppercase text-gradient bg-gradient-to-r from-primary to-[#ffcec8]">Configure Safe Ride</h3>
                <p className="text-[11px] text-on-surface-variant font-medium opacity-80 mt-1 max-w-[200px]">
                  Provide vehicle and driver details to enable smart anomaly checking.
                </p>
              </div>

              <form onSubmit={handleStartJourney} className="space-y-4 relative z-10">
                
                {/* Driver Name */}
                <div className="space-y-1.5 group">
                  <label className="text-[9px] font-bold text-on-surface-variant/80 ml-1 tracking-widest uppercase">
                    Driver's Name
                  </label>
                  <div className="relative rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 focus-within:shadow-[0_0_12px_rgba(255,180,172,0.1)] transition-all duration-200">
                    <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      className="w-full h-11 bg-transparent text-on-surface pl-11 pr-4 rounded-xl focus:ring-0 focus:outline-none text-sm placeholder:text-on-surface-variant/40"
                      placeholder="e.g. Marcus Chen"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Vehicle Model & Car Number Grid */}
                <div className="grid grid-cols-2 gap-3.5">
                  {/* Vehicle Model */}
                  <div className="space-y-1.5 group">
                    <label className="text-[9px] font-bold text-on-surface-variant/80 ml-1 tracking-widest uppercase">
                      Vehicle Model
                    </label>
                    <div className="relative rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 focus-within:shadow-[0_0_12px_rgba(255,180,172,0.1)] transition-all duration-200">
                      <Car className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60 group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        className="w-full h-11 bg-transparent text-on-surface pl-10 pr-3 rounded-xl focus:ring-0 focus:outline-none text-sm placeholder:text-on-surface-variant/40"
                        placeholder="e.g. Toyota Camry"
                        value={carModel}
                        onChange={(e) => setCarModel(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Car Number / Plate */}
                  <div className="space-y-1.5 group">
                    <label className="text-[9px] font-bold text-on-surface-variant/80 ml-1 tracking-widest uppercase">
                      Plate Number
                    </label>
                    <div className="relative rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 focus-within:shadow-[0_0_12px_rgba(255,180,172,0.1)] transition-all duration-200">
                      <Compass className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60 group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        className="w-full h-11 bg-transparent text-on-surface pl-10 pr-3 rounded-xl focus:ring-0 focus:outline-none text-sm placeholder:text-on-surface-variant/40"
                        placeholder="e.g. AR-8821"
                        value={carNumber}
                        onChange={(e) => setCarNumber(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Pickup Location */}
                <div className="space-y-1.5 group">
                  <label className="text-[9px] font-bold text-on-surface-variant/80 ml-1 tracking-widest uppercase">
                    Pickup Location
                  </label>
                  <div className="relative rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 focus-within:shadow-[0_0_12px_rgba(255,180,172,0.1)] transition-all duration-200">
                    <MapPin className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-secondary/70 group-focus-within:text-secondary transition-colors" />
                    <input
                      type="text"
                      className="w-full h-11 bg-transparent text-on-surface pl-11 pr-4 rounded-xl focus:ring-0 focus:outline-none text-sm placeholder:text-on-surface-variant/40"
                      placeholder="Enter pickup point"
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Destination Location */}
                <div className="space-y-1.5 group">
                  <label className="text-[9px] font-bold text-on-surface-variant/80 ml-1 tracking-widest uppercase">
                    Drop Location
                  </label>
                  <div className="relative rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 focus-within:shadow-[0_0_12px_rgba(255,180,172,0.1)] transition-all duration-200">
                    <Navigation className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-primary/70 group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      className="w-full h-11 bg-transparent text-on-surface pl-11 pr-4 rounded-xl focus:ring-0 focus:outline-none text-sm placeholder:text-on-surface-variant/40"
                      placeholder="Enter drop destination"
                      value={dropLocation}
                      onChange={(e) => setDropLocation(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-12.5 bg-gradient-to-r from-secondary-container via-secondary to-secondary-container text-white font-black text-xs uppercase tracking-widest rounded-xl hover:shadow-[0_0_16px_rgba(51,148,241,0.3)] shadow-[0_4px_16px_rgba(51,148,241,0.15)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-6 cursor-pointer shimmer animate-gradient-shift"
                >
                  <span>Start Safe Journey</span>
                  <Play className="w-3.5 h-3.5 fill-white" />
                </button>
              </form>
            </div>
          )}

          {/* 2. ACTIVE MONITORING STATE */}
          {rideState === 'active' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              
              {/* Top Banner Warning Overlay */}
              {showAlert && (
                <div className="glass-card mb-4 p-4 rounded-2xl border border-primary/30 bg-primary/[0.04] flex items-start justify-between animate-in slide-in-from-top duration-300 shadow-[0_4px_20px_rgba(255,84,76,0.1)]">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-4.5 h-4.5 text-primary animate-pulse" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-primary uppercase tracking-wider">Unplanned Route Change</p>
                      <p className="text-[11px] text-on-surface-variant/90 leading-relaxed mt-0.5">
                        Vehicle has deviated from the typical course. ARIA is analyzing details and active.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowAlert(false)}
                    className="text-on-surface-variant hover:text-white text-[10px] uppercase font-black pl-2.5 cursor-pointer self-center"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Live Map Section */}
              <section className="relative w-full h-[250px] rounded-2xl overflow-hidden glass-card shadow-lg z-0 gradient-border">
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
                        color={showAlert ? '#ff544c' : '#3394f1'} 
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
                <div className="absolute top-4 left-4 glass-card px-3.5 py-1.5 rounded-full flex items-center gap-2 border-white/10" style={{ zIndex: 1000 }}>
                  <span className={`w-2 h-2 rounded-full ${hasReachedDestination ? 'bg-secondary animate-pulse shadow-[0_0_8px_rgba(162,201,255,0.8)]' : showAlert ? 'bg-primary animate-ping shadow-[0_0_8px_rgba(255,84,76,0.8)]' : 'bg-tertiary animate-pulse shadow-[0_0_8px_rgba(114,212,239,0.8)]'}`} />
                  <span className="text-[9px] font-black text-white uppercase tracking-widest font-sans">
                    {hasReachedDestination ? 'Destination Reached' : showAlert ? 'Route Deviation detected' : 'Tracking Active'}
                  </span>
                </div>

                {/* Live GPS coordinates */}
                <div className="absolute bottom-4 left-4 glass-card px-3 py-1.5 rounded-full flex items-center gap-2 border-white/10" style={{ zIndex: 1000 }}>
                  <MapPin className="w-3 h-3 text-secondary" />
                  <span className="text-[9px] font-mono font-bold text-white">
                    {gpsCoords 
                      ? `${gpsCoords.lat.toFixed(4)}°, ${gpsCoords.lng.toFixed(4)}°`
                      : 'Acquiring GPS...'}
                  </span>
                </div>
              </section>

              {/* Trip Status Card Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card rounded-2xl p-4 text-center hover-lift gradient-border">
                  <p className="text-[9px] font-black text-on-surface-variant/60 uppercase tracking-widest mb-1">ETA</p>
                  <h3 className="text-lg font-black text-primary text-gradient bg-gradient-to-r from-primary to-[#ffcec8]">
                    {hasReachedDestination ? 0 : estimatedEta} <span className="text-xs font-bold text-on-surface-variant">mins</span>
                  </h3>
                </div>
                <div className="glass-card rounded-2xl p-4 text-center hover-lift gradient-border">
                  <p className="text-[9px] font-black text-on-surface-variant/60 uppercase tracking-widest mb-1">Distance Left</p>
                  <h3 className="text-lg font-black text-white">
                    {hasReachedDestination ? 0 : distanceRemaining.toFixed(1)} <span className="text-xs font-bold text-on-surface-variant">km</span>
                  </h3>
                </div>
              </div>

              {/* User-provided Driver / Vehicle Card */}
              <div className="glass-card rounded-3xl p-5 space-y-4 border border-white/5 relative overflow-hidden">
                <div className="absolute -top-16 -right-16 w-32 h-32 bg-secondary/5 rounded-full blur-[40px] pointer-events-none" />
                
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3.5">
                    {/* Driver Avatar Wrapper */}
                    <div className="relative">
                      <div className="w-13 h-13 rounded-full border border-primary/20 bg-surface-container-highest flex items-center justify-center text-primary shrink-0 relative z-10 shadow-lg">
                        <User className="w-5.5 h-5.5 text-primary" />
                      </div>
                      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary to-secondary opacity-25 blur-sm -m-0.5 animate-pulse" />
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-secondary rounded-full border-2 border-[#1e0f0e] z-20 shadow-md" />
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-black text-white tracking-wide">{driverName}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-primary fill-primary" />
                          <span className="text-[11px] font-bold text-white">4.9</span>
                        </div>
                        <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">• Secure Verification</span>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => alert(`Dialing ${driverName} via secure encrypted proxy...`)}
                    className="w-11 h-11 rounded-full glass-card hover:bg-white/10 flex items-center justify-center text-secondary active:scale-90 transition-all cursor-pointer border border-white/10 hover:shadow-[0_0_12px_rgba(162,201,255,0.2)] shadow-md"
                  >
                    <Phone className="w-4.5 h-4.5 text-secondary" />
                  </button>
                </div>

                <div className="pt-4 border-t border-outline-variant/20 grid grid-cols-2 gap-4 text-xs relative z-10">
                  <div>
                    <p className="text-[9px] font-black text-on-surface-variant/60 uppercase tracking-widest">Vehicle Details</p>
                    <p className="text-[11px] font-black text-white/95 mt-0.5 uppercase tracking-wide">{carModel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-on-surface-variant/60 uppercase tracking-widest">Plate Number</p>
                    <p className="text-[10px] font-mono font-black text-primary bg-surface-container-highest/60 px-2.5 py-0.5 rounded-lg border border-outline-variant inline-block mt-0.5">
                      {carNumber}
                    </p>
                  </div>
                </div>

                {/* Elegant Location Route Timeline */}
                <div className="pt-4 border-t border-outline-variant/20 space-y-3.5 relative pl-6 z-10">
                  {/* Vertical line connector */}
                  <div className="absolute left-[9px] top-6.5 bottom-6.5 w-0.5 border-l border-dashed border-white/15" />
                  
                  <div className="relative flex items-start gap-3.5 text-xs text-on-surface-variant">
                    <div className="absolute -left-[20px] top-1.5 w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(162,201,255,0.6)]" />
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-secondary uppercase tracking-widest">Pickup point</span>
                      <span className="text-white/90 font-bold text-[11px] mt-0.5 truncate max-w-[210px]">{pickupLocation}</span>
                    </div>
                  </div>
                  
                  <div className="relative flex items-start gap-3.5 text-xs text-on-surface-variant">
                    <div className="absolute -left-[20px] top-1.5 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(255,180,172,0.6)]" />
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-primary uppercase tracking-widest">Drop destination</span>
                      <span className="text-white/90 font-bold text-[11px] mt-0.5 truncate max-w-[210px]">{dropLocation}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Safety Actions */}
              <div className="space-y-3 pt-2">
                {/* Complete Ride Button */}
                <button 
                  onClick={handleCompleteJourney}
                  className="w-full h-12.5 bg-gradient-to-r from-secondary-container via-tertiary-container to-secondary-container text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg hover:shadow-[0_0_16px_rgba(51,148,241,0.25)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shimmer animate-gradient-shift"
                >
                  <Check className="w-4 h-4" />
                  <span>{hasReachedDestination ? "Arrived! Complete Journey" : "Complete Journey & End Ride"}</span>
                </button>

                <button 
                  onClick={() => setShowSuspiciousModal(true)}
                  className="w-full h-12.5 border border-primary/30 text-primary bg-primary/[0.02] hover:bg-primary/[0.06] rounded-xl font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  <span>Report Suspicious Activity</span>
                </button>

                <button 
                  onClick={handleCancelJourney}
                  className="w-full h-12 border border-outline-variant/50 text-on-surface-variant hover:bg-white/5 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-transform flex items-center justify-center gap-2 cursor-pointer"
                >
                  Cancel Journey Monitor
                </button>

                {/* Central Pulse Emergency Trigger Button */}
                <div className="flex flex-col items-center gap-2 pt-4 relative">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-24 h-24 rounded-full border border-primary/10 pointer-events-none animate-ping" />
                    <button 
                      onClick={() => onTriggerSOS('manual', undefined, gpsCoords)}
                      className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-container via-[#ef4444] to-[#c01812] text-white flex items-center justify-center shadow-[0_0_20px_rgba(255,84,76,0.4)] hover:shadow-[0_0_30px_rgba(255,84,76,0.6)] active:scale-90 transition-all cursor-pointer animate-pulse z-10"
                    >
                      <AlertCircle className="w-10 h-10 text-white" />
                    </button>
                  </div>
                  <span className="text-[8px] font-black text-on-surface-variant/80 uppercase tracking-widest mt-2">
                    Tap to trigger instant SOS
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 3. ARRIVED STATE */}
          {rideState === 'arrived' && (
            <div className="glass-card-elevated rounded-3xl p-6 text-center space-y-6 animate-in zoom-in-95 duration-300 gradient-border relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-secondary/10 rounded-full blur-[40px] pointer-events-none" />
              <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
              
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(162,201,255,0.25)] relative z-10">
                <Check className="w-8 h-8 text-secondary" />
              </div>
              
              <div className="space-y-2 relative z-10">
                <h3 className="text-lg font-black text-secondary uppercase tracking-widest text-gradient bg-gradient-to-r from-secondary to-[#c0dcff]">Arrived Safely!</h3>
                <p className="text-xs text-on-surface-variant/90 leading-relaxed max-w-[240px] mx-auto">
                  Journey concluded successfully. ARIA real-time route checking has shut down.
                </p>
              </div>

              {/* Summary Receipt Layout */}
              <div className="p-4.5 rounded-2xl bg-surface-container-lowest/60 border border-white/5 text-left text-xs space-y-2.5 font-mono relative z-10">
                <div className="pb-2 border-b border-white/5 flex justify-between items-center text-[10px] text-on-surface-variant/60">
                  <span>JOURNEY STATUS</span>
                  <span className="text-secondary font-bold">SUCCESSFUL</span>
                </div>
                <p className="flex justify-between">
                  <span className="text-on-surface-variant/60">👤 DRIVER:</span>
                  <span className="text-white font-bold">{driverName}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-on-surface-variant/60">🚗 VEHICLE:</span>
                  <span className="text-white font-bold truncate max-w-[140px]">{carModel}</span>
                </p>
                <div className="pt-2 border-t border-white/5 space-y-1">
                  <p className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-on-surface-variant/50">PICKUP:</span>
                    <span className="text-white font-bold truncate">{pickupLocation}</span>
                  </p>
                  <p className="flex flex-col gap-0.5 mt-1.5">
                    <span className="text-[10px] text-on-surface-variant/50">DESTINATION:</span>
                    <span className="text-white font-bold truncate">{dropLocation}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={resetJourneyState}
                className="w-full h-12 bg-gradient-to-r from-primary-container via-primary to-primary-container text-on-primary font-black text-xs uppercase tracking-widest rounded-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-[0_0_15px_rgba(255,180,172,0.25)] relative z-10"
              >
                <span>Start New Journey</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Custom Report Suspicious Activity Modal Dialog */}
      {showSuspiciousModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-sm glass-card-elevated p-6 border border-primary/20 space-y-6 animate-in zoom-in-95 duration-200 shadow-2xl relative overflow-hidden rounded-3xl">
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-primary/10 rounded-full blur-[40px] pointer-events-none" />
            
            <button 
              onClick={() => setShowSuspiciousModal(false)}
              className="absolute top-4.5 right-4.5 text-on-surface-variant/60 hover:text-white text-xs font-black p-1.5 cursor-pointer active:scale-95 transition-all rounded-full hover:bg-white/5"
            >
              ✕
            </button>

            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mb-1 relative">
                <div className="absolute inset-0 bg-primary/10 rounded-full blur-sm" />
                <AlertTriangle className="w-5.5 h-5.5 text-primary animate-pulse relative z-10" />
              </div>
              <h3 className="text-sm font-black text-primary uppercase tracking-widest">Suspicious Activity Protocol</h3>
              <p className="text-xs text-on-surface-variant/80 leading-relaxed max-w-[220px]">
                Initiate emergency checks or dial direct assistance below.
              </p>
            </div>

            <div className="space-y-3 relative z-10">
              {/* Option 1: Alert Emergency Contacts */}
              <button
                onClick={() => {
                  setShowSuspiciousModal(false);
                  onTriggerSOS('manual', undefined, gpsCoords);
                }}
                className="w-full py-3.5 px-4 bg-surface-container hover:bg-surface-container-high text-white border border-white/10 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Phone className="w-4 h-4 text-secondary" />
                Call/SMS Emergency Contacts
              </button>

              {/* Option-2: Directly Report to Police */}
              <button
                onClick={handleReportToPolice}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white border border-red-500/30 rounded-xl font-black text-xs uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer safe-glow"
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
              className="w-full py-2.5 text-on-surface-variant/60 hover:text-white font-black text-xs uppercase tracking-widest transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

