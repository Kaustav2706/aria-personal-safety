import assert from 'assert';
import { initializeDatabase } from '../config/db.js';
import { User } from '../models/User.model.js';
import { MonitoringSession } from '../models/MonitoringSession.model.js';
import { AIService } from '../services/aiService.js';
import { analyzeChunk, stopSession } from '../controllers/monitoring.controller.js';
import { createIncident } from '../controllers/incident.controller.js';

function createMockReqRes(body = {}, file = null, userId = null) {
  let statusCode = 200;
  let jsonResponse = null;
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  const req = {
    userId,
    body,
    file,
    app: {
      get: (key) => {
        if (key === 'io') return { emit: () => {} };
        return null;
      }
    }
  };
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      jsonResponse = data;
      if (resolveDone) resolveDone();
      return res;
    }
  };
  return {
    req,
    res,
    wait: () => done,
    getStatus: () => statusCode,
    getData: () => jsonResponse
  };
}

async function runMonitoringTests() {
  console.log('\n============================================================');
  console.log('🧪 TESTING MONITORING AUTO-INCIDENT LOGIC WITH TONE CALIBRATION');
  console.log('============================================================\n');

  await initializeDatabase();

  const user = await User.create({
    name: 'Calibration Test User',
    phone: '+15551234567',
    email: `calib-test-${Date.now()}@example.com`,
    passwordHash: 'dummyhash',
    emergencyContacts: [
      { name: 'Contact A', phone: '+15559876543' }
    ]
  });

  const session = await MonitoringSession.create(user.id);
  const sessionId = session.id;
  console.log(`✅ Created test session: ${sessionId}`);

  // Test 1: Loud volume alone at night must NOT trigger automatic incident creation
  console.log('\n--- Test 1: Loud Volume Alone at Night ---');
  AIService.analyzeAudioIncident = async ({ sessionId }) => {
    return {
      available: true,
      status: 'OK',
      distress: false, // Volume alone cannot set distress=true
      confidence: 75.0,
      transcript: '',
      riskScore: 50, // Capped at 50 for volume alone
      threatLevel: 'WARNING',
      baseline: 400.0,
      calibrationStatus: 'calibrated'
    };
  };

  const mockFile = {
    buffer: Buffer.from('RIFF....WAVEfmt ....data....'),
    originalname: 'loud_night_noise.webm',
    mimetype: 'audio/webm'
  };

  const { req: req1, res: res1, wait: wait1, getData: getData1 } = createMockReqRes(
    {
      latitude: '37.7749',
      longitude: '-122.4194',
      isIsolated: 'false',
      motionAnomaly: 'false',
      timestamp: '2026-11-07T23:30:00Z',
      sessionId: sessionId
    },
    mockFile,
    user.id
  );

  await analyzeChunk(req1, res1);
  await wait1();
  const data1 = getData1();

  assert.strictEqual(data1.success, true);
  assert.strictEqual(data1.distress, false, 'Volume alone must not be confirmed distress');
  assert.strictEqual(data1.riskScore, 50, 'Volume alone risk score must be <= 50');
  assert.strictEqual(data1.threatLevel, 'WARNING', 'Volume alone threat level must be WARNING');
  assert.strictEqual(data1.autoIncident, null, 'Volume alone at night must NEVER create an auto-incident');
  console.log('✅ Test 1 PASSED: Loud noise at night did not create an incident (autoIncident == null).');

  // Test 2: Genuine emergency (loud shouting + "help me please") MUST trigger an incident
  console.log('\n--- Test 2: Genuine Emergency (Shouting + Distress Keywords) ---');
  AIService.analyzeAudioIncident = async ({ sessionId }) => {
    return {
      available: true,
      status: 'OK',
      distress: true,
      confidence: 90.0,
      transcript: 'help me please somebody help',
      riskScore: 92,
      threatLevel: 'CRITICAL',
      baseline: 400.0,
      calibrationStatus: 'calibrated'
    };
  };

  const { req: req2, res: res2, wait: wait2, getData: getData2 } = createMockReqRes(
    {
      latitude: '37.7749',
      longitude: '-122.4194',
      isIsolated: 'false',
      motionAnomaly: 'false',
      timestamp: '2026-11-07T23:32:00Z',
      sessionId: sessionId
    },
    mockFile,
    user.id
  );

  await analyzeChunk(req2, res2);
  await wait2();
  const data2 = getData2();

  assert.strictEqual(data2.success, true);
  assert.strictEqual(data2.distress, true);
  assert.strictEqual(data2.riskScore, 92);
  assert.strictEqual(data2.threatLevel, 'CRITICAL');
  assert.notStrictEqual(data2.autoIncident, null, 'Genuine emergency MUST create an auto-incident');
  assert.strictEqual(data2.autoIncident.riskScore, 92);
  console.log(`✅ Test 2 PASSED: Genuine emergency created incident ${data2.autoIncident.id} with risk ${data2.autoIncident.riskScore}%.`);

  // Test 3: Motion Anomaly Alone without Shouting or Distress Keywords
  console.log('\n--- Test 3: Motion Anomaly Alone Without Shouting or Distress Keywords ---');
  AIService.analyzeAudioIncident = async () => {
    return {
      available: true,
      audioStatus: 'OK',
      distress: false,
      confidence: 12,
      transcript: 'just jogging around the block',
      riskScore: 15,
      threatLevel: 'SAFE',
      baseline: 400.0,
      calibrationStatus: 'calibrated'
    };
  };

  const { req: req3, res: res3, wait: wait3, getData: getData3 } = createMockReqRes(
    {
      latitude: '37.7749',
      longitude: '-122.4194',
      isIsolated: 'false',
      motionAnomaly: 'true', // Motion anomaly alone (e.g. jogging/running)
      timestamp: '2026-11-07T14:35:00Z',
      sessionId: sessionId
    },
    mockFile,
    user.id
  );

  await analyzeChunk(req3, res3);
  await wait3();
  const data3 = getData3();

  assert.strictEqual(data3.success, true);
  assert.strictEqual(data3.distress, false);
  assert.strictEqual(data3.riskScore, 15);
  assert.strictEqual(data3.threatLevel, 'SAFE');
  assert.strictEqual(data3.autoIncident, null, 'Motion anomaly alone must NOT create an auto-incident');
  console.log('✅ Test 3 PASSED: Motion anomaly alone did not create an incident (autoIncident == null).');

  // Test 4: Motion Anomaly Alone Under High Contextual Risk (Night + Isolated)
  console.log('\n--- Test 4: Motion Anomaly Alone Under High Contextual Risk (Night + Isolated) ---');
  AIService.analyzeAudioIncident = async () => {
    return {
      available: true,
      audioStatus: 'OK',
      distress: false,
      confidence: 15,
      transcript: 'walking back through dark park alone',
      riskScore: 25, // Capped well below 60
      threatLevel: 'SAFE',
      baseline: 400.0,
      calibrationStatus: 'calibrated'
    };
  };

  const { req: req4, res: res4, wait: wait4, getData: getData4 } = createMockReqRes(
    {
      latitude: '37.7749',
      longitude: '-122.4194',
      isIsolated: 'true', // Isolated
      motionAnomaly: 'true', // Motion anomaly
      timestamp: '2026-11-07T23:45:00Z', // Night
      sessionId: sessionId
    },
    mockFile,
    user.id
  );

  await analyzeChunk(req4, res4);
  await wait4();
  const data4 = getData4();

  assert.strictEqual(data4.success, true);
  assert.strictEqual(data4.distress, false);
  assert.strictEqual(data4.threatLevel, 'SAFE');
  assert.strictEqual(data4.autoIncident, null, 'Motion anomaly alone under high risk context must NEVER create an auto-incident');
  console.log('✅ Test 4 PASSED: Motion anomaly alone under night+isolated context did not create an incident.');

  // Test 5: Loud Environmental Noise + Motion Anomaly at Night & Isolated
  console.log('\n--- Test 5: Loud Environmental Noise + Motion Anomaly at Night & Isolated ---');
  AIService.analyzeAudioIncident = async () => {
    return {
      available: true,
      audioStatus: 'OK',
      distress: false, // Loud noise is NOT distress without speech validation
      confidence: 75.0,
      transcript: '',
      riskScore: 50, // Capped at 50
      threatLevel: 'WARNING',
      baseline: 400.0,
      calibrationStatus: 'calibrated'
    };
  };

  const { req: req5, res: res5, wait: wait5, getData: getData5 } = createMockReqRes(
    {
      latitude: '37.7749',
      longitude: '-122.4194',
      isIsolated: 'true', // Isolated
      motionAnomaly: 'true', // Motion anomaly + loud environmental noise
      timestamp: '2026-11-07T23:46:00Z', // Night
      sessionId: sessionId
    },
    mockFile,
    user.id
  );

  await analyzeChunk(req5, res5);
  await wait5();
  const data5 = getData5();

  assert.strictEqual(data5.success, true);
  assert.strictEqual(data5.distress, false, 'Environmental noise + motion must not be confirmed distress');
  assert.strictEqual(data5.riskScore, 50, 'Environmental noise + motion risk score must be capped at <= 50');
  assert.strictEqual(data5.autoIncident, null, 'Environmental noise + motion must NEVER create an auto-incident');
  console.log('✅ Test 5 PASSED: Loud environmental noise + motion anomaly at night/isolated did not create an incident.');

  // Test 6: Motion Anomaly + Genuine Shouting (Fresh User - Independent Incident Creation)
  console.log('\n--- Test 6: Motion Anomaly + Genuine Shouting (Fresh User - Independent Incident Creation) ---');
  const user2 = await User.create({
    name: 'Fresh Incident Test User',
    phone: '+15552345678',
    email: `fresh-user-${Date.now()}@example.com`,
    passwordHash: 'dummyhash',
    emergencyContacts: [
      { name: 'Contact B', phone: '+15558765432' }
    ]
  });

  const session2 = await MonitoringSession.create(user2.id);
  const sessionId2 = session2.id;

  AIService.analyzeAudioIncident = async () => {
    return {
      available: true,
      audioStatus: 'OK',
      distress: true,
      confidence: 90,
      transcript: 'help me please somebody help',
      riskScore: 92,
      threatLevel: 'CRITICAL',
      baseline: 400.0,
      calibrationStatus: 'calibrated'
    };
  };

  const { req: req6, res: res6, wait: wait6, getData: getData6 } = createMockReqRes(
    {
      latitude: '37.7749',
      longitude: '-122.4194',
      isIsolated: 'false',
      motionAnomaly: 'true', // Motion anomaly + genuine shouting
      timestamp: '2026-11-07T23:50:00Z',
      sessionId: sessionId2
    },
    mockFile,
    user2.id
  );

  await analyzeChunk(req6, res6);
  await wait6();
  const data6 = getData6();

  assert.strictEqual(data6.success, true);
  assert.strictEqual(data6.distress, true);
  assert.notStrictEqual(data6.autoIncident, null, 'Motion anomaly + genuine emergency MUST create an auto-incident');
  assert.strictEqual(data6.autoIncident.riskScore, 92, 'New incident risk score must match analysis risk');
  assert.strictEqual(data6.autoIncident.status, 'pending_dispatch', 'New incident status must be pending_dispatch');
  assert.strictEqual(data6.autoIncident.triggerType, 'monitoring', 'New incident triggerType must be monitoring');
  assert.strictEqual(data6.autoIncident.reused, undefined, 'Must be a brand new incident, NOT a reused incident');
  assert.notStrictEqual(data6.autoIncident.id, data2.autoIncident.id, 'New incident must have its own unique ID');
  console.log(`✅ Test 6 PASSED: Brand new incident ${data6.autoIncident.id} created independently (status: ${data6.autoIncident.status}, trigger: ${data6.autoIncident.triggerType}, risk: ${data6.autoIncident.riskScore}%).`);

  // Test 7: Active Incident Reuse Cooldown (Second High-Risk Trigger for User 2 within Cooldown Window)
  console.log('\n--- Test 7: Active Incident Reuse Cooldown (Within Cooldown Window) ---');
  const { req: req7, res: res7, wait: wait7, getData: getData7 } = createMockReqRes(
    {
      latitude: '37.7749',
      longitude: '-122.4194',
      isIsolated: 'false',
      motionAnomaly: 'true',
      timestamp: '2026-11-07T23:51:00Z',
      sessionId: sessionId2
    },
    mockFile,
    user2.id
  );

  await analyzeChunk(req7, res7);
  await wait7();
  const data7 = getData7();

  assert.strictEqual(data7.success, true);
  assert.notStrictEqual(data7.autoIncident, null);
  assert.strictEqual(data7.autoIncident.reused, true, 'Subsequent chunk within cooldown MUST reuse active incident');
  assert.strictEqual(data7.autoIncident.id, data6.autoIncident.id, 'Reused incident ID must match initial incident ID');
  console.log(`✅ Test 7 PASSED: Active incident ${data7.autoIncident.id} successfully reused on subsequent trigger during cooldown.`);

  // Test 8: Explicit Motion SOS (POST /api/incidents with triggerType: 'motion')
  console.log('\n--- Test 8: Explicit Motion SOS (POST /api/incidents with triggerType: motion) ---');
  const { req: req8, res: res8, wait: wait8, getData: getData8, getStatus: getStatus8 } = createMockReqRes(
    {
      latitude: '37.7749',
      longitude: '-122.4194',
      isIsolated: 'false',
      triggerType: 'motion' // Explicit device motion trigger (fall detection / shake SOS)
    },
    null,
    user.id
  );

  await createIncident(req8, res8);
  await wait8();
  const data8 = getData8();

  assert.strictEqual(getStatus8(), 201);
  assert.strictEqual(data8.success, true);
  assert.strictEqual(data8.incident.triggerType, 'motion');
  assert.strictEqual(data8.incident.status, 'active');
  assert.strictEqual(data8.incident.userId, user.id);
  assert.ok(data8.incident.riskScore >= 65, 'Explicit motion SOS must preserve deliberate baseline >= 65');
  console.log(`✅ Test 8 PASSED: Explicit motion SOS created active incident ${data8.incident.id} with triggerType '${data8.incident.triggerType}' (risk: ${data8.incident.riskScore}%).`);

  // Test 8b: Explicit Motion SOS WITH attached ambient audio (must not be suppressed below 65)
  console.log('\n--- Test 8b: Explicit Motion SOS with Attached Ambient Audio ---');
  AIService.analyzeAudioIncident = async () => ({
    distress: false,
    confidence: 10,
    transcript: '',
    riskScore: 15, // Audio alone is low risk / ambient
    threatLevel: 'SAFE',
    available: true
  });

  const { req: req8b, res: res8b, wait: wait8b, getData: getData8b, getStatus: getStatus8b } = createMockReqRes(
    {
      latitude: '37.7749',
      longitude: '-122.4194',
      isIsolated: 'false',
      triggerType: 'motion'
    },
    {
      originalname: 'ambient_fall.webm',
      buffer: Buffer.from('RIFF....WAVEfmt '),
      mimetype: 'audio/webm'
    },
    user.id
  );

  await createIncident(req8b, res8b);
  await wait8b();
  const data8b = getData8b();

  assert.strictEqual(getStatus8b(), 201);
  assert.strictEqual(data8b.success, true);
  assert.strictEqual(data8b.incident.triggerType, 'motion');
  assert.strictEqual(data8b.incident.status, 'active');
  assert.ok(data8b.incident.riskScore >= 65, `Explicit motion SOS with ambient audio must preserve baseline >= 65 (got ${data8b.incident.riskScore})`);
  console.log(`✅ Test 8b PASSED: Explicit motion SOS with attached ambient audio preserved score ${data8b.incident.riskScore}% >= 65% (not suppressed).`);

  // Test 9: Stopping monitoring session triggers session reset in AI Service
  console.log('\n--- Test 9: Stopping Monitoring Session Resets Calibration ---');
  let resetCalledWith = null;
  AIService.resetSession = async (sid) => {
    resetCalledWith = sid;
  };

  const { req: req9, res: res9, wait: wait9, getData: getData9 } = createMockReqRes(
    { sessionId: sessionId },
    null,
    user.id
  );

  await stopSession(req9, res9);
  await wait9();
  const data9 = getData9();

  assert.strictEqual(data9.success, true);
  assert.strictEqual(resetCalledWith, sessionId, 'AIService.resetSession must be called with sessionId');
  console.log('✅ Test 9 PASSED: Stopping monitoring session invoked AIService.resetSession.');

  console.log('\n🎉 ALL BACKEND MONITORING TESTS PASSED SUCCESSFULLY!\n');
}

runMonitoringTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
