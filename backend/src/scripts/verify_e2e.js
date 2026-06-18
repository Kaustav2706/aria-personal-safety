import axios from 'axios';
import io from 'socket.io-client';

const BACKEND_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

async function testE2E() {
  console.log('\n==========================================');
  console.log('🏁 STARTING E2E RUNTIME FLOW VALIDATION');
  console.log('==========================================\n');

  let token = null;
  let userId = null;
  let incidentId = null;

  // Setup client Socket.io listener to verify global broadcasts
  const socket = io(SOCKET_URL);
  
  socket.on('connect', () => {
    console.log('🔌 [SOCKET.IO] Connected. Dashboard socket is listening for broadcasts...');
  });

  socket.on('incidentCreated', (data) => {
    console.log('📣 [SOCKET.IO BROADCAST RECEIVED] incidentCreated event:');
    console.log(`   - Incident ID: ${data.id}`);
    console.log(`   - Risk Rating: ${data.riskScore}%`);
    console.log(`   - Coords: ${data.latitude}, ${data.longitude}`);
    console.log(`   - Transcript: "${data.audioTranscript}"`);
  });

  socket.on('locationUpdate', (data) => {
    console.log('📍 [SOCKET.IO BROADCAST RECEIVED] locationUpdate coordinates:');
    console.log(`   - Lat: ${data.latitude}, Lon: ${data.longitude} | Risk: ${data.riskScore}%`);
  });

  socket.on('incidentResolved', (data) => {
    console.log('✅ [SOCKET.IO BROADCAST RECEIVED] incidentResolved event:');
    console.log(`   - Resolved ID: ${data.incidentId}`);
  });

  // Give socket 1.5 seconds to establish connection
  await new Promise(resolve => setTimeout(resolve, 1500));

  try {
    // Stage 1: Register User
    console.log('➡️ STAGE 1: Registering user account...');
    const registerRes = await axios.post(`${BACKEND_URL}/auth/register`, {
      name: 'Simulated Victim',
      email: `victim_${Math.floor(Math.random() * 1000)}@example.com`,
      phone: '+919988776655',
      password: 'password123',
      emergencyContacts: [
        { name: 'Backup Contact A', phone: '+919876543210' }
      ]
    });
    
    token = registerRes.data.token;
    userId = registerRes.data.user.id;
    console.log(`   [SUCCESS] Account registered. User ID: ${userId}`);
    console.log(`   [JWT TOKEN RECEIVED]: ${token.substring(0, 25)}...`);

    // Stage 2: Fetch profile
    console.log('\n➡️ STAGE 2: Querying profile metadata...');
    const profileRes = await axios.get(`${BACKEND_URL}/user/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   [SUCCESS] Profile retrieved: Name: ${profileRes.data.user.name} | Emergency Contacts Count: ${profileRes.data.user.emergencyContacts.length}`);

    // Stage 3: Create Incident & Invoke AI Engine
    console.log('\n➡️ STAGE 3: Simulating SOS event with distress audio upload...');
    
    // We create a mock file upload by constructing standard FormData
    // Since we are uploading a file to trigger FastAPI analyze workflow
    const formData = new FormData();
    const mockFileContent = Buffer.from('mock audio file content representing HELP ME PLEASE');
    const audioBlob = new Blob([mockFileContent], { type: 'audio/wav' });
    
    formData.append('file', audioBlob, 'distress_help_alert.wav');
    formData.append('latitude', '28.6139');
    formData.append('longitude', '77.2090');
    formData.append('triggerType', 'audio');
    formData.append('isIsolated', 'true');

    const incidentRes = await axios.post(`${BACKEND_URL}/incidents/create`, formData, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });

    const incident = incidentRes.data.incident;
    incidentId = incident.id;
    console.log(`   [SUCCESS] Incident Created: ${incidentId}`);
    console.log(`   [AI EVALUATION RESULTS]:`);
    console.log(`      - Speech Transcript: "${incident.audioTranscript}"`);
    console.log(`      - Cumulative Risk Score: ${incident.riskScore}/100`);
    console.log(`      - GPS Coordinates: ${incident.latitude}, ${incident.longitude}`);

    // Wait 1.5 seconds for socket broadcasts to log
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Stage 4: Live Coordinates stream update
    console.log('\n➡️ STAGE 4: Streaming updated GPS tracker coordinates...');
    const trackerRes = await axios.post(`${BACKEND_URL}/location/update`, {
      incidentId,
      latitude: 28.6145,
      longitude: 77.2102,
      riskScore: 94
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   [SUCCESS] GPS Track coordinate logged: Lat ${trackerRes.data.incident.latitude}, Lng ${trackerRes.data.incident.longitude}`);

    // Wait 1.5 seconds for socket broadcasts to log
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Stage 5: PDF Report generation
    console.log('\n➡️ STAGE 5: Generating PDF incident dossier report...');
    const reportRes = await axios.post(`${BACKEND_URL}/incidents/report/generate`, {
      incidentId
    });
    console.log(`   [SUCCESS] PDF dossier compiled. Download Link: ${reportRes.data.reportUrl}`);

    // Stage 6: Incident Resolution
    console.log('\n➡️ STAGE 6: Dispatcher resolves active safety incident...');
    const resolveRes = await axios.put(`${BACKEND_URL}/incidents/${incidentId}/resolve`);
    console.log(`   [SUCCESS] Incident status closed: Status is now ${resolveRes.data.incident.status}`);

    // Wait 1.5 seconds for socket broadcasts to log
    await new Promise(resolve => setTimeout(resolve, 1500));

  } catch (err) {
    console.error('🔴 E2E FLOW RUNTIME ERROR ENCOUNTERED:', err.response?.data || err.message);
  } finally {
    socket.disconnect();
    console.log('\n==========================================');
    console.log('🏁 E2E RUNTIME FLOW VALIDATION COMPLETE');
    console.log('==========================================\n');
  }
}

testE2E();
