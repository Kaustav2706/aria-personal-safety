import React, { useState, useEffect, useRef } from 'react';
import { Shield, Bell, Phone, Star, AlertTriangle, AlertCircle, Trash, MapPin, User, Car, Check, Navigation, Play, Pause, RotateCcw, Compass, History, RefreshCw, Layers } from 'lucide-react';
import { monitoringService } from '../services/api';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';

// Google Maps Style Start Marker (A / Green Pin)
const pickupIcon = L.divIcon({
  html: `<div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));">
           <div style="background: #10b981; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; border: 2.5px solid #ffffff; box-shadow: 0 0 12px rgba(16,185,129,0.9);">
             A
           </div>
           <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 7px solid #10b981; margin-top: -1px;"></div>
         </div>`,
  className: 'pickup-marker',
  iconSize: [28, 35],
  iconAnchor: [14, 35],
  popupAnchor: [0, -35]
});

// Google Maps Style Destination Marker (B / Red Pin)
const destinationIcon = L.divIcon({
  html: `<div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));">
           <div style="background: #ef4444; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; border: 2.5px solid #ffffff; box-shadow: 0 0 12px rgba(239,68,68,0.9);">
             B
           </div>
           <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 7px solid #ef4444; margin-top: -1px;"></div>
         </div>`,
  className: 'destination-marker',
  iconSize: [28, 35],
  iconAnchor: [14, 35],
  popupAnchor: [0, -35]
});

// Live Vehicle Navigation Marker with Pulsing Beacon
const userIcon = L.divIcon({
  html: `<div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
           <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background-color: #38bdf8; opacity: 0.4; animation: pulse-ring 1.5s infinite ease-in-out;"></div>
           <div style="position: relative; width: 18px; height: 18px; border-radius: 50%; background-color: #0284c7; border: 2.5px solid white; box-shadow: 0 0 10px rgba(2,132,199,1); display: flex; align-items: center; justify-content: center;">
             <div style="width: 5px; height: 5px; border-radius: 50%; background-color: white;"></div>
           </div>
         </div>`,
  className: 'user-gps-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// Map Viewport Controller: fits full route or centers on vehicle
function MapController({ 
  waypoints, 
  gpsCoords, 
  mode 
}: { 
  waypoints: { lat: number; lng: number }[]; 
  gpsCoords: { lat: number; lng: number } | null;
  mode: 'fit' | 'follow';
}) {
  const map = useMap();

  // Fit bounds when route loads or user toggles 'Route' overview
  useEffect(() => {
    if (waypoints && waypoints.length > 0 && mode === 'fit') {
      const bounds = L.latLngBounds(waypoints.map(w => [w.lat, w.lng]));
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
    }
  }, [waypoints, mode, map]);

  // Track and follow car when user selects 'Follow' mode
  useEffect(() => {
    if (mode === 'follow' && gpsCoords) {
      map.setView([gpsCoords.lat, gpsCoords.lng], Math.max(map.getZoom(), 16));
    }
  }, [gpsCoords, mode, map]);

  return null;
}

// Pre-seeded local dictionary for zero-latency instant geocoding
interface KnownLocation {
  lat: number;
  lng: number;
  name: string;
}

const KNOWN_LOCATIONS: Record<string, KnownLocation> = {
  // Manipal University Jaipur & immediate surroundings
  'manipal university jaipur': { lat: 26.8429, lng: 75.5654, name: 'Manipal University Jaipur' },
  'manipal university': { lat: 26.8429, lng: 75.5654, name: 'Manipal University Jaipur' },
  'muj': { lat: 26.8429, lng: 75.5654, name: 'Manipal University Jaipur' },
  'manipal': { lat: 26.8429, lng: 75.5654, name: 'Manipal University Jaipur' },
  'dehmi kalan': { lat: 26.8351, lng: 75.5631, name: 'Dehmi Kalan, Jaipur' },
  'dahmi kalan': { lat: 26.8351, lng: 75.5631, name: 'Dehmi Kalan, Jaipur' },
  'dehmi': { lat: 26.8351, lng: 75.5631, name: 'Dehmi Kalan, Jaipur' },
  'dahmi': { lat: 26.8351, lng: 75.5631, name: 'Dehmi Kalan, Jaipur' },
  'bagru': { lat: 26.8123, lng: 75.5458, name: 'Bagru, Jaipur' },
  'ajmer road': { lat: 26.8778, lng: 75.7291, name: 'Ajmer Road, Jaipur' },

  // Jaipur City Hubs & Famous Localities
  'bapu nagar': { lat: 26.8851, lng: 75.8010, name: 'Bapu Nagar, Jaipur' },
  'bapunagar': { lat: 26.8851, lng: 75.8010, name: 'Bapu Nagar, Jaipur' },
  'gandhi nagar': { lat: 26.8797, lng: 75.8038, name: 'Gandhi Nagar, Jaipur' },
  'gandhinagar': { lat: 26.8797, lng: 75.8038, name: 'Gandhi Nagar, Jaipur' },
  'vaishali nagar': { lat: 26.9096, lng: 75.7392, name: 'Vaishali Nagar, Jaipur' },
  'vaishali': { lat: 26.9096, lng: 75.7392, name: 'Vaishali Nagar, Jaipur' },
  'mansarovar': { lat: 26.8622, lng: 75.7610, name: 'Mansarovar, Jaipur' },
  'malviya nagar': { lat: 26.8532, lng: 75.8171, name: 'Malviya Nagar, Jaipur' },
  'raja park': { lat: 26.8973, lng: 75.8276, name: 'Raja Park, Jaipur' },
  'c scheme': { lat: 26.9107, lng: 75.7997, name: 'C-Scheme, Jaipur' },
  'c-scheme': { lat: 26.9107, lng: 75.7997, name: 'C-Scheme, Jaipur' },
  'civil lines': { lat: 26.9085, lng: 75.7877, name: 'Civil Lines, Jaipur' },
  'sindhi camp': { lat: 26.9234, lng: 75.7994, name: 'Sindhi Camp, Jaipur' },
  'jaipur railway station': { lat: 26.9196, lng: 75.7878, name: 'Jaipur Junction Railway Station' },
  'jaipur junction': { lat: 26.9196, lng: 75.7878, name: 'Jaipur Junction Railway Station' },
  'railway station': { lat: 26.9196, lng: 75.7878, name: 'Jaipur Junction Railway Station' },
  'jaipur airport': { lat: 26.8289, lng: 75.8056, name: 'Jaipur International Airport' },
  'airport': { lat: 26.8289, lng: 75.8056, name: 'Jaipur International Airport' },
  'sanganer airport': { lat: 26.8289, lng: 75.8056, name: 'Jaipur International Airport' },
  'hawa mahal': { lat: 26.9239, lng: 75.8267, name: 'Hawa Mahal, Jaipur' },
  'amer fort': { lat: 26.9855, lng: 75.8513, name: 'Amer Fort, Jaipur' },
  'amber fort': { lat: 26.9855, lng: 75.8513, name: 'Amer Fort, Jaipur' },
  'jagatpura': { lat: 26.8276, lng: 75.8570, name: 'Jagatpura, Jaipur' },
  'vidhyadhar nagar': { lat: 26.9632, lng: 75.7792, name: 'Vidhyadhar Nagar, Jaipur' },
  'vidyadhar nagar': { lat: 26.9632, lng: 75.7792, name: 'Vidhyadhar Nagar, Jaipur' },
  'tonk road': { lat: 26.8488, lng: 75.8033, name: 'Tonk Road, Jaipur' },
  'gopalpura': { lat: 26.8647, lng: 75.7789, name: 'Gopalpura Bypass, Jaipur' },

  // Kolkata Defaults (for demo fallbacks)
  'salt lake': { lat: 22.5867, lng: 88.4178, name: 'Salt Lake, Kolkata' },
  'park street': { lat: 22.5516, lng: 88.3524, name: 'Park Street, Kolkata' },
  'howrah station': { lat: 22.5839, lng: 88.3426, name: 'Howrah Railway Station' },
  'howrah': { lat: 22.5839, lng: 88.3426, name: 'Howrah Railway Station' },
  'new town': { lat: 22.5888, lng: 88.4735, name: 'New Town, Kolkata' },

  // Delhi / Bangalore Hubs
  'connaught place': { lat: 28.6304, lng: 77.2177, name: 'Connaught Place, New Delhi' },
  'delhi airport': { lat: 28.5562, lng: 77.1000, name: 'Indira Gandhi International Airport' },
  'koramangala': { lat: 12.9352, lng: 77.6245, name: 'Koramangala, Bengaluru' },
  'indiranagar': { lat: 12.9784, lng: 77.6408, name: 'Indiranagar, Bengaluru' }
};

// Haversine distance formula (in km)
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

// Fallback interpolation for offline routing
function generateInterpolatedPath(start: { lat: number; lng: number }, end: { lat: number; lng: number }, steps = 30) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
    });
  }
  return points;
}

// Smart geocoding with local dictionary & geographic viewbox bias
async function geocodeLocation(
  query: string, 
  userCoords?: { lat: number; lng: number } | null
): Promise<{ lat: number; lng: number; displayName: string }> {
  const qClean = query.trim().toLowerCase();
  
  // 1. Direct match in local dictionary
  for (const [key, val] of Object.entries(KNOWN_LOCATIONS)) {
    if (qClean === key || qClean.includes(key) || key.includes(qClean)) {
      return { lat: val.lat, lng: val.lng, displayName: val.name };
    }
  }

  // 2. Query OpenStreetMap Nominatim API with proximity viewbox
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    
    // Bias search towards local city region (+/- 0.7 degrees)
    const centerLat = userCoords?.lat || 26.8429;
    const centerLng = userCoords?.lng || 75.5654;
    const viewbox = `${centerLng - 0.7},${centerLat + 0.7},${centerLng + 0.7},${centerLat - 0.7}`;

    // Step A: Search within regional viewbox
    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=5&viewbox=${viewbox}&q=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        clearTimeout(timeoutId);
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          displayName: data[0].display_name
        };
      }
    }

    // Step B: Search with explicit city hint
    if (!qClean.includes('jaipur') && !qClean.includes('india')) {
      const retryRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=3&q=${encodeURIComponent(query + ' Jaipur')}`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (retryRes.ok) {
        const retryData = await retryRes.json();
        if (Array.isArray(retryData) && retryData.length > 0) {
          clearTimeout(timeoutId);
          return {
            lat: parseFloat(retryData[0].lat),
            lng: parseFloat(retryData[0].lon),
            displayName: retryData[0].display_name
          };
        }
      }
    }

    // Step C: Global unconstrained search
    const globalRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { 'Accept': 'application/json' } }
    );
    clearTimeout(timeoutId);
    if (globalRes.ok) {
      const globalData = await globalRes.json();
      if (Array.isArray(globalData) && globalData.length > 0) {
        return {
          lat: parseFloat(globalData[0].lat),
          lng: parseFloat(globalData[0].lon),
          displayName: globalData[0].display_name
        };
      }
    }
  } catch (err) {
    console.warn('[SAFE_RIDE] Nominatim geocode fallback:', err);
  }

  // 3. Fallback based on center coords + pseudo-hash offset
  const baseLat = userCoords?.lat || 26.8429;
  const baseLng = userCoords?.lng || 75.5654;
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    hash = (hash << 5) - hash + query.charCodeAt(i);
    hash |= 0;
  }
  const offsetLat = (((Math.abs(hash) % 100) / 100) - 0.5) * 0.03;
  const offsetLng = (((Math.abs(hash >> 3) % 100) / 100) - 0.5) * 0.03;
  
  return {
    lat: baseLat + offsetLat,
    lng: baseLng + offsetLng,
    displayName: query
  };
}

// Real road driving route via Open Source Routing Machine (OSRM)
async function fetchDrivingRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): Promise<{ waypoints: { lat: number; lng: number }[]; distanceKm: number; durationMins: number }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates; // [[lng, lat], ...]
        const waypoints = coordinates.map((c: [number, number]) => ({ lat: c[1], lng: c[0] }));
        const distanceKm = Number((route.distance / 1000).toFixed(1));
        const durationMins = Math.max(1, Math.round(route.duration / 60));
        
        return { waypoints, distanceKm, durationMins };
      }
    }
  } catch (err) {
    console.warn('[SAFE_RIDE] OSRM driving route failed or timed out:', err);
  }

  // Fallback: smooth interpolated path between start and end
  const distanceKm = Number(haversineDistance(start, end).toFixed(1));
  const durationMins = Math.max(1, Math.round(distanceKm * 2.2));
  const waypoints = generateInterpolatedPath(start, end, 30);
  return { waypoints, distanceKm, durationMins };
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
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

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

  // Live simulation & route states
  const [showAlert, setShowAlert] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [routeWaypoints, setRouteWaypoints] = useState<{ lat: number; lng: number }[]>([]);
  const [simulationPath, setSimulationPath] = useState<{ lat: number; lng: number }[]>([]);
  const [totalTripDistanceKm, setTotalTripDistanceKm] = useState<number>(0);
  const [totalTripDurationMins, setTotalTripDurationMins] = useState<number>(0);
  const [currentPathIndex, setCurrentPathIndex] = useState(0);
  const [hasReachedDestination, setHasReachedDestination] = useState(false);
  const [deviationDistance, setDeviationDistance] = useState<number>(0);
  const [isVeeringOff, setIsVeeringOff] = useState(false);

  // User-Controlled Simulation & Map View Controls
  const [isDriving, setIsDriving] = useState(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [mapMode, setMapMode] = useState<'fit' | 'follow'>('fit');
  const [mapLayer, setMapLayer] = useState<'dark' | 'standard' | 'satellite'>('dark');

  const simulationIntervalRef = useRef<number | null>(null);

  // Threshold in km to detect route deviation (0.25 km = 250 meters)
  const ROUTE_DEVIATION_THRESHOLD_KM = 0.25;

  // Calculates perpendicular distance from point p to segment between a and b
  function distanceToSegment(
    p: { lat: number; lng: number },
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
  ): number {
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) return haversineDistance(p, a);

    const t = Math.max(0, Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq));
    const projection = {
      lat: a.lat + t * dy,
      lng: a.lng + t * dx,
    };

    return haversineDistance(p, projection);
  }

  // Calculates cross-track distance from vehicle coordinate to intended route polyline
  function calculateDistanceToRoute(
    point: { lat: number; lng: number },
    waypoints: { lat: number; lng: number }[]
  ): number {
    if (!waypoints || waypoints.length < 2) return 0;
    let minDistance = Infinity;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const d = distanceToSegment(point, waypoints[i], waypoints[i + 1]);
      if (d < minDistance) {
        minDistance = d;
      }
    }

    return minDistance === Infinity ? 0 : minDistance;
  }

  // Start the safe journey with real geocoding and real road route
  const handleStartJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName || !carNumber || !carModel || !pickupLocation || !dropLocation) return;

    setIsCalculatingRoute(true);
    setShowAlert(false);

    try {
      // 1. Geocode Pickup & Drop locations with viewbox proximity
      const startGeo = await geocodeLocation(pickupLocation);
      const dropGeo = await geocodeLocation(dropLocation, startGeo);

      const start = { lat: startGeo.lat, lng: startGeo.lng };
      const end = { lat: dropGeo.lat, lng: dropGeo.lng };

      // 2. Fetch real road driving route via OSRM
      const route = await fetchDrivingRoute(start, end);

      setPickupCoords(start);
      setGpsCoords(start);
      setDestination(end);
      setRouteWaypoints(route.waypoints);
      setSimulationPath(route.waypoints);
      setTotalTripDistanceKm(route.distanceKm);
      setTotalTripDurationMins(route.durationMins);
      setCurrentPathIndex(0);
      setHasReachedDestination(false);
      setIsVeeringOff(false);
      setDeviationDistance(0);
      setIsDriving(false); // Sits stationary at pickup until user presses Start Driving
      setMapMode('fit');
      setRideState('active');
    } catch (err) {
      console.error('[SAFE_RIDE] Failed to initialize journey:', err);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Run the coordinate simulation ONLY when isDriving is active
  useEffect(() => {
    if (rideState !== 'active' || simulationPath.length === 0 || !isDriving) {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
      return;
    }

    // Step size based on route length & speed multiplier
    const baseStep = Math.max(1, Math.floor(simulationPath.length / 40));
    const stepSize = Math.max(1, baseStep * simSpeed);

    simulationIntervalRef.current = window.setInterval(() => {
      setCurrentPathIndex((prevIndex) => {
        const nextIndex = Math.min(prevIndex + stepSize, simulationPath.length - 1);
        
        if (prevIndex < simulationPath.length - 1) {
          const currentPoint = simulationPath[nextIndex];
          setGpsCoords(currentPoint);

          // Detect route deviation dynamically by comparing current position to planned route
          const distanceOffRoute = calculateDistanceToRoute(currentPoint, routeWaypoints);
          const isOffRoute = distanceOffRoute > ROUTE_DEVIATION_THRESHOLD_KM;

          if (isOffRoute) {
            setDeviationDistance(distanceOffRoute);
            setShowAlert((prev) => {
              if (!prev) {
                console.log(`[SAFE_RIDE] Route deviation detected: ${(distanceOffRoute * 1000).toFixed(0)}m from intended route.`);
                triggerDeviationMonitoring();
              }
              return true;
            });
          } else {
            setDeviationDistance(0);
            setShowAlert(false);
          }

          if (nextIndex >= simulationPath.length - 1) {
            if (simulationIntervalRef.current) {
              clearInterval(simulationIntervalRef.current);
            }
            setIsDriving(false);
            setHasReachedDestination(true);
          }

          return nextIndex;
        } else {
          if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current);
          }
          setIsDriving(false);
          setHasReachedDestination(true);
          return prevIndex;
        }
      });
    }, 1000);

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, [rideState, simulationPath, routeWaypoints, isDriving, simSpeed]);

  // Trigger backend monitoring session on deviation
  const triggerDeviationMonitoring = async () => {
    try {
      await monitoringService.startSession();
      console.log('[SAFE_RIDE] Route deviation detected — elevated monitoring active.');
    } catch (err) {
      console.warn('[SAFE_RIDE] Failed to trigger deviation monitoring session:', err);
    }
  };

  // Allows tester/user to simulate an off-route turn
  const handleSimulateDeviation = () => {
    if (!gpsCoords || simulationPath.length === 0) return;
    const currentIndex = currentPathIndex;
    const remaining = simulationPath.slice(currentIndex);
    const deviated = remaining.map((pt, i) => {
      // Diverge noticeably perpendicular to route (approx 0.006 lat/lng ~ 600m+)
      const offsetLat = 0.006 + (i * 0.0006);
      const offsetLng = -0.006 - (i * 0.0006);
      return {
        lat: pt.lat + offsetLat,
        lng: pt.lng + offsetLng
      };
    });

    const newPath = [...simulationPath.slice(0, currentIndex), ...deviated];
    setSimulationPath(newPath);
    setIsVeeringOff(true);
  };

  // Re-routes back to planned destination using real road routing
  const handleRejoinRoute = async () => {
    if (!gpsCoords || !destination) return;
    setIsVeeringOff(false);
    setShowAlert(false);
    setDeviationDistance(0);

    const route = await fetchDrivingRoute(gpsCoords, destination);
    setRouteWaypoints(route.waypoints);
    setSimulationPath(route.waypoints);
    setCurrentPathIndex(0);
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
    setIsDriving(false);
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
    setPickupCoords(null);
    setGpsCoords(null);
    setDestination(null);
    setRouteWaypoints([]);
    setSimulationPath([]);
    setCurrentPathIndex(0);
    setShowAlert(false);
    setHasReachedDestination(false);
    setIsVeeringOff(false);
    setDeviationDistance(0);
    setTotalTripDistanceKm(0);
    setTotalTripDurationMins(0);
    setIsDriving(false);
    setMapMode('fit');
  };

  // Dynamic calculations along remaining road waypoints
  const calculateRemainingDistance = (): number => {
    if (hasReachedDestination) return 0;
    if (!gpsCoords || !destination || simulationPath.length === 0) return 0;
    
    // Sum segment lengths from currentPathIndex to end of simulationPath
    let remaining = 0;
    for (let i = currentPathIndex; i < simulationPath.length - 1; i++) {
      remaining += haversineDistance(simulationPath[i], simulationPath[i + 1]);
    }
    if (remaining === 0 && currentPathIndex < simulationPath.length - 1) {
      remaining = haversineDistance(gpsCoords, destination);
    }
    return remaining;
  };

  const distanceRemaining = calculateRemainingDistance();
  const estimatedEta = hasReachedDestination 
    ? 0 
    : (totalTripDistanceKm > 0 && totalTripDurationMins > 0
        ? Math.max(1, Math.round((distanceRemaining / totalTripDistanceKm) * totalTripDurationMins))
        : Math.max(1, Math.round(distanceRemaining * 2.2))
      );

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
                <p className="text-[11px] text-on-surface-variant font-medium opacity-80 mt-1 max-w-[240px]">
                  Real road mapping & live anomaly monitoring with full street level detail.
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
                      placeholder="e.g. John"
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
                        placeholder="e.g. Toyota"
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
                        placeholder="e.g. 1234"
                        value={carNumber}
                        onChange={(e) => setCarNumber(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Pickup Location */}
                <div className="space-y-1.5 group">
                  <label className="text-[9px] font-bold text-on-surface-variant/80 ml-1 tracking-widest uppercase flex items-center justify-between">
                    <span>Pickup Location (Starting Point A)</span>
                    <span className="text-emerald-400 font-bold text-[8px] uppercase">Pin A • Real Road</span>
                  </label>
                  <div className="relative rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/10 focus-within:shadow-[0_0_12px_rgba(16,185,129,0.15)] transition-all duration-200">
                    <MapPin className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 group-focus-within:text-emerald-300 transition-colors" />
                    <input
                      type="text"
                      className="w-full h-11 bg-transparent text-on-surface pl-11 pr-4 rounded-xl focus:ring-0 focus:outline-none text-sm placeholder:text-on-surface-variant/40"
                      placeholder="e.g. Manipal University Jaipur"
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Destination Location */}
                <div className="space-y-1.5 group">
                  <label className="text-[9px] font-bold text-on-surface-variant/80 ml-1 tracking-widest uppercase flex items-center justify-between">
                    <span>Drop Destination (Destination B)</span>
                    <span className="text-rose-400 font-bold text-[8px] uppercase">Pin B • Driving Path</span>
                  </label>
                  <div className="relative rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-rose-500/50 focus-within:ring-2 focus-within:ring-rose-500/10 focus-within:shadow-[0_0_12px_rgba(239,68,68,0.15)] transition-all duration-200">
                    <Navigation className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-rose-400 group-focus-within:text-rose-300 transition-colors" />
                    <input
                      type="text"
                      className="w-full h-11 bg-transparent text-on-surface pl-11 pr-4 rounded-xl focus:ring-0 focus:outline-none text-sm placeholder:text-on-surface-variant/40"
                      placeholder="e.g. Dehmi Kalan or Bapu Nagar"
                      value={dropLocation}
                      onChange={(e) => setDropLocation(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Convenient Quick Suggestion Presets */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[8px] font-bold text-on-surface-variant/60 uppercase tracking-widest block">Quick Route Presets:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPickupLocation('Manipal University Jaipur');
                        setDropLocation('Dehmi Kalan');
                        if (!driverName) setDriverName('John');
                        if (!carModel) setCarModel('Toyota');
                        if (!carNumber) setCarNumber('1234');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-surface-container text-[10px] text-white/80 border border-white/5 hover:border-emerald-500/40 hover:text-white transition-all cursor-pointer font-medium"
                    >
                      📍 MUJ ➔ Dehmi Kalan (~0.9 km)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPickupLocation('Manipal University Jaipur');
                        setDropLocation('Bapu Nagar');
                        if (!driverName) setDriverName('John');
                        if (!carModel) setCarModel('Toyota');
                        if (!carNumber) setCarNumber('1234');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-surface-container text-[10px] text-white/80 border border-white/5 hover:border-primary/40 hover:text-white transition-all cursor-pointer font-medium"
                    >
                      📍 MUJ ➔ Bapu Nagar (~29.5 km)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPickupLocation('Manipal University Jaipur');
                        setDropLocation('Vaishali Nagar');
                        if (!driverName) setDriverName('John');
                        if (!carModel) setCarModel('Toyota');
                        if (!carNumber) setCarNumber('1234');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-surface-container text-[10px] text-white/80 border border-white/5 hover:border-secondary/40 hover:text-white transition-all cursor-pointer font-medium"
                    >
                      📍 MUJ ➔ Vaishali Nagar (~22.5 km)
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isCalculatingRoute}
                  className="w-full h-12.5 bg-gradient-to-r from-secondary-container via-secondary to-secondary-container text-white font-black text-xs uppercase tracking-widest rounded-xl hover:shadow-[0_0_16px_rgba(51,148,241,0.3)] shadow-[0_4px_16px_rgba(51,148,241,0.15)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-6 cursor-pointer shimmer animate-gradient-shift disabled:opacity-75"
                >
                  {isCalculatingRoute ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Calculating Real Route & Distance...</span>
                    </>
                  ) : (
                    <>
                      <span>Start Safe Journey</span>
                      <Play className="w-3.5 h-3.5 fill-white" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* 2. ACTIVE MONITORING STATE */}
          {rideState === 'active' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              
              {/* Top Banner Warning Overlay */}
              {showAlert && (
                <div className="glass-card mb-3 p-4 rounded-2xl border border-primary/30 bg-primary/[0.04] flex items-start justify-between animate-in slide-in-from-top duration-300 shadow-[0_4px_20px_rgba(255,84,76,0.1)]">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-4.5 h-4.5 text-primary animate-pulse" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-primary uppercase tracking-wider">Unplanned Route Change</p>
                      <p className="text-[11px] text-on-surface-variant/90 leading-relaxed mt-0.5">
                        Vehicle has deviated {deviationDistance > 0 ? `${(deviationDistance * 1000).toFixed(0)}m ` : ''}from planned course. ARIA elevated monitoring is active.
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

              {/* Live Real Street Map (Identical Tactical OSM Dark as Police Dashboard) */}
              <section className="relative w-full h-[280px] rounded-2xl overflow-hidden glass-card shadow-lg z-0 gradient-border">
                {gpsCoords ? (
                  <MapContainer 
                    center={[gpsCoords.lat, gpsCoords.lng]} 
                    zoom={15} 
                    style={{ width: '100%', height: '100%' }}
                    zoomControl={false}
                  >
                    {/* Map Layers (Default: Tactical OSM Dark with high contrast street labels) */}
                    {mapLayer === 'dark' && (
                      <TileLayer
                        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        className="tactical-osm-dark"
                        maxZoom={19}
                      />
                    )}
                    {mapLayer === 'standard' && (
                      <TileLayer
                        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        maxZoom={19}
                      />
                    )}
                    {mapLayer === 'satellite' && (
                      <>
                        <TileLayer
                          url="https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                          attribution="Tiles &copy; Esri"
                          maxZoom={19}
                        />
                        <TileLayer
                          url="https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
                          attribution=""
                          maxZoom={19}
                        />
                      </>
                    )}

                    {/* Planned Road Route Polyline (Double Layered Google Maps Road Glow) */}
                    {routeWaypoints.length > 1 && (
                      <>
                        <Polyline 
                          positions={routeWaypoints.map(w => [w.lat, w.lng])} 
                          color="#0284c7" 
                          weight={7}
                          opacity={0.4}
                        />
                        <Polyline 
                          positions={routeWaypoints.map(w => [w.lat, w.lng])} 
                          color={showAlert ? '#ff544c' : '#38bdf8'} 
                          weight={4}
                          opacity={0.95}
                        />
                      </>
                    )}

                    {/* Deviated Path Polyline (if simulating anomaly) */}
                    {isVeeringOff && simulationPath.length > currentPathIndex && (
                      <Polyline
                        positions={simulationPath.slice(currentPathIndex).map(w => [w.lat, w.lng])}
                        color="#f59e0b"
                        weight={4}
                        dashArray="6, 6"
                        opacity={0.9}
                      />
                    )}

                    {/* Starting Point A Marker (Google Maps Style Green Pin) */}
                    {pickupCoords && (
                      <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={pickupIcon}>
                        <Popup>
                          <div style={{ color: '#0f172a', fontFamily: 'sans-serif', fontSize: '11px', padding: '2px' }}>
                            <strong style={{ color: '#059669', display: 'block', textTransform: 'uppercase', fontSize: '10px' }}>🟢 Pickup Point (A)</strong>
                            <span>{pickupLocation}</span>
                          </div>
                        </Popup>
                      </Marker>
                    )}

                    {/* Destination Point B Marker (Google Maps Style Red Pin) */}
                    {destination && (
                      <Marker position={[destination.lat, destination.lng]} icon={destinationIcon}>
                        <Popup>
                          <div style={{ color: '#0f172a', fontFamily: 'sans-serif', fontSize: '11px', padding: '2px' }}>
                            <strong style={{ color: '#dc2626', display: 'block', textTransform: 'uppercase', fontSize: '10px' }}>🔴 Drop Destination (B)</strong>
                            <span>{dropLocation}</span>
                          </div>
                        </Popup>
                      </Marker>
                    )}

                    {/* Live Vehicle Marker */}
                    <Marker position={[gpsCoords.lat, gpsCoords.lng]} icon={userIcon} />

                    {/* Dynamic Auto-Fit & Follow View Controller */}
                    <MapController 
                      waypoints={routeWaypoints} 
                      gpsCoords={gpsCoords} 
                      mode={mapMode} 
                    />
                  </MapContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-surface-container/30">
                    <span className="text-xs text-on-surface-variant animate-pulse">Acquiring GPS Signal...</span>
                  </div>
                )}
                
                {/* Floating Status Indicator */}
                <div className="absolute top-3 left-3 glass-card px-3 py-1.5 rounded-full flex items-center gap-2 border-white/10" style={{ zIndex: 1000 }}>
                  <span className={`w-2 h-2 rounded-full ${
                    hasReachedDestination 
                      ? 'bg-secondary animate-pulse shadow-[0_0_8px_rgba(162,201,255,0.8)]' 
                      : showAlert 
                        ? 'bg-primary animate-ping shadow-[0_0_8px_rgba(255,84,76,0.8)]' 
                        : isDriving 
                          ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' 
                          : 'bg-amber-400'
                  }`} />
                  <span className="text-[9px] font-black text-white uppercase tracking-widest font-sans">
                    {hasReachedDestination ? 'Destination Reached' : showAlert ? 'Route Deviation detected' : isDriving ? 'Driving Simulation' : 'Ready at Pickup (A)'}
                  </span>
                </div>

                {/* Map View Mode Toggle: Fit Route vs Follow Vehicle */}
                <div className="absolute top-3 right-3 glass-card p-0.5 rounded-lg flex items-center gap-1 border-white/10" style={{ zIndex: 1000 }}>
                  <button
                    type="button"
                    onClick={() => setMapMode('fit')}
                    className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      mapMode === 'fit' ? 'bg-secondary text-[#0a192f] shadow-sm' : 'text-on-surface-variant hover:text-white'
                    }`}
                    title="Fit entire route between Start and Destination"
                  >
                    Route
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapMode('follow')}
                    className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      mapMode === 'follow' ? 'bg-secondary text-[#0a192f] shadow-sm' : 'text-on-surface-variant hover:text-white'
                    }`}
                    title="Focus and follow vehicle position"
                  >
                    Follow
                  </button>
                </div>

                {/* Map Layer Switcher: Tactical Dark vs Street vs Satellite */}
                <div className="absolute bottom-3 right-3 glass-card p-0.5 rounded-lg flex items-center gap-0.5 border-white/10" style={{ zIndex: 1000 }}>
                  <button
                    type="button"
                    onClick={() => setMapLayer('dark')}
                    className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      mapLayer === 'dark' ? 'bg-emerald-500 text-white font-black shadow-sm' : 'text-on-surface-variant hover:text-white'
                    }`}
                    title="Tactical Dark Map (Same as Police Dashboard)"
                  >
                    Tactical (Police)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapLayer('standard')}
                    className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      mapLayer === 'standard' ? 'bg-secondary text-[#0a192f] shadow-sm' : 'text-on-surface-variant hover:text-white'
                    }`}
                    title="Standard OSM Street View"
                  >
                    Street
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapLayer('satellite')}
                    className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      mapLayer === 'satellite' ? 'bg-secondary text-[#0a192f] shadow-sm' : 'text-on-surface-variant hover:text-white'
                    }`}
                    title="Satellite Recon with Roads"
                  >
                    Sat
                  </button>
                </div>

                {/* Live GPS coordinates */}
                <div className="absolute bottom-3 left-3 glass-card px-2.5 py-1 rounded-full flex items-center gap-1.5 border-white/10" style={{ zIndex: 1000 }}>
                  <MapPin className="w-3 h-3 text-secondary" />
                  <span className="text-[9px] font-mono font-bold text-white">
                    {gpsCoords 
                      ? `${gpsCoords.lat.toFixed(4)}°, ${gpsCoords.lng.toFixed(4)}°`
                      : 'Acquiring GPS...'}
                  </span>
                </div>
              </section>

              {/* Simulation Drive Controller (User Controls When & How Fast to Drive) */}
              <div className="glass-card rounded-2xl p-3 border border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (hasReachedDestination) {
                        setCurrentPathIndex(0);
                        if (simulationPath.length > 0) {
                          setGpsCoords(simulationPath[0]);
                        }
                        setHasReachedDestination(false);
                        setIsDriving(true);
                      } else {
                        setIsDriving(!isDriving);
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
                      isDriving 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30' 
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                    }`}
                  >
                    {isDriving ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-amber-300" />
                        <span>Pause Simulation</span>
                      </>
                    ) : hasReachedDestination ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Replay Trip</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                        <span>Start Driving</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDriving(false);
                      setCurrentPathIndex(0);
                      if (simulationPath.length > 0) {
                        setGpsCoords(simulationPath[0]);
                      }
                      setHasReachedDestination(false);
                    }}
                    className="p-2 rounded-xl glass-card hover:bg-white/10 text-on-surface-variant text-xs border border-white/5 active:scale-95 transition-all cursor-pointer"
                    title="Reset vehicle back to Pickup Point (A)"
                  >
                    <RotateCcw className="w-4 h-4 text-secondary" />
                  </button>
                </div>

                {/* Speed Multiplier Pill */}
                <div className="flex items-center gap-1 bg-surface-container-high/60 p-1 rounded-xl border border-white/5 text-[10px] font-mono font-bold">
                  <span className="text-[9px] text-on-surface-variant/60 uppercase px-1 font-sans">Speed:</span>
                  {[1, 2, 4].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setSimSpeed(spd)}
                      className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                        simSpeed === spd 
                          ? 'bg-primary text-surface-container-lowest font-black shadow-sm' 
                          : 'text-on-surface-variant hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Real Trip Status Card Grid */}
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
                    {hasReachedDestination ? '0.0' : distanceRemaining.toFixed(1)} <span className="text-xs font-bold text-on-surface-variant">km</span>
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

                {/* Location Route Timeline */}
                <div className="pt-4 border-t border-outline-variant/20 space-y-3.5 relative pl-6 z-10">
                  <div className="absolute left-[9px] top-6.5 bottom-6.5 w-0.5 border-l border-dashed border-white/15" />
                  
                  <div className="relative flex items-start gap-3.5 text-xs text-on-surface-variant">
                    <div className="absolute -left-[20px] top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest">Pickup point (A)</span>
                      <span className="text-white/90 font-bold text-[11px] mt-0.5 truncate max-w-[210px]">{pickupLocation}</span>
                    </div>
                  </div>
                  
                  <div className="relative flex items-start gap-3.5 text-xs text-on-surface-variant">
                    <div className="absolute -left-[20px] top-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-rose-400 uppercase tracking-widest">Drop destination (B)</span>
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

                {/* Deviation Testing Controls */}
                {!hasReachedDestination && (
                  <div>
                    {!isVeeringOff ? (
                      <button
                        type="button"
                        onClick={handleSimulateDeviation}
                        className="w-full h-11 border border-yellow-500/30 text-yellow-400 bg-yellow-500/[0.04] hover:bg-yellow-500/[0.08] rounded-xl font-bold text-[11px] uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                        title="Diverges the simulation path off-route to test genuine geometric deviation detection"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>Simulate Route Deviation (Test Anomaly)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRejoinRoute}
                        className="w-full h-11 border border-secondary/30 text-secondary bg-secondary/[0.04] hover:bg-secondary/[0.08] rounded-xl font-bold text-[11px] uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                        title="Recalculates route back to planned destination"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Rejoin Planned Route</span>
                      </button>
                    )}
                  </div>
                )}

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
