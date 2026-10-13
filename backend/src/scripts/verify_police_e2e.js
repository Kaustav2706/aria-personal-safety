import axios from 'axios';
import io from 'socket.io-client';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

function pass(name, detail = '') {
  console.log(`  \x1b[32m✔ PASS\x1b[0m [${name}] ${detail}`);
}

function fail(name, detail = '') {
  console.error(`  \x1b[31m✘ FAIL\x1b[0m [${name}] ${detail}`);
  throw new Error(`Test failed: ${name}`);
}

async function runPoliceE2E() {
  console.log('\n======================================================');
  console.log('🚨 ARIA POLICE DASHBOARD & END-TO-END VERIFICATION');
  console.log('======================================================\n');

  // 1. Health check
  console.log('1️⃣ Checking backend health...');
  const healthRes = await axios.get('http://localhost:5000/health');
  if (healthRes.data?.status === 'ONLINE') {
    pass('Backend Health Check', `Status: ${healthRes.data.status}, dbMode: ${healthRes.data.dbMode}`);
  } else {
    fail('Backend Health Check', JSON.stringify(healthRes.data));
  }

  // 2. Register & Authenticate Police Officer
  console.log('\n2️⃣ Registering & Authenticating Police Dispatcher...');
  const officerEmail = `officer_${Date.now()}@police.gov.in`;
  const officerPassword = 'PoliceSecure@2026!';

  const regOfficerRes = await axios.post(`${API_BASE}/auth/register`, {
    name: 'Inspector Vikram Rao',
    email: officerEmail,
    phone: '+919876543210',
    password: officerPassword,
    role: 'police'
  });

  const officerToken = regOfficerRes.data.token;
  const officerId = regOfficerRes.data.user.id;
  if (regOfficerRes.data.user.role === 'police' && officerToken) {
    pass('Officer Registration', `Role: ${regOfficerRes.data.user.role}, ID: ${officerId}`);
  } else {
    fail('Officer Registration', JSON.stringify(regOfficerRes.data));
  }

  // Verify login endpoint
  const loginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: officerEmail,
    password: officerPassword
  });
  if (loginRes.data.user.role === 'police' && loginRes.data.token) {
    pass('Officer Login', `Authenticated successfully via /auth/login`);
  } else {
    fail('Officer Login', JSON.stringify(loginRes.data));
  }

  // 3. Register regular citizen user
  console.log('\n3️⃣ Registering Citizen User...');
  const userEmail = `citizen_${Date.now()}@aria.test`;
  const userPassword = 'CitizenSecure@2026!';
  const regUserRes = await axios.post(`${API_BASE}/auth/register`, {
    name: 'Ananya Sharma',
    email: userEmail,
    phone: '+919988776655',
    password: userPassword,
    role: 'user',
    emergencyContacts: [
      { name: 'Dr. Priya Sharma', phone: '+919876543210' }
    ]
  });
  const userToken = regUserRes.data.token;
  const userId = regUserRes.data.user.id;
  pass('User Registration', `ID: ${userId}, Role: ${regUserRes.data.user.role}`);

  // 4. Verify RBAC Security: regular user MUST be rejected from police endpoints
  console.log('\n4️⃣ Verifying Role-Based Access Control (RBAC)...');
  try {
    await axios.get(`${API_BASE}/police/incidents`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    fail('RBAC Enforcement', 'Regular user was not rejected from /api/police/incidents');
  } catch (err) {
    if (err.response?.status === 403) {
      pass('RBAC Enforcement', 'Regular user correctly rejected with 403 Forbidden');
    } else {
      fail('RBAC Enforcement', `Unexpected status: ${err.response?.status}`);
    }
  }

  // 5. Connect Police Dispatcher Socket with Handshake Token
  console.log('\n5️⃣ Connecting Police Dispatcher Socket...');
  let policeSocketConnected = false;
  let dispatcherRoomAcked = false;
  let receivedIncidentCreated = null;
  let receivedLocationUpdate = null;
  let receivedIncidentResolved = null;

  const policeSocket = io(SOCKET_URL, {
    reconnection: true,
    reconnectionAttempts: 10,
    auth: { token: officerToken }
  });

  policeSocket.on('connect', () => {
    policeSocketConnected = true;
    policeSocket.emit('registerDispatcher', {}, (res) => {
      if (res?.success) {
        dispatcherRoomAcked = true;
      }
    });
  });

  policeSocket.on('incidentCreated', (data) => {
    receivedIncidentCreated = data;
  });

  policeSocket.on('globalLocationUpdate', (data) => {
    receivedLocationUpdate = data;
  });

  policeSocket.on('incidentResolved', (data) => {
    receivedIncidentResolved = data;
  });

  // Connect user socket for live GPS tracking stream
  const userSocket = io(SOCKET_URL, {
    reconnection: true,
    auth: { token: userToken }
  });

  await new Promise(r => setTimeout(r, 1200));

  if (policeSocketConnected) {
    pass('Police Socket Connection', `Socket ID: ${policeSocket.id}`);
  } else {
    fail('Police Socket Connection', 'Failed to connect');
  }

  if (dispatcherRoomAcked) {
    pass('Dispatcher Room Registration', `Joined 'dispatchers' room with server acknowledgement`);
  } else {
    fail('Dispatcher Room Registration', 'Server did not ack dispatcher registration');
  }

  // 6. Citizen User Triggers Critical SOS
  console.log('\n6️⃣ Triggering Citizen SOS Incident...');
  const sosRes = await axios.post(`${API_BASE}/alerts/sos`, {
    latitude: 28.5355,
    longitude: 77.3910,
    riskScore: 92,
    audioTranscript: 'Bachao! Mujhe bachao, koi mera peecha kar raha hai!'
  }, {
    headers: { Authorization: `Bearer ${userToken}` }
  });

  const incident = sosRes.data.incident;
  const incidentId = incident.id;
  pass('SOS Incident Creation', `Incident ID: ${incidentId}, Risk: ${incident.riskScore}%`);

  // Wait for broadcast propagation
  await new Promise(r => setTimeout(r, 1200));

  if (receivedIncidentCreated && receivedIncidentCreated.id === incidentId) {
    pass('Real-time Incident Broadcast to Police', `Received incidentCreated for ID: ${incidentId}`);
  } else {
    fail('Real-time Incident Broadcast to Police', `Police socket did not receive incidentCreated. received: ${JSON.stringify(receivedIncidentCreated)}`);
  }

  // 7. Police Dispatcher Queries Active Incidents
  console.log('\n7️⃣ Querying Incidents as Police Dispatcher...');
  const policeListRes = await axios.get(`${API_BASE}/police/incidents`, {
    headers: { Authorization: `Bearer ${officerToken}` }
  });

  const foundIncident = (policeListRes.data.incidents || []).find(i => i.id === incidentId);
  if (foundIncident) {
    pass('Police Incidents List Query', `Incident found in dispatcher list with user: ${foundIncident.userName}`);
  } else {
    fail('Police Incidents List Query', `Incident ${incidentId} not found in dispatcher list`);
  }

  // 8. Stream GPS Location Updates from Citizen
  console.log('\n8️⃣ Streaming Real-time GPS Location from Citizen...');
  let locUpdateAck = false;
  await new Promise((resolve) => {
    userSocket.emit('locationUpdate', {
      incidentId,
      latitude: 28.5360,
      longitude: 77.3915
    }, (res) => {
      locUpdateAck = res?.success;
      resolve();
    });
  });

  await new Promise(r => setTimeout(r, 1000));

  if (locUpdateAck) {
    pass('User GPS Update Submission', 'Server accepted new GPS coordinates');
  } else {
    fail('User GPS Update Submission', 'Server rejected GPS coordinates');
  }

  if (receivedLocationUpdate && receivedLocationUpdate.incidentId === incidentId) {
    pass('Police Live GPS Reception', `Dispatcher received globalLocationUpdate: (${receivedLocationUpdate.latitude}, ${receivedLocationUpdate.longitude})`);
  } else {
    fail('Police Live GPS Reception', `Dispatcher did not receive globalLocationUpdate`);
  }

  // 9. Dispatcher Views Incident Detail & Audit Log Recording
  console.log('\n9️⃣ Officer Views Incident & Generates Official Dossier...');
  const detailRes = await axios.get(`${API_BASE}/police/incidents/${incidentId}`, {
    headers: { Authorization: `Bearer ${officerToken}` }
  });

  if (detailRes.data?.incident?.id === incidentId && detailRes.data?.user?.name === 'Ananya Sharma') {
    pass('Police Incident Detail Access', `Retrieved full case profile for ${detailRes.data.user.name}`);
  } else {
    fail('Police Incident Detail Access', JSON.stringify(detailRes.data));
  }

  const reportRes = await axios.post(`${API_BASE}/police/report/generate`, {
    incidentId
  }, {
    headers: { Authorization: `Bearer ${officerToken}` }
  });

  if (reportRes.data?.success && reportRes.data?.reportUrl) {
    pass('Police Dossier Generation', `Report generated: ${reportRes.data.reportUrl}`);
  } else {
    fail('Police Dossier Generation', JSON.stringify(reportRes.data));
  }

  // 10. Dispatcher Resolves Incident
  console.log('\n🔟 Dispatcher Resolves Incident...');
  const resolveRes = await axios.put(`${API_BASE}/police/incidents/${incidentId}/resolve`, {}, {
    headers: { Authorization: `Bearer ${officerToken}` }
  });

  if (resolveRes.data?.incident?.status === 'resolved') {
    pass('Police Incident Resolution', `Incident ${incidentId} marked as resolved`);
  } else {
    fail('Police Incident Resolution', JSON.stringify(resolveRes.data));
  }

  await new Promise(r => setTimeout(r, 1000));

  if (receivedIncidentResolved && receivedIncidentResolved.incidentId === incidentId) {
    pass('Real-time Resolution Broadcast', `Police socket received incidentResolved event`);
  } else {
    fail('Real-time Resolution Broadcast', 'Police socket did not receive incidentResolved');
  }

  // 11. Dispatcher Checks Immutable Audit Log Trail
  console.log('\n1️⃣1️⃣ Checking Audit Trail...');
  const auditRes = await axios.get(`${API_BASE}/police/audit?incidentId=${incidentId}`, {
    headers: { Authorization: `Bearer ${officerToken}` }
  });

  const auditActions = (auditRes.data.auditLogs || auditRes.data.logs || []).map(l => l.action);
  if (auditActions.includes('viewed') && auditActions.includes('resolved')) {
    pass('Immutable Audit Trail', `Recorded dispatcher actions: ${auditActions.join(', ')}`);
  } else {
    fail('Immutable Audit Trail', `Missing audit actions. Found: ${auditActions.join(', ')}`);
  }

  // Cleanup
  policeSocket.disconnect();
  userSocket.disconnect();

  console.log('\n======================================================');
  console.log('🎉 ALL POLICE DASHBOARD & SOS VERIFICATION TESTS PASSED');
  console.log('======================================================\n');
}

runPoliceE2E().catch((err) => {
  console.error('\n❌ POLICE E2E VERIFICATION FAILED:', err.message);
  process.exit(1);
});
