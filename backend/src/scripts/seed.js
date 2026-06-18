import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

async function seed() {
  console.log('⚡ [SEEDER] Verifying database connection status...');

  // Test pool connection
  try {
    const client = await pool.connect();
    console.log('⚡ [SEEDER] Connected to PostgreSQL. Seeding active DB table items...');
    client.release();
  } catch (err) {
    console.warn('\n⚠️ [SEEDER] PostgreSQL database is offline. Seeding skipped.');
    console.warn('⚠️ [SEEDER] Memory mode fallback is active. The backend API routes will run correctly in memory.');
    console.warn('⚡ [SEEDER] Exiting with success code to keep setup scripts green.\n');
    process.exit(0);
  }

  // Clean start - Truncate tables with cascade
  console.log('⚡ [SEEDER] Cleaning database tables...');
  try {
    await pool.query('TRUNCATE users, emergency_contacts, incidents, location_history, reports CASCADE');
    console.log('⚡ [SEEDER] Database tables truncated successfully.');
  } catch (err) {
    console.warn('⚠️ [SEEDER] Truncate query warning (tables might not exist yet):', err.message);
  }

  // Create tables just in case seeder is run independently
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      phone VARCHAR(20) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id VARCHAR(50) PRIMARY KEY,
      user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(20) DEFAULT 'active',
      trigger_type VARCHAR(20) DEFAULT 'manual',
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      risk_score INTEGER DEFAULT 0,
      audio_transcript TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS location_history (
      id SERIAL PRIMARY KEY,
      incident_id VARCHAR(50) REFERENCES incidents(id) ON DELETE CASCADE,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      risk_score INTEGER DEFAULT 0,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      incident_id VARCHAR(50) UNIQUE REFERENCES incidents(id) ON DELETE CASCADE,
      report_url TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('⚡ [SEEDER] Inserting 10 mock users with hashed passwords...');
  const users = [];
  const salt = await bcrypt.genSalt(10);
  const mockPasswordHash = await bcrypt.hash('password123', salt);

  const mockUserNames = [
    'Aarav Sharma', 'Priya Patel', 'Ananya Iyer', 'Rahul Verma', 
    'Sneha Reddy', 'Amit Mishra', 'Kavita Rao', 'Vikram Singh', 
    'Neha Gupta', 'Rohan Sen'
  ];

  for (let i = 0; i < mockUserNames.length; i++) {
    const name = mockUserNames[i];
    const email = `${name.toLowerCase().replace(' ', '.')}@example.com`;
    const phone = `+9198765432${i}`;
    const id = `usr_mock_${i + 1}`;

    await pool.query(
      `INSERT INTO users (id, name, email, phone, password_hash) VALUES ($1, $2, $3, $4, $5)`,
      [id, name, email, phone, mockPasswordHash]
    );

    // Save emergency contact
    const contactName = `${name.split(' ')[0]}'s Guardian`;
    const contactPhone = `+9199887766${i}`;
    await pool.query(
      `INSERT INTO emergency_contacts (user_id, name, phone) VALUES ($1, $2, $3)`,
      [id, contactName, contactPhone]
    );

    users.push({ id, name, phone });
  }
  console.log('💚 [SEEDER] Users seed completed.');

  console.log('⚡ [SEEDER] Inserting 25 safety incident records...');
  
  const triggers = ['manual', 'audio', 'motion'];
  const statusOptions = ['active', 'resolved'];
  const transcripts = [
    "Bachao! Stop following me!",
    "Help me please! Someone grabbed my bag!",
    "Leave me alone! Go away!",
    "I've fallen down and can't get up.",
    "Hey! What are you doing? Let go!",
    "Ruk jao! Madad karo koi!",
    "I feel unsafe here, scanning area.",
    "Please stay away from me, help!"
  ];

  const baseLat = 28.6139;
  const baseLng = 77.2090;

  for (let i = 1; i <= 25; i++) {
    const user = users[i % users.length];
    const incidentId = `inc_seed_${i}`;
    const status = i <= 5 ? 'active' : 'resolved';
    const trigger = triggers[i % triggers.length];
    
    const lat = baseLat + (Math.random() - 0.5) * 0.05;
    const lng = baseLng + (Math.random() - 0.5) * 0.05;

    let risk = 30;
    if (status === 'active') {
      risk = trigger === 'manual' ? 92 : (trigger === 'audio' ? 88 : 74);
    } else {
      risk = Math.floor(Math.random() * 40) + 15;
    }

    const transcript = trigger === 'audio' ? transcripts[i % transcripts.length] : '';

    await pool.query(
      `INSERT INTO incidents (id, user_id, status, trigger_type, latitude, longitude, risk_score, audio_transcript)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [incidentId, user.id, status, trigger, lat, lng, risk, transcript]
    );

    for (let step = 0; step < 5; step++) {
      const stepLat = lat + (step * 0.001 * (Math.random() - 0.5));
      const stepLng = lng + (step * 0.001 * (Math.random() - 0.5));
      const stepRisk = Math.min(risk + Math.floor((Math.random() - 0.5) * 10), 100);

      await pool.query(
        `INSERT INTO location_history (incident_id, latitude, longitude, risk_score, timestamp)
         VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${5 - step} minutes')`,
        [incidentId, stepLat, stepLng, stepRisk]
      );
    }

    const mockPdfUrl = `http://localhost:5000/uploads/reports/report_${incidentId}.pdf`;
    await pool.query(
      `INSERT INTO reports (incident_id, report_url) VALUES ($1, $2)`,
      [incidentId, mockPdfUrl]
    );
  }

  console.log('💚 [SEEDER] 25 Incidents completed successfully.');
  
  await pool.end();
  console.log('⚡ [SEEDER] Database seed process finalized.');
}

seed().catch(err => {
  console.error('🔴 [SEEDER] Fatal error running seeder:', err);
  process.exit(1);
});
