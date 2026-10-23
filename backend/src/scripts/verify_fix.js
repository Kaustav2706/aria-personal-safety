import assert from 'assert';
import { dispatchTieredAlerts } from '../config/alertConfig.js';
import { Incident } from '../models/Incident.model.js';
import { User } from '../models/User.model.js';
import { ReportService } from '../services/reportService.js';
import { TwilioService } from '../services/twilioService.js';
import { TwilioVoiceService } from '../services/twilioVoiceService.js';
import { FirebaseService } from '../services/firebaseService.js';

import { createIncident, MANUAL_SOS_RISK_SCORE } from '../controllers/incident.controller.js';
import { triggerSOS } from '../controllers/alert.controller.js';
import { AIService } from '../services/aiService.js';

// Setup mock Firebase service
FirebaseService.sendPoliceBroadcast = async (incident) => {
  return { success: true };
};

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
    getJson: () => jsonResponse
  };
}

function captureDocTexts(incident, user) {
  const texts = [];
  const links = [];
  const mockDoc = {
    rect: () => mockDoc,
    fill: () => mockDoc,
    fillColor: () => mockDoc,
    strokeColor: () => mockDoc,
    lineWidth: () => mockDoc,
    moveTo: () => mockDoc,
    lineTo: () => mockDoc,
    stroke: () => mockDoc,
    moveDown: () => mockDoc,
    fontSize: () => mockDoc,
    font: () => mockDoc,
    text: (str, ...args) => {
      if (typeof str === 'string') {
        texts.push(str);
      }
      const opts = args.find(a => a && typeof a === 'object' && a.link);
      if (opts && opts.link) {
        links.push({ text: str, link: opts.link });
      }
      return mockDoc;
    }
  };

  ReportService.buildPDF(mockDoc, incident, user, '');
  texts.links = links;
  return texts;
}

async function runTests() {
  console.log('--- Starting Gravitas Verification Runner for N12 & N13 ---');

  const testUser = await User.create({
    name: 'Jane Doe',
    phone: '+15551234567',
    email: `jane-${Date.now()}@example.com`,
    passwordHash: 'dummyhash',
    emergencyContacts: [
      { name: 'John Doe', phone: '+15559876543' },
      { name: 'Alice Smith', phone: '+15554567890' }
    ]
  });

  // Track dispatched Twilio messages and calls
  const sentMessages = [];
  const initiatedCalls = [];

  TwilioService.client = {
    messages: {
      create: async (payload) => {
        sentMessages.push(payload);
        return {
          sid: `SM_TEST_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          status: 'sent'
        };
      }
    }
  };

  TwilioVoiceService.client = {
    calls: {
      create: async (payload) => {
        initiatedCalls.push(payload);
        return {
          sid: `CA_TEST_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          status: 'queued'
        };
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: N12 REGRESSION TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n[N12 Test 1] Testing automatic monitoring incident dispatchTieredAlerts auto-persistence...');
  const autoIncident = await Incident.create({
    userId: testUser.id,
    status: 'active',
    triggerType: 'monitoring',
    latitude: 37.7749,
    longitude: -122.4194,
    riskScore: 88,
    audioTranscript: 'Someone help me please!'
  });

  assert(autoIncident.id, 'Incident should have an id');
  assert.strictEqual(autoIncident.notificationLogs.length, 0, 'New incident starts with empty notificationLogs');

  const results = await dispatchTieredAlerts({ user: testUser, incident: autoIncident });

  assert.strictEqual(results.smsDispatched, true, 'SMS should be dispatched');
  assert.strictEqual(results.policeBroadcasted, true, 'Police should be broadcasted');
  assert(results.notificationLogs.length > 0, 'results should contain notification logs');

  const fetchedIncident = await Incident.findById(autoIncident.id);
  assert(fetchedIncident, 'Fetched incident must exist');
  assert(fetchedIncident.notificationLogs, 'Fetched incident must have notificationLogs');
  assert.strictEqual(fetchedIncident.notificationLogs.length, results.notificationLogs.length);
  console.log('✓ N12 Test 1 Passed: dispatchTieredAlerts auto-persisted notification logs.');

  console.log('[N12 Test 2] Testing PDF report output for incident with saved notification logs...');
  const textsWithLogs = captureDocTexts(fetchedIncident, testUser);
  const fullOutputWithLogs = textsWithLogs.join('\n');
  assert(fullOutputWithLogs.includes('Emergency Contacts Notified via SMS Alerts:'));
  assert(fullOutputWithLogs.includes('John Doe - Phone: +15559876543 [Delivered [Status: sent]]'));
  assert(!fullOutputWithLogs.includes('[Delivery failed]'));
  assert(!fullOutputWithLogs.includes('[Dispatched: OK]'));
  console.log('✓ N12 Test 2 Passed: Report accurately displays recorded delivery status.');

  console.log('[N12 Test 3] Testing PDF report output for incident with NO saved notification logs...');
  const unrecordedIncident = await Incident.create({
    userId: testUser.id,
    status: 'active',
    triggerType: 'monitoring',
    latitude: 37.7749,
    longitude: -122.4194,
    riskScore: 35,
    audioTranscript: 'Routine background audio'
  });

  const textsWithoutLogs = captureDocTexts(unrecordedIncident, testUser);
  const fullOutputWithoutLogs = textsWithoutLogs.join('\n');
  assert(fullOutputWithoutLogs.includes('1. John Doe - Phone: +15559876543 [Notification status not recorded]'));
  assert(fullOutputWithoutLogs.includes('2. Alice Smith - Phone: +15554567890 [Notification status not recorded]'));
  assert(!fullOutputWithoutLogs.includes('[Delivery failed]'));
  assert(!fullOutputWithoutLogs.includes('[Dispatched: OK]'));
  console.log('✓ N12 Test 3 Passed: Report prints "Notification status not recorded" and never invents outcomes.');

  console.log('[N12 Test 4] Testing PDF report output when notificationLogs is stored as JSON string...');
  const stringifiedIncident = {
    ...unrecordedIncident,
    notificationLogs: JSON.stringify([
      { channel: 'sms', name: 'Bob', phone: '+1234567890', success: false, errorMessage: 'Twilio error 21608' }
    ])
  };
  const textsStringified = captureDocTexts(stringifiedIncident, testUser);
  const fullOutputStringified = textsStringified.join('\n');
  assert(fullOutputStringified.includes('Bob - Phone: +1234567890 [Delivery failed [Twilio error 21608]]'));
  console.log('✓ N12 Test 4 Passed: JSON stringified logs safely parsed.');

  console.log('[N12 Test 5] Testing generateIncidentPDFBuffer generation...');
  const buffer = await ReportService.generateIncidentPDFBuffer(fetchedIncident, testUser);
  assert(Buffer.isBuffer(buffer) && buffer.length > 0);
  console.log(`✓ N12 Test 5 Passed: PDF buffer rendered (${buffer.length} bytes).`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: N13 BUG TESTS (GPS Unavailable Handling & First Fix Follow-up)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n[N13 Test 1] Testing incident creation when GPS is unavailable...');
  
  // Simulate incident created with location_unavailable: true and coords (0, 0)
  const isLocUnavailable = true;
  const noGpsLat = isLocUnavailable ? null : 0.0;
  const noGpsLng = isLocUnavailable ? null : 0.0;

  const noGpsIncident = await Incident.create({
    userId: testUser.id,
    status: 'active',
    triggerType: 'manual',
    latitude: noGpsLat,
    longitude: noGpsLng,
    riskScore: 85,
    audioTranscript: 'Help, I am in an unknown location'
  });

  assert.strictEqual(noGpsIncident.latitude, null, 'In-memory incident latitude must be null when GPS is unavailable');
  assert.strictEqual(noGpsIncident.longitude, null, 'In-memory incident longitude must be null when GPS is unavailable');

  const fetchedNoGps = await Incident.findById(noGpsIncident.id);
  assert.strictEqual(fetchedNoGps.latitude, null, 'DB incident latitude must be null');
  assert.strictEqual(fetchedNoGps.longitude, null, 'DB incident longitude must be null');

  const initialHistory = await Incident.getLocationHistory(noGpsIncident.id);
  assert.strictEqual(initialHistory.length, 0, 'No location_history entry should be recorded when coordinates are null');
  console.log('✓ N13 Test 1 Passed: Incident stores null coordinates and zero location_history entries when GPS is unavailable.');

  console.log('[N13 Test 2] Testing SMS alert text when location is unavailable...');
  sentMessages.length = 0;
  await TwilioService.sendSOSAlert(testUser.emergencyContacts, testUser, fetchedNoGps);

  assert.strictEqual(sentMessages.length, testUser.emergencyContacts.length, 'SMS should be sent to all emergency contacts');
  for (const msg of sentMessages) {
    assert(msg.body.includes('Location unavailable — call her directly'), 'SMS must say "Location unavailable — call her directly"');
    assert(!msg.body.includes('https://maps.google.com'), 'SMS must leave out Google Maps link');
    assert(!msg.body.includes('0,0'), 'SMS must NOT contain 0,0');
    assert(!msg.body.includes('latitude zero'), 'SMS must NOT reference latitude zero');
  }
  console.log('✓ N13 Test 2 Passed: SMS says "Location unavailable — call her directly" with link left out.');

  console.log('[N13 Test 3] Testing emergency voice call when location is unavailable...');
  initiatedCalls.length = 0;
  await TwilioVoiceService.makeEmergencyCall(testUser.emergencyContacts[0].phone, testUser, fetchedNoGps);

  assert.strictEqual(initiatedCalls.length, 1, 'Voice call should be initiated');
  const voiceCall = initiatedCalls[0];
  assert(voiceCall.twiml.includes('Location unavailable — call her directly'), 'Voice TwiML must say "Location unavailable — call her directly"');
  assert(!voiceCall.twiml.includes('latitude zero, longitude zero'), 'Voice TwiML must NOT say "latitude zero, longitude zero"');
  assert(!voiceCall.twiml.includes('latitude 0, longitude 0'), 'Voice TwiML must NOT say "latitude 0, longitude 0"');
  console.log('✓ N13 Test 3 Passed: Voice call says "Location unavailable — call her directly" without zero coordinates.');

  console.log('[N13 Test 4] Testing first real GPS fix arrival and follow-up SMS text...');
  sentMessages.length = 0;

  const realLat = 37.7749;
  const realLng = -122.4194;

  // Verify incident before update had no location
  const beforeUpdate = await Incident.findById(noGpsIncident.id);
  const hadNoLocation = beforeUpdate.latitude === null || beforeUpdate.latitude === undefined ||
    (parseFloat(beforeUpdate.latitude) === 0 && parseFloat(beforeUpdate.longitude) === 0);
  assert.strictEqual(hadNoLocation, true, 'Pre-condition: incident had no location');

  // Apply the first real GPS fix
  const updatedWithGps = await Incident.update(noGpsIncident.id, {
    latitude: realLat,
    longitude: realLng
  });

  assert.strictEqual(parseFloat(updatedWithGps.latitude), realLat, 'Incident latitude updated');
  assert.strictEqual(parseFloat(updatedWithGps.longitude), realLng, 'Incident longitude updated');

  // Verify location history now contains the first real fix
  const updatedHistory = await Incident.getLocationHistory(noGpsIncident.id);
  assert.strictEqual(updatedHistory.length, 1, 'Location history now has 1 fix entry');
  assert.strictEqual(parseFloat(updatedHistory[0].latitude), realLat);
  assert.strictEqual(parseFloat(updatedHistory[0].longitude), realLng);

  // Send follow-up text once first real fix arrives
  const followUpResult = await TwilioService.sendLocationFollowUp(
    testUser.emergencyContacts,
    testUser,
    updatedWithGps,
    { latitude: realLat, longitude: realLng }
  );

  assert.strictEqual(followUpResult.success, true, 'Follow-up SMS should succeed');
  assert.strictEqual(sentMessages.length, testUser.emergencyContacts.length, 'Follow-up SMS sent to all contacts');

  for (const msg of sentMessages) {
    assert(msg.body.includes('UPDATE: Location now available for'), 'Must indicate location is now available');
    assert(msg.body.includes(`https://maps.google.com/?q=${realLat},${realLng}`), 'Must include Google Maps link to real fix');
  }

  // Check notificationLogs in DB includes the follow-up entries
  const incidentWithFollowUpLogs = await Incident.findById(noGpsIncident.id);
  const logs = incidentWithFollowUpLogs.notificationLogs;
  assert(logs.some(l => l.isLocationFollowUp === true && l.channel === 'sms_followup'), 'notificationLogs must record follow-up SMS');
  console.log('✓ N13 Test 4 Passed: First real fix updates coordinates, logs history, and dispatches follow-up SMS with link.');

  console.log('[N13 Test 5] Testing that subsequent GPS updates DO NOT send duplicate follow-up texts...');
  sentMessages.length = 0;

  // Apply a second GPS update
  const secondLat = 37.7755;
  const secondLng = -122.4188;
  const secondUpdate = await Incident.update(noGpsIncident.id, {
    latitude: secondLat,
    longitude: secondLng
  });

  const duplicateCheckResult = await TwilioService.sendLocationFollowUp(
    testUser.emergencyContacts,
    testUser,
    secondUpdate,
    { latitude: secondLat, longitude: secondLng }
  );

  assert.strictEqual(duplicateCheckResult.alreadySent, true, 'Subsequent update must identify follow-up was already sent');
  assert.strictEqual(sentMessages.length, 0, 'Must NOT send duplicate follow-up SMS on subsequent location updates');
  console.log('✓ N13 Test 5 Passed: Duplicate follow-up SMS prevented on subsequent GPS updates.');

  console.log('[N13 Test 6] Testing normal incident with valid GPS coordinates from the start...');
  sentMessages.length = 0;
  initiatedCalls.length = 0;

  const validGpsIncident = await Incident.create({
    userId: testUser.id,
    status: 'active',
    triggerType: 'manual',
    latitude: 37.7749,
    longitude: -122.4194,
    riskScore: 80,
    audioTranscript: 'Valid GPS test'
  });

  await TwilioService.sendSOSAlert(testUser.emergencyContacts, testUser, validGpsIncident);
  assert.strictEqual(sentMessages.length, testUser.emergencyContacts.length);
  for (const msg of sentMessages) {
    assert(msg.body.includes('https://maps.google.com/?q=37.7749,-122.4194'), 'Normal SMS must include Google Maps link');
    assert(!msg.body.includes('Location unavailable — call her directly'));
  }

  await TwilioVoiceService.makeEmergencyCall(testUser.emergencyContacts[0].phone, testUser, validGpsIncident);
  assert(initiatedCalls[0].twiml.includes('latitude 37.7749, longitude -122.4194'), 'Normal voice call must read out valid coordinates');
  assert(!initiatedCalls[0].twiml.includes('Location unavailable — call her directly'));
  console.log('✓ N13 Test 6 Passed: Incidents with valid GPS coordinates include Google Maps link and speak coordinates.');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: N14 PDF AUDIO LINK & IST TIMEZONE VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n[N14 Test 1] Testing timestamp formatting in Asia/Kolkata with IST suffix...');
  // 9:00 PM in Jaipur (Asia/Kolkata, UTC+5:30) is 15:30 UTC
  const incidentJaipur9PM = await Incident.create({
    userId: testUser.id,
    status: 'active',
    triggerType: 'voice',
    latitude: 26.9124,
    longitude: 75.7873,
    riskScore: 92,
    audioTranscript: 'Testing Jaipur 9pm distress',
    audioUrl: 'evidence://3f9a987c-jaipur-audio.webm'
  });
  incidentJaipur9PM.createdAt = '2026-10-23T15:30:00.000Z';

  const textsJaipur = captureDocTexts(incidentJaipur9PM, testUser);
  const fullTextJaipur = textsJaipur.join('\n');

  // Verify the timestamp line has 9:00:00 PM and ends with IST
  assert(fullTextJaipur.includes('9:00:00 PM IST'), `PDF must display 9:00:00 PM IST for 15:30 UTC, got:\n${fullTextJaipur}`);
  // Verify it does NOT display raw 3:30 PM UTC
  assert(!fullTextJaipur.includes('3:30:00 PM'), 'PDF must NOT display raw UTC time (3:30 PM)');
  console.log('✓ N14 Test 1 Passed: Timestamp accurately formats UTC 15:30 as 9:00:00 PM IST with timezone label.');

  console.log('[N14 Test 2] Testing ReportService.formatIST with various inputs...');
  assert.strictEqual(ReportService.formatIST('2026-10-23T03:30:00.000Z'), '10/23/2026, 9:00:00 AM IST');
  assert.strictEqual(ReportService.formatIST(null), 'N/A');
  assert.strictEqual(ReportService.formatIST(undefined), 'N/A');
  assert.strictEqual(ReportService.formatIST('invalid-date'), 'N/A');
  assert(ReportService.formatIST(new Date()).endsWith(' IST'));
  console.log('✓ N14 Test 2 Passed: formatIST edge cases handled robustly.');

  console.log('[N14 Test 3] Testing evidence audio link points to dashboard report page instead of internal storage reference...');
  // Verify raw internal evidence:// or s3:// is NOT printed in the PDF
  assert(!fullTextJaipur.includes('evidence://3f9a987c-jaipur-audio.webm'), 'Must NOT print raw internal evidence:// URI');
  assert(!fullTextJaipur.includes('s3://'), 'Must NOT print raw internal s3:// URI');

  const expectedDashboardReportUrl = `http://localhost:3000/reports/${incidentJaipur9PM.id}`;
  assert(fullTextJaipur.includes(expectedDashboardReportUrl), `Evidence line must print dashboard report URL: ${expectedDashboardReportUrl}`);

  // Check the clickable link object passed to PDFKit
  const evidenceLink = textsJaipur.links.find(l => l.link === expectedDashboardReportUrl);
  assert(evidenceLink, `PDF link annotation must point to ${expectedDashboardReportUrl}`);
  assert.strictEqual(evidenceLink.text, expectedDashboardReportUrl, 'Link text must match report page URL');
  console.log('✓ N14 Test 3 Passed: Evidence audio line links to dashboard report page for fresh playback generation.');

  console.log('[N14 Test 4] Testing custom DASHBOARD_URL environment variable override for evidence link...');
  const originalEnvDashboard = process.env.DASHBOARD_URL;
  try {
    process.env.DASHBOARD_URL = 'https://police-hq.aria.org';
    const textsCustomEnv = captureDocTexts(incidentJaipur9PM, testUser);
    const customUrl = `https://police-hq.aria.org/reports/${incidentJaipur9PM.id}`;
    assert(textsCustomEnv.join('\n').includes(customUrl), `Must use configured DASHBOARD_URL: ${customUrl}`);
    assert(textsCustomEnv.links.some(l => l.link === customUrl), 'Clickable link must use configured DASHBOARD_URL');
  } finally {
    if (originalEnvDashboard !== undefined) {
      process.env.DASHBOARD_URL = originalEnvDashboard;
    } else {
      delete process.env.DASHBOARD_URL;
    }
  }
  console.log('✓ N14 Test 4 Passed: DASHBOARD_URL override respected.');

  console.log('[N14 Test 5] Testing incident with NO audio evidence recorded...');
  const noAudioIncident = await Incident.create({
    userId: testUser.id,
    status: 'active',
    triggerType: 'manual',
    latitude: 26.9124,
    longitude: 75.7873,
    riskScore: 50,
    audioTranscript: 'Silent alert'
  });

  const textsNoAudio = captureDocTexts(noAudioIncident, testUser);
  const fullTextNoAudio = textsNoAudio.join('\n');
  assert(fullTextNoAudio.includes('no audio evidence recorded'), 'Must state "no audio evidence recorded"');
  assert(!fullTextNoAudio.includes('/reports/'), 'Must NOT create report link when no audio exists');
  console.log('✓ N14 Test 5 Passed: No audio evidence displays fallback message cleanly.');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: N15 MANUAL SOS SCORING & ENDPOINT UNIFICATION VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n[N15 Test 1] Verifying /alerts/sos endpoint routes to the same function as /incidents/create...');
  assert.strictEqual(triggerSOS, createIncident, 'triggerSOS and createIncident must be the exact same function to prevent drift');
  console.log('✓ N15 Test 1 Passed: Both SOS endpoints share the identical controller implementation.');

  console.log('[N15 Test 2] Testing that manual SOS assigns a fixed high score without random jitter across repeated calls...');
  const scores = [];
  for (let i = 0; i < 10; i++) {
    const mock = createMockReqRes({
      triggerType: 'manual',
      latitude: 28.6139,
      longitude: 77.2090
    }, null, testUser.id);
    await createIncident(mock.req, mock.res);
    assert.strictEqual(mock.getStatus(), 201, 'Incident creation must return status 201');
    const json = mock.getJson();
    assert(json && json.incident, 'Response must contain created incident');
    scores.push(json.incident.riskScore);
  }
  // Verify all 10 calls produced the exact same fixed high score (no random variance)
  assert.strictEqual(scores.length, 10);
  const firstScore = scores[0];
  assert.strictEqual(firstScore, MANUAL_SOS_RISK_SCORE, `Score must equal MANUAL_SOS_RISK_SCORE (${MANUAL_SOS_RISK_SCORE})`);
  assert(scores.every(s => s === firstScore), `All manual SOS scores must be constant; observed values: ${scores.join(', ')}`);
  console.log(`✓ N15 Test 2 Passed: Manual SOS consistently produces fixed score of ${firstScore} with zero random jitter.`);

  console.log('[N15 Test 3] Testing that any score sent by the app is completely ignored...');
  const rogueScores = [10, 42, 75, 99, 0, -5];
  for (const clientScore of rogueScores) {
    const mock = createMockReqRes({
      triggerType: 'manual',
      riskScore: clientScore,
      latitude: 28.6139,
      longitude: 77.2090
    }, null, testUser.id);
    await triggerSOS(mock.req, mock.res);
    const json = mock.getJson();
    assert.strictEqual(json.incident.riskScore, MANUAL_SOS_RISK_SCORE, `Sent score ${clientScore} must be ignored; expected ${MANUAL_SOS_RISK_SCORE}, got ${json.incident.riskScore}`);
  }
  console.log('✓ N15 Test 3 Passed: App-supplied riskScore values are strictly ignored for manual SOS.');

  console.log('[N15 Test 4] Testing that incident record explicitly records triggerType as manual even when omitted...');
  const mockOmittedTrigger = createMockReqRes({
    latitude: 28.6139,
    longitude: 77.2090
    // triggerType is omitted
  }, null, testUser.id);
  await triggerSOS(mockOmittedTrigger.req, mockOmittedTrigger.res);
  const jsonOmitted = mockOmittedTrigger.getJson();
  assert.strictEqual(jsonOmitted.incident.triggerType, 'manual', 'Omitted triggerType on SOS endpoint must record as "manual"');
  assert.strictEqual(jsonOmitted.incident.riskScore, MANUAL_SOS_RISK_SCORE, 'Omitted triggerType must receive fixed manual SOS risk score');
  console.log('✓ N15 Test 4 Passed: Record explicitly persists triggerType: "manual" and fixed high score.');

  console.log('[N15 Test 5] Testing manual SOS with audio file when AI analysis is unavailable...');
  const origAnalyze = AIService.analyzeAudioIncident;
  try {
    AIService.analyzeAudioIncident = async () => ({
      available: false,
      transcript: '',
      riskScore: 0,
      threatClass: 'unknown'
    });

    const mockAiDown = createMockReqRes({
      triggerType: 'manual',
      latitude: 28.6139,
      longitude: 77.2090
    }, {
      originalname: 'distress.wav',
      buffer: Buffer.from('mockwavdata'),
      mimetype: 'audio/wav'
    }, testUser.id);

    await createIncident(mockAiDown.req, mockAiDown.res);
    const jsonAiDown = mockAiDown.getJson();
    assert.strictEqual(jsonAiDown.incident.riskScore, MANUAL_SOS_RISK_SCORE, `When AI is down, manual SOS must have fixed score ${MANUAL_SOS_RISK_SCORE}, got ${jsonAiDown.incident.riskScore}`);
    assert.strictEqual(jsonAiDown.incident.triggerType, 'manual', 'Record must say manual');
  } finally {
    AIService.analyzeAudioIncident = origAnalyze;
  }
  console.log('✓ N15 Test 5 Passed: Manual SOS with audio gets fixed high score when AI is unavailable (no random score).');

  console.log('\n============================================================');
  console.log('ALL VERIFICATION SUITES (N12, N13, N14 & N15) PASSED SUCCESSFULLY!');
  console.log('============================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
