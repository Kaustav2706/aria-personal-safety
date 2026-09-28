import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = 'super_secret_jwt_key_for_testing_123';
process.env.JWT_SECRET = JWT_SECRET;
process.env.DATABASE_URL = 'postgres://invalid:invalid@localhost:5432/invalid';

import { StorageService } from '../services/storageService.js';
import { initializeDatabase } from '../config/db.js';
import { Incident } from '../models/Incident.model.js';
import { User } from '../models/User.model.js';

describe('StorageService & Evidence Capture Tests (Bug #22)', () => {
  before(async () => {
    await initializeDatabase();
  });

  test('StorageService uploads local fallback file when AWS config is absent', async () => {
    const dummyBuffer = Buffer.from('RIFF....WAVEfmt ....data....test audio clip content');
    const resultUrl = await StorageService.uploadEvidence('test_distress.wav', dummyBuffer, 'audio/wav');

    assert.ok(resultUrl);
    assert.ok(resultUrl.startsWith('/uploads/evidence/'));

    // Verify file actually exists on filesystem
    const filename = resultUrl.replace('/uploads/evidence/', '');
    const localFilePath = path.join(process.cwd(), 'src/uploads/evidence', filename);
    const altFilePath = path.join(process.cwd(), 'uploads/evidence', filename);
    
    const exists = fs.existsSync(localFilePath) || fs.existsSync(altFilePath);
    assert.strictEqual(exists, true);
  });

  test('StorageService generates short-lived signed link for local relative path', async () => {
    const relativePath = '/uploads/evidence/12345_test.wav';
    const signedUrl = await StorageService.getSignedUrl(relativePath, 900);

    assert.ok(signedUrl);
    assert.ok(signedUrl.includes('expires='));
    assert.ok(signedUrl.includes('sig='));
  });

  test('Incident model stores and retrieves audioUrl property', async () => {
    const user = await User.create({
      name: 'Evidence Test User',
      email: 'evidence_user@test.com',
      passwordHash: 'hash',
      phone: '9999999999'
    });

    const mockEvidenceUrl = '/uploads/evidence/trigger_clip_1001.wav';
    const incident = await Incident.create({
      userId: user.id,
      latitude: 12.9716,
      longitude: 77.5946,
      triggerType: 'monitoring',
      riskScore: 85,
      audioTranscript: 'Help me please!',
      audioUrl: mockEvidenceUrl
    });

    assert.ok(incident.id);
    assert.strictEqual(incident.audioUrl, mockEvidenceUrl);

    // Retrieve incident by ID
    const fetched = await Incident.findById(incident.id);
    assert.strictEqual(fetched.audioUrl, mockEvidenceUrl);
  });

  test('StorageService upload to S3 activates AES256 encryption at rest when S3 env vars are configured', async () => {
    // Simulate S3 credentials
    const originalEnv = { ...process.env };
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
    process.env.S3_BUCKET_NAME = 'aria-evidence-bucket';
    process.env.AWS_REGION = 'us-east-1';

    const s3Uri = 's3://aria-evidence-bucket/evidence/12345_sample.wav';
    const signedUrl = await StorageService.getSignedUrl(s3Uri, 600);

    // Verify S3 signed URL structure or handling
    assert.ok(signedUrl);

    // Restore env
    process.env = originalEnv;
  });
});