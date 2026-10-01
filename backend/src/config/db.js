import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE_PATH = path.join(__dirname, '../../memory_db.json');

// Load environment variables from cwd, backend/.env, or root .env
dotenv.config();
const rootEnv = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}
const backendEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
}

// Centralized persistent memory cache fallback storage
export const memoryStore = {
  users: [],
  contacts: [],
  incidents: [],
  locationHistory: [],
  sessions: [],
  authSessions: []
};

export function saveMemoryStore() {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(memoryStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('⚠️ [MEMORY DB] Failed to save memory store to file:', err.message);
  }
}

export function loadMemoryStore() {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const data = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      memoryStore.users = parsed.users || [];
      memoryStore.contacts = parsed.contacts || [];
      memoryStore.incidents = parsed.incidents || [];
      memoryStore.locationHistory = parsed.locationHistory || [];
      memoryStore.sessions = parsed.sessions || [];
    memoryStore.authSessions = parsed.authSessions || [];
      console.log('💚 [MEMORY DB] Successfully loaded persistent local data.');
    }
  } catch (err) {
    console.error('⚠️ [MEMORY DB] Failed to load memory store from file:', err.message);
  }
}

import { validateEnvironment } from './env.js';

// Validate startup environment variables (JWT_SECRET, DATABASE_URL, and production BACKEND_URL)
validateEnvironment();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Flag to coordinate fallback storage if local database is blocked/offline
export let dbMode = 'postgres';

export async function initializeDatabase() {
  try {
    const client = await pool.connect();
    console.log('💚 [POSTGRESQL DB] Connected to database successfully.');
    
    // Create tables if they do not exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Idempotent migration: add role column to existing databases
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='role'
        ) THEN
          ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';
        END IF;
      END $$;

      -- Idempotent migration: add language column (BCP-47 code, e.g. 'hi', 'en')
      -- Used to pass an explicit language hint to Whisper instead of auto-detecting
      -- on short audio clips, which is unreliable. Defaults to 'hi' (ARIA's primary locale).
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='language'
        ) THEN
          ALTER TABLE users ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'hi';
        END IF;
      END $$;

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

      CREATE TABLE IF NOT EXISTS monitoring_sessions (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS auth_sessions (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash VARCHAR(64) UNIQUE NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        last_used_at TIMESTAMP,
        revoked_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);
      CREATE INDEX IF NOT EXISTS auth_sessions_refresh_token_hash_idx ON auth_sessions(refresh_token_hash);
    `);
    
    console.log('💚 [POSTGRESQL DB] Database schema migration executed successfully.');
    client.release();
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      // In production a safety-critical service MUST NOT silently continue
      // without its database. Ephemeral disks (e.g. Render free tier) wipe
      // every local file on restart, so the file-based fallback would cause
      // permanent, silent data loss. Crash loudly so the platform restarts
      // the container and alerts on-call responders.
      console.error('\n🔴 [FATAL] PostgreSQL is unreachable in production. Refusing to start.');
      console.error('   Cause:', error.message);
      console.error('   Fix:   Ensure DATABASE_URL is correct and the database is accepting connections.');
      process.exit(1);
    }

    // Development-only fallback: in-memory store backed by a local JSON file.
    // This is intentionally NOT available in production (see above).
    console.warn('\n⚠️ [POSTGRESQL DB] Connection/Migration failed.');
    console.warn('   Running in IN-MEMORY FALLBACK mode (development only).');
    console.warn('   ⚠️  All data will be lost on restart. Set NODE_ENV=production to disable this fallback.\n');
    dbMode = 'memory';
    loadMemoryStore();
  }
}

/**
 * Returns the current storage mode and a human-readable description.
 * Intended for use by the /health endpoint so the mode is observable externally.
 */
export function getHealthStatus() {
  return {
    dbMode,
    dbModeDescription:
      dbMode === 'postgres'
        ? 'Connected to PostgreSQL'
        : 'IN-MEMORY FALLBACK (development only – data is not persisted)',
  };
}
