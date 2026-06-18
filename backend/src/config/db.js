import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Validate startup environment variables
if (!process.env.JWT_SECRET) {
  console.error('\n🔴 [STARTUP ERROR] JWT_SECRET environment variable is missing.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('\n🔴 [STARTUP ERROR] DATABASE_URL environment variable is missing.');
  process.exit(1);
}

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

      CREATE TABLE IF NOT EXISTS monitoring_sessions (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active'
      );
    `);
    
    console.log('💚 [POSTGRESQL DB] Database schema migration executed successfully.');
    client.release();
  } catch (error) {
    console.warn('\n⚠️ [POSTGRESQL DB] Connection/Migration failed. Switching to IN-MEMORY FALLBACK ADAPTER.');
    dbMode = 'memory';
  }
}
