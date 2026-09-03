import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import http from 'node:http';

const JWT_SECRET = 'super_secret_jwt_key_for_testing_123';
process.env.JWT_SECRET = JWT_SECRET;
process.env.DB_MODE = 'memory';

import app from '../app.js';
import { initializeDatabase } from '../config/db.js';
import { Incident } from '../models/Incident.model.js';
import { User } from '../models/User.model.js';

describe('BOLA Authorization Tests (Bug #10)', () => {
  let server;
  let port;
  let tokenUserA;
  let tokenUserB;
  let userAId;
  let userBId;
  let incidentAId;
  let incidentBId;

  before(async () => {
    // Force DB initialization to trigger memory mode fallback!
    await initializeDatabase();

    const userA = await User.create({ name: 'User A', email: 'usera@test.com', passwordHash: 'hash1', phone: '1111111111' });
    userAId = userA.id;
    tokenUserA = jwt.sign({ userId: userAId }, JWT_SECRET, { expiresIn: '1h' });

    const userB = await User.create({ name: 'User B', email: 'userb@test.com', passwordHash: 'hash2', phone: '2222222222' });
    userBId = userB.id;
    tokenUserB = jwt.sign({ userId: userBId }, JWT_SECRET, { expiresIn: '1h' });

    const incA = await Incident.create({ userId: userAId, latitude: 12.9716, longitude: 77.5946, triggerType: 'manual' });
    incidentAId = incA.id;

    const incB = await Incident.create({ userId: userBId, latitude: 28.7041, longitude: 77.1025, triggerType: 'manual' });
    incidentBId = incB.id;

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after((done) => {
    if (server) server.close(done);
    else done();
  });

  test('User A can update their own incident location (User A -> Incident A -> Allowed 200)', async () => {
    const postData = JSON.stringify({
      incidentId: incidentAId,
      latitude: 12.9800,
      longitude: 77.6000,
      riskScore: 90
    });

    const res = await makeRequest('/api/location/update', 'POST', {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + tokenUserA
    }, postData);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.incident.latitude, 12.98);
  });

  test('User B CANNOT update User A incident location (User B -> Incident A -> 403 Forbidden)', async () => {
    const postData = JSON.stringify({
      incidentId: incidentAId,
      latitude: 99.9999,
      longitude: 99.9999,
      riskScore: 10
    });

    const res = await makeRequest('/api/location/update', 'POST', {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + tokenUserB
    }, postData);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Forbidden');

    // Verify User A incident was NOT modified
    const incA = await Incident.findById(incidentAId);
    assert.strictEqual(incA.latitude, 12.98);
  });

  test('User A CANNOT update User B incident location (User A -> Incident B -> 403 Forbidden)', async () => {
    const postData = JSON.stringify({
      incidentId: incidentBId,
      latitude: 99.9999,
      longitude: 99.9999
    });

    const res = await makeRequest('/api/location/update', 'POST', {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + tokenUserA
    }, postData);

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Forbidden');
  });

  test('Unauthenticated user request is rejected (Unauthenticated -> Incident A -> 401 Unauthorized)', async () => {
    const postData = JSON.stringify({
      incidentId: incidentAId,
      latitude: 12.9800,
      longitude: 77.6000
    });

    const res = await makeRequest('/api/location/update', 'POST', {
      'Content-Type': 'application/json'
    }, postData);

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.success, false);
  });

  test('Updating nonexistent incident returns 404 Not Found', async () => {
    const postData = JSON.stringify({
      incidentId: 'non_existent_123',
      latitude: 12.9800,
      longitude: 77.6000
    });

    const res = await makeRequest('/api/location/update', 'POST', {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + tokenUserA
    }, postData);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
  });

  test('User B CANNOT delete User A incident (User B -> Incident A -> 403 Forbidden)', async () => {
    const res = await makeRequest('/api/incidents/' + incidentAId, 'DELETE', {
      'Authorization': 'Bearer ' + tokenUserB
    });

    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Forbidden');

    // Verify incident still exists
    const incA = await Incident.findById(incidentAId);
    assert.ok(incA);
  });

  test('User A can delete their own incident (User A -> Incident A -> Allowed 200)', async () => {
    const res = await makeRequest('/api/incidents/' + incidentAId, 'DELETE', {
      'Authorization': 'Bearer ' + tokenUserA
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);

    const incA = await Incident.findById(incidentAId);
    assert.strictEqual(incA, null);
  });

  function makeRequest(path, method, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: port,
        path: path,
        method: method,
        headers: headers
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: data });
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
});
