import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure environment variables are loaded from root or backend .env
dotenv.config();
const rootEnv = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}
const backendEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
}

/**
 * Validates critical environment variables.
 * In production mode, refuses to start if BACKEND_URL is missing or points to localhost.
 */
export function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!process.env.JWT_SECRET) {
    console.error('\n🔴 [STARTUP ERROR] JWT_SECRET environment variable is missing.');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('\n🔴 [STARTUP ERROR] DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  if (isProduction) {
    const backendUrl = (process.env.BACKEND_URL || process.env.APP_URL || '').trim();

    if (!backendUrl) {
      console.error('\n🔴 [FATAL STARTUP ERROR] BACKEND_URL environment variable is missing in production.');
      console.error('   Every public link (PDF reports, evidence uploads) must resolve to your live deployed domain.');
      console.error('   Server refusing to start.\n');
      process.exit(1);
    }

    const lowerUrl = backendUrl.toLowerCase();
    if (lowerUrl.includes('localhost') || lowerUrl.includes('127.0.0.1')) {
      console.error(`\n🔴 [FATAL STARTUP ERROR] BACKEND_URL cannot point to localhost in production: "${backendUrl}".`);
      console.error('   Please configure your live server URL (e.g. https://aria-backend-2e96.onrender.com).');
      console.error('   Server refusing to start.\n');
      process.exit(1);
    }

    if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
      console.error(`\n🔴 [FATAL STARTUP ERROR] BACKEND_URL must start with http:// or https://: "${backendUrl}".`);
      console.error('   Server refusing to start.\n');
      process.exit(1);
    }
  }
}

/**
 * Returns the resolved public backend base URL.
 * Strictly prefers BACKEND_URL environment variable.
 */
export function getBackendUrl(req = null) {
  // 1. Primary: configured BACKEND_URL or APP_URL environment variable
  const envUrl = process.env.BACKEND_URL || process.env.APP_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }

  // 2. Secondary: request headers if incoming HTTP request exists
  if (req) {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('host');
    if (host) return `${proto}://${host}`;
  }

  // 3. In production, fail hard if not configured
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[FATAL] BACKEND_URL environment variable is required in production.');
  }

  // 4. Development fallback
  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
}

/**
 * Builds an absolute public URL pointing to a backend resource path.
 * Ensures no accidental double slashes or undefined roots.
 */
export function buildBackendUrl(subpath = '', req = null) {
  const base = getBackendUrl(req);
  const cleanPath = subpath.startsWith('/') ? subpath : `/${subpath}`;
  return `${base}${cleanPath}`;
}
