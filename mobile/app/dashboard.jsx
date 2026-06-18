import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { session } from './index.jsx';

// Components & Services imports
import SOSButton from '../components/SOSButton.jsx';
import StatusIndicator from '../components/StatusIndicator.jsx';
import AlertBanner from '../components/AlertBanner.jsx';
import LocationService from '../services/locationService.js';
import AudioDetection from '../services/audioDetection.js';
import MotionDetection from '../services/motionDetection.js';
import { socketService } from '../services/socketService.js';

const BACKEND_URL = 'http://localhost:5000/api';

export default function Dashboard() {
  const router = useRouter();
  const [status, setStatus] = useState('monitoring'); // safe, monitoring, threat
  const [coords, setCoords] = useState(null);
  const [riskScore, setRiskScore] = useState(0);
  const [activeIncident, setActiveIncident] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const gpsIntervalRef = useRef(null);

  useEffect(() => {
    // 1. Fetch initial location
    syncCurrentLocation();

    // 2. Start background sensors stubs
    AudioDetection.startListening(handleAudioTrigger);
    MotionDetection.startFallDetection(handleFallTrigger);

    // 3. Connect to WebSockets and bind status events
    const socket = socketService.connect();
    setIsConnected(socket.connected);

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('incidentResolved', ({ incidentId }) => {
      if (activeIncident && activeIncident.id === incidentId) {
        handleResetAlertState();
      }
    });

    return () => {
      AudioDetection.stopListening();
      MotionDetection.stopFallDetection();
      clearInterval(gpsIntervalRef.current);
      socketService.disconnect();
    };
  }, [activeIncident]);

  const syncCurrentLocation = async () => {
    const loc = await LocationService.getCurrentLocation();
    setCoords(loc);
    return loc;
  };

  const handleAudioTrigger = async (result) => {
    if (status === 'threat') return;
    console.log('[DASHBOARD] Acoustic distress audio matching.');
    triggerSOSEvent('audio', result.confidence, result.transcript);
  };

  const handleFallTrigger = async (result) => {
    if (status === 'threat') return;
    console.log('[DASHBOARD] Fall sensor decel matching.');
    triggerSOSEvent('motion', result.confidence, 'Fall sensor impact detected.');
  };

  const handleManualSOS = () => {
    if (status === 'threat') {
      Alert.alert('SOS Active', 'Real-time GPS updates are currently streaming to dispatch stations.');
      return;
    }
    triggerSOSEvent('manual', 92, 'Manual trigger button long pressed.');
  };

  const triggerSOSEvent = async (triggerType, baseRisk, transcript = '') => {
    setStatus('threat');
    setRiskScore(baseRisk);
    
    const freshCoords = await syncCurrentLocation();

    try {
      const token = session.token;
      const res = await axios.post(
        `${BACKEND_URL}/alerts/sos`,
        {
          latitude: freshCoords.latitude,
          longitude: freshCoords.longitude,
          triggerType,
          riskScore: baseRisk,
          audioTranscript: transcript
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const incident = res.data.incident;
      setActiveIncident(incident);

      // Connect to websocket incident tracking room
      socketService.joinIncidentRoom(incident.id);

      // Stream live GPS updates every 3.5 seconds
      gpsIntervalRef.current = setInterval(async () => {
        const updatedCoords = await LocationService.getCurrentLocation();
        setCoords(updatedCoords);

        const mockVaryScore = Math.min(Math.max(baseRisk + Math.round((Math.random() - 0.5) * 8), 0), 100);
        setRiskScore(mockVaryScore);

        // Emit coordinates update via socket
        socketService.sendLocationUpdate({
          incidentId: incident.id,
          latitude: updatedCoords.latitude,
          longitude: updatedCoords.longitude,
          riskScore: mockVaryScore
        });
      }, 3500);

      Alert.alert('Protocol Initiated', 'SOS dispatched. Emergency contacts have been informed.');
    } catch (err) {
      console.error('[DASHBOARD] Trigger SOS event error:', err.response?.data || err.message);
      setStatus('monitoring');
    }
  };

  const handleResetAlertState = () => {
    setStatus('monitoring');
    setRiskScore(0);
    setActiveIncident(null);
    clearInterval(gpsIntervalRef.current);
    gpsIntervalRef.current = null;
    Alert.alert('Incident Resolved', 'Safety dispatch center has closed the emergency session.');
  };

  const contactCount = session.user?.emergencyContacts?.length || 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.salutation}>Hello, {session.user?.name || 'User'}</Text>
          <Text style={styles.subText}>ARIA Guardian Shield is monitoring.</Text>
        </View>
        <TouchableOpacity 
          onPress={() => router.push('/profile')}
          style={styles.profileBtn}
        >
          <Text style={styles.profileBtnText}>Profile</Text>
        </TouchableOpacity>
      </View>

      <StatusIndicator status={status} />

      {/* SOS Center Trigger */}
      <SOSButton onPress={handleManualSOS} />

      {status === 'threat' && (
        <AlertBanner riskScore={riskScore} coords={coords} />
      )}

      {/* Location Details telemetry */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Device Telemetry</Text>
        <View style={styles.row}>
          <Text style={styles.label}>GPS Latitude</Text>
          <Text style={styles.val}>{coords ? coords.latitude.toFixed(6) : 'Resolving...'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>GPS Longitude</Text>
          <Text style={styles.val}>{coords ? coords.longitude.toFixed(6) : 'Resolving...'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Backup Contacts Alerted</Text>
          <Text style={styles.val}>{contactCount} active</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Connection Status</Text>
          <Text style={[styles.val, { color: isConnected ? '#10b981' : '#ef4444' }]}>
            {isConnected ? 'CONNECTED' : 'OFFLINE'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Last Incident ID</Text>
          <Text style={styles.val}>{activeIncident ? activeIncident.id : 'None'}</Text>
        </View>
      </View>

      {/* Manual Simulations for Demo Testing */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Incident Simulator Controls</Text>
        <Text style={styles.simDescription}>
          Simulate background hardware and voice triggers to demo platform features.
        </Text>
        
        <View style={styles.btnRow}>
          <TouchableOpacity 
            style={[styles.simBtn, { backgroundColor: '#3b82f6' }]} 
            onPress={() => handleAudioTrigger(AudioDetection.mockDistressDetection())}
          >
            <Text style={styles.simBtnText}>Audio Threat</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.simBtn, { backgroundColor: '#f59e0b' }]} 
            onPress={() => handleFallTrigger(MotionDetection.mockFallDetection())}
          >
            <Text style={styles.simBtnText}>Fall Impact</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#0b0f19',
    flexGrow: 1,
    paddingTop: 48,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  salutation: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  subText: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'System',
  },
  profileBtn: {
    backgroundColor: '#161d30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2b395b',
  },
  profileBtnText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 12,
    fontFamily: 'System',
  },
  card: {
    backgroundColor: '#161d30',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2b395b',
    marginVertical: 10,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2b395b',
    paddingBottom: 6,
    fontFamily: 'System',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  label: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: 'System',
  },
  val: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  simDescription: {
    color: '#9ca3af',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 12,
    fontFamily: 'System',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  simBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  simBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
    fontFamily: 'System',
  },
});
