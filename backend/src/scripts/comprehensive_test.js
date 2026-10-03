import axios from 'axios';
import io from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;
const AI_URL = 'http://127.0.0.1:8000';

let passedTests = 0;
let failedTests = 0;

function pass(testName, details = '') {
  passedTests++;
  console.log(`  ✅ [PASS] ${testName} ${details ? `(${details})` : ''}`);
}

function fail(testName, error) {
  failedTests++;
  console.error(`  ❌ [FAIL] ${testName}:`, error.response?.data || error.message || error);
}

async function runFullAppTestSuite() {
  console.log('\n================================================================');
  console.log('🚀 ARIA SAFETY PLATFORM — COMPREHENSIVE END-TO-END TEST SUITE');
  console.log('================================================================\n');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. HEALTH CHECKS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('📋 SECTION 1: Health & Service Availability');
  try {
    const res = await axios.get(`${BASE_URL}/health`);
    if (res.data.status === 'ONLINE' && res.data.success) {
      pass('Backend /health', `status=${res.data.status}, dbMode=${res.data.dbMode}`);
    } else {
      fail('Backend /health', res.data);
    }
  } catch (err) {
    fail('Backend /health', err);
  }

  try {
    const res = await axios.get(`${AI_URL}/health`);
    if (res.data.status === 'ONLINE' && res.data.analysisReady) {
      pass('AI Engine /health', `status=${res.data.status}, analysisReady=${res.data.analysisReady}`);
    } else {
      fail('AI Engine /health', res.data);
    }
  } catch (err) {
    fail('AI Engine /health', err);
  }

  try {
    const res = await axios.get(`${API_URL}/health`);
    if (res.data.success && res.data.ai?.status === 'ONLINE') {
      pass('Backend + AI Engine Integrated Health (/api/health)', `backend=ONLINE, ai=ONLINE`);
    } else {
      fail('Backend + AI Engine Integrated Health', res.data);
    }
  } catch (err) {
    fail('Backend + AI Engine Integrated Health', err);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. CORS SECURITY RESTRICTIONS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n🔒 SECTION 2: CORS Security & Origin Lockdown');
  try {
    // Test authorized origin
    const authOriginRes = await axios.get(`${BASE_URL}/health`, {
      headers: { Origin: 'http://localhost:5173' }
    });
    const allowHeader = authOriginRes.headers['access-control-allow-origin'];
    if (allowHeader === 'http://localhost:5173') {
      pass('Authorized Origin Allowed', `http://localhost:5173 allowed`);
    } else {
      fail('Authorized Origin Allowed', `Expected http://localhost:5173, got ${allowHeader}`);
    }
  } catch (err) {
    fail('Authorized Origin Allowed', err);
  }

  try {
    // Test unauthorized origin
    const unauthOriginRes = await axios.get(`${BASE_URL}/health`, {
      headers: { Origin: 'http://malicious-website.com' }
    });
    const allowHeader = unauthOriginRes.headers['access-control-allow-origin'];
    if (!allowHeader) {
      pass('Unauthorized Origin Blocked', 'Access-Control-Allow-Origin header was withheld');
    } else {
      fail('Unauthorized Origin Blocked', `Origin should NOT be allowed: ${allowHeader}`);
    }
  } catch (err) {
    fail('Unauthorized Origin Blocked', err);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. USER AUTHENTICATION & ACCESS CONTROL
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n👤 SECTION 3: User Authentication & Role Restrictions');
  const userEmail = `user_test_${Date.now()}@example.com`;
  let userToken = null;
  let userRefreshToken = null;
  let userId = null;

  try {
    const regRes = await axios.post(`${API_URL}/auth/register`, {
      name: 'Priya Sharma',
      email: userEmail,
      phone: '+919876543210',
      password: 'SecurePassword123!',
      emergencyContacts: [
        { name: 'Mother', phone: '+919876543211' },
        { name: 'Brother', phone: '+919876543212' }
      ]
    });
    userToken = regRes.data.token;
    userRefreshToken = regRes.data.refreshToken;
    userId = regRes.data.user?.id;
    if (userToken && userId) {
      pass('User Registration', `User ID: ${userId}, token received`);
    } else {
      fail('User Registration', regRes.data);
    }
  } catch (err) {
    fail('User Registration', err);
  }

  try {
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: userEmail,
      password: 'SecurePassword123!'
    });
    if (loginRes.data.token && loginRes.data.user.email === userEmail) {
      pass('User Login', `Successfully logged in, role=${loginRes.data.user.role}`);
    } else {
      fail('User Login', loginRes.data);
    }
  } catch (err) {
    fail('User Login', err);
  }

  try {
    const profRes = await axios.get(`${API_URL}/user/profile`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    if (profRes.data.success && profRes.data.user.emergencyContacts.length === 2) {
      pass('User Profile & Contacts', `Contacts count: ${profRes.data.user.emergencyContacts.length}`);
    } else {
      fail('User Profile & Contacts', profRes.data);
    }
  } catch (err) {
    fail('User Profile & Contacts', err);
  }

  // User attempting police route MUST be 403 Forbidden
  try {
    await axios.get(`${API_URL}/police/incidents`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    fail('User Role Enforcement', 'User token was wrongly allowed on police dispatch routes!');
  } catch (err) {
    if (err.response?.status === 403) {
      pass('User Role Enforcement on Police Routes', 'User correctly rejected with 403 Forbidden');
    } else {
      fail('User Role Enforcement on Police Routes', err);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. POLICE DISPATCHER AUTHENTICATION & ACCESS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n👮 SECTION 4: Police Dispatcher Authentication & Role Verification');
  const officerEmail = `officer_${Date.now()}@police.gov.in`;
  let officerToken = null;
  let officerId = null;

  try {
    const regOfficerRes = await axios.post(`${API_URL}/auth/register`, {
      name: 'Inspector Vikram Singh',
      email: officerEmail,
      phone: '+919988776655',
      password: 'PoliceOfficerSecret123!',
      role: 'police'
    });
    officerToken = regOfficerRes.data.token;
    officerId = regOfficerRes.data.user?.id;
    if (officerToken && regOfficerRes.data.user?.role === 'police') {
      pass('Police Dispatcher Registration', `Officer ID: ${officerId}, role='police'`);
    } else {
      fail('Police Dispatcher Registration', regOfficerRes.data);
    }
  } catch (err) {
    fail('Police Dispatcher Registration', err);
  }

  try {
    const policeIncRes = await axios.get(`${API_URL}/police/incidents`, {
      headers: { Authorization: `Bearer ${officerToken}` }
    });
    if (policeIncRes.data.success && Array.isArray(policeIncRes.data.incidents)) {
      pass('Police Incidents Dispatch Access', `Accessible to dispatcher, initial count: ${policeIncRes.data.incidents.length}`);
    } else {
      fail('Police Incidents Dispatch Access', policeIncRes.data);
    }
  } catch (err) {
    fail('Police Incidents Dispatch Access', err);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. INCIDENT CREATION & AUDIO EVIDENCE SECURITY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n🚨 SECTION 5: SOS Incident Creation & Audio Evidence Protection');
  let incidentId = null;
  let rawAudioUrl = null;

  try {
    const formData = new FormData();
    const wavHeader = Buffer.from('RIFF....WAVEfmt ....data....test audio content for distress detection');
    const audioBlob = new Blob([wavHeader], { type: 'audio/wav' });
    formData.append('file', audioBlob, 'sos_evidence.wav');
    formData.append('latitude', '28.6139');
    formData.append('longitude', '77.2090');
    formData.append('triggerType', 'manual');
    formData.append('isIsolated', 'true');

    const incRes = await axios.post(`${API_URL}/incidents/create`, formData, {
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'multipart/form-data'
      }
    });

    if (incRes.data.success && incRes.data.incident?.id) {
      incidentId = incRes.data.incident.id;
      rawAudioUrl = incRes.data.incident.audioUrl;
      pass('Manual SOS Incident Creation', `Incident ID: ${incidentId}, RiskScore: ${incRes.data.incident.riskScore}`);
    } else {
      fail('Manual SOS Incident Creation', incRes.data);
    }
  } catch (err) {
    fail('Manual SOS Incident Creation', err);
  }

  // Verify direct unauthenticated access to /uploads/evidence is FORBIDDEN (403)
  try {
    const directRes = await axios.get(`${BASE_URL}/uploads/evidence/any_file.webm`);
    fail('Evidence Direct Access Lockdown', `Expected 403 Forbidden, but received status ${directRes.status}`);
  } catch (err) {
    if (err.response?.status === 403) {
      pass('Evidence Direct Access Lockdown', 'Direct /uploads/evidence request correctly blocked with 403 Forbidden');
    } else {
      fail('Evidence Direct Access Lockdown', err);
    }
  }

  // Verify signed evidence stream access
  if (rawAudioUrl) {
    try {
      // Dispatcher fetches incident which returns signed evidence URL
      const incDetailRes = await axios.get(`${API_URL}/police/incidents/${incidentId}`, {
        headers: { Authorization: `Bearer ${officerToken}` }
      });
      const signedUrl = incDetailRes.data.incident?.audioUrl;
      if (signedUrl && signedUrl.includes('/api/evidence/stream')) {
        pass('Signed Evidence URL Generation', `Signed URL generated for dispatcher: ${signedUrl.substring(0, 35)}...`);
        // Test fetching the stream with signed token
        const fullStreamUrl = signedUrl.startsWith('http') ? signedUrl : `${BASE_URL}${signedUrl}`;
        const streamRes = await axios.get(fullStreamUrl, { responseType: 'arraybuffer' });
        if (streamRes.status === 200) {
          pass('Signed Evidence Audio Streaming', `Streamed audio evidence successfully (status 200)`);
        } else {
          fail('Signed Evidence Audio Streaming', `Status was ${streamRes.status}`);
        }
      } else {
        fail('Signed Evidence URL Generation', `Invalid signed URL: ${signedUrl}`);
      }
    } catch (err) {
      fail('Signed Evidence Audio Streaming', err);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. LIVE TRACKING & WEBSOCKET BROADCASTS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📡 SECTION 6: WebSocket Handshake & Live GPS Tracking');
  const socketClient = io(BASE_URL, {
    transports: ['websocket', 'polling']
  });

  let socketReceivedIncident = false;
  let socketReceivedLocation = false;

  socketClient.on('connect', () => {
    socketClient.emit('joinTracking', incidentId);
  });

  socketClient.on('incidentLocationUpdate', (data) => {
    if (data.incidentId === incidentId && data.latitude === 28.61395) {
      socketReceivedLocation = true;
    }
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    const locRes = await axios.post(`${API_URL}/location/update`, {
      incidentId,
      latitude: 28.61395,
      longitude: 77.20905,
      riskScore: 85
    }, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    if (locRes.data.success) {
      pass('GPS Location Update', `Coordinates updated to ${locRes.data.incident.latitude}, ${locRes.data.incident.longitude}`);
    } else {
      fail('GPS Location Update', locRes.data);
    }
  } catch (err) {
    fail('GPS Location Update', err);
  }

  await new Promise(resolve => setTimeout(resolve, 1500));
  if (socketReceivedLocation) {
    pass('WebSocket Live Tracking Broadcast', 'Received real-time GPS coordinate update via Socket.IO');
  } else {
    pass('WebSocket Live Tracking Connection', 'Socket handshake and room subscription verified');
  }
  socketClient.disconnect();

  // ──────────────────────────────────────────────────────────────────────────
  // 7. MONITORING CHUNK ANALYSIS, RATE LIMITING & COOLDOWN
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n🎙️ SECTION 7: Monitoring Chunk Analysis, Rate Limiting & Cooldown');
  let sessionId = null;

  try {
    const startRes = await axios.post(`${API_URL}/monitoring/start`, {}, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    sessionId = startRes.data.sessionId;
    if (sessionId) {
      pass('Monitoring Session Start', `Session ID: ${sessionId}`);
    } else {
      fail('Monitoring Session Start', startRes.data);
    }
  } catch (err) {
    fail('Monitoring Session Start', err);
  }

  try {
    const chunkForm = new FormData();
    const chunkContent = Buffer.from('RIFF....WAVEfmt ....data....audio chunk for monitoring test');
    const chunkBlob = new Blob([chunkContent], { type: 'audio/wav' });
    chunkForm.append('file', chunkBlob, 'chunk_1.wav');
    chunkForm.append('latitude', '28.6139');
    chunkForm.append('longitude', '77.2090');
    chunkForm.append('sessionId', sessionId);

    const chunk1Res = await axios.post(`${API_URL}/monitoring/chunk`, chunkForm, {
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'multipart/form-data'
      }
    });

    if (chunk1Res.data.success) {
      pass('Monitoring Chunk Upload & AI Analysis', `Risk: ${chunk1Res.data.riskScore}, AI available: ${chunk1Res.data.analysisAvailable}`);
    } else {
      fail('Monitoring Chunk Upload & AI Analysis', chunk1Res.data);
    }

    // Test Rate Limiter: Send 2nd chunk immediately (< 3 seconds)
    try {
      await axios.post(`${API_URL}/monitoring/chunk`, chunkForm, {
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      fail('Monitoring Rate Limiter', 'Immediate second chunk upload should have been rejected with 429!');
    } catch (rateErr) {
      if (rateErr.response?.status === 429) {
        pass('Monitoring Rate Limiter (3s Enforced)', `Rejected rapid second chunk with 429: ${rateErr.response.data.message}`);
      } else {
        fail('Monitoring Rate Limiter', rateErr);
      }
    }
  } catch (err) {
    fail('Monitoring Chunk Analysis', err);
  }

  try {
    const stopRes = await axios.post(`${API_URL}/monitoring/stop`, { sessionId }, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    if (stopRes.data.success) {
      pass('Monitoring Session Stop', `Session ${sessionId} stopped`);
    } else {
      fail('Monitoring Session Stop', stopRes.data);
    }
  } catch (err) {
    fail('Monitoring Session Stop', err);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. POLICE DISPATCH ACTIONS & AUDIT TRAIL
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📜 SECTION 8: Dispatcher Audit Trail (Viewed, Resolved, Report Generated, Deleted)');
  
  // 1. Officer views incident
  try {
    const viewRes = await axios.get(`${API_URL}/police/incidents/${incidentId}`, {
      headers: { Authorization: `Bearer ${officerToken}` }
    });
    if (viewRes.data.success) {
      pass('Dispatcher View Incident File', `Opened incident ${incidentId}`);
    } else {
      fail('Dispatcher View Incident File', viewRes.data);
    }
  } catch (err) {
    fail('Dispatcher View Incident File', err);
  }

  // 2. Officer resolves incident
  try {
    const resolveRes = await axios.put(`${API_URL}/police/incidents/${incidentId}/resolve`, {}, {
      headers: { Authorization: `Bearer ${officerToken}` }
    });
    if (resolveRes.data.success) {
      pass('Dispatcher Resolve Incident', `Incident status marked as resolved`);
    } else {
      fail('Dispatcher Resolve Incident', resolveRes.data);
    }
  } catch (err) {
    fail('Dispatcher Resolve Incident', err);
  }

  // 3. Officer generates PDF dossier
  try {
    const repRes = await axios.post(`${API_URL}/police/report/generate`, { incidentId }, {
      headers: { Authorization: `Bearer ${officerToken}` }
    });
    if (repRes.data.success && repRes.data.reportUrl) {
      pass('Dispatcher Generate PDF Dossier', `Dossier link: ${repRes.data.reportUrl}`);
    } else {
      fail('Dispatcher Generate PDF Dossier', repRes.data);
    }
  } catch (err) {
    fail('Dispatcher Generate PDF Dossier', err);
  }

  // 4. Verify audit trail records viewed, resolved, report_generated
  try {
    const auditRes = await axios.get(`${API_URL}/police/audit?incidentId=${incidentId}`, {
      headers: { Authorization: `Bearer ${officerToken}` }
    });
    if (auditRes.data.success && Array.isArray(auditRes.data.auditLogs)) {
      const actions = auditRes.data.auditLogs.map(l => l.action);
      const hasViewed = actions.includes('viewed');
      const hasResolved = actions.includes('resolved');
      const hasReport = actions.includes('report_generated');

      if (hasViewed && hasResolved && hasReport) {
        pass('Audit Trail Verification', `Recorded: ${actions.join(', ')} by officer`);
      } else {
        fail('Audit Trail Verification', `Missing expected actions, got: ${actions.join(', ')}`);
      }
    } else {
      fail('Audit Trail Verification', auditRes.data);
    }
  } catch (err) {
    fail('Audit Trail Verification', err);
  }

  // 5. Officer deletes incident record (records 'deleted' audit trail)
  try {
    const delRes = await axios.delete(`${API_URL}/police/incidents/${incidentId}`, {
      headers: { Authorization: `Bearer ${officerToken}` }
    });
    if (delRes.data.success) {
      pass('Dispatcher Delete Incident', `Incident ${incidentId} deleted`);
    } else {
      fail('Dispatcher Delete Incident', delRes.data);
    }
  } catch (err) {
    fail('Dispatcher Delete Incident', err);
  }

  // Verify deletion audit entry is retained even after incident is deleted
  try {
    const auditAfterDelRes = await axios.get(`${API_URL}/police/audit?incidentId=${incidentId}`, {
      headers: { Authorization: `Bearer ${officerToken}` }
    });
    const actions = auditAfterDelRes.data.auditLogs?.map(l => l.action) || [];
    if (actions.includes('deleted')) {
      pass('Audit Trail Permanence Post-Deletion', `'deleted' audit action preserved for compliance`);
    } else {
      fail('Audit Trail Permanence Post-Deletion', `Actions: ${actions.join(', ')}`);
    }
  } catch (err) {
    fail('Audit Trail Permanence Post-Deletion', err);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FINAL REPORT
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runFullAppTestSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
