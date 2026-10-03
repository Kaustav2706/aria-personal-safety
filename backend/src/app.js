import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import and trigger environment variable validation & DB init
import { validateEnvironment } from './config/env.js';
import { initializeDatabase, getHealthStatus } from './config/db.js';

validateEnvironment();

// Routes imports
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import incidentRoutes from './routes/incident.routes.js';
import reportRoutes, { handleLegacyReportDownload } from './routes/report.routes.js';
import alertRoutes from './routes/alert.routes.js';
import monitoringRoutes from './routes/monitoring.routes.js';
import policeRoutes from './routes/police.routes.js';
import evidenceRoutes from './routes/evidence.routes.js';

// Sockets and Middleware imports
import { setupLiveTracking } from './sockets/liveTracking.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AIService } from './services/aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const rootEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}
const backendEnv = path.resolve(__dirname, '../.env');
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
}

// ── Explicit CORS Origins ───────────────────────────────────────────────────
// Restricts API and WebSocket live feed access to the two authorized frontends
// (User Web App and Police Dispatcher Dashboard), read from ALLOWED_ORIGINS
// so staging and production configurations can differ securely.
const defaultAllowedOrigins = [
  'http://localhost:5173', // ARIA User Frontend (Vite default)
  'http://localhost:3000', // Police Dispatcher Dashboard (Vite port 3000)
  'http://localhost:5174', // Alternative Vite local dev port
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5174'
];

const envOrigins = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const allowedOrigins = envOrigins.length > 0 ? envOrigins : defaultAllowedOrigins;

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Internal-Secret']
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;

// Enable JSON parsing and restricted CORS
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  res.on('finish', () => {
    console.log(`[RESPONSE] ${req.method} ${req.url} -> ${res.statusCode}`);
  });
  next();
});

// Dynamic on-demand report generation for legacy URLs so ephemeral disk wipe never causes 404s
app.get('/uploads/reports/:filename', handleLegacyReportDownload);

// Protect audio evidence files from direct unauthenticated static access (require short-lived signed links)
app.use('/uploads/evidence', (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Direct access forbidden. Evidence audio must be accessed through short-lived signed links.',
    error: 'Forbidden'
  });
});

// Serve local uploads folder statically for public assets/reports
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Save socket.io instance to context
app.set('io', io);

// Mount routes matching requirements
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', alertRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/police', policeRoutes);
app.use('/api/evidence', evidenceRoutes);

// Base route for health checks
app.get('/health', (req, res) => {
  const { dbMode, dbModeDescription } = getHealthStatus();
  res.status(200).json({
    success: true,
    status: 'ONLINE',
    service: 'ARIA Backend Server',
    dbMode,
    dbModeDescription,
  });
});

app.get('/api/health', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { dbMode, dbModeDescription } = getHealthStatus();
  const ai = await AIService.checkHealth();
  res.status(200).json({ success: true, status: 'ONLINE', service: 'ARIA Backend Server', dbMode, dbModeDescription, ai });
});

// Setup socket connection handlers
setupLiveTracking(io);

// Global Error Handler Middleware
app.use(errorHandler);

// Boot sequence: Initialize database first, then start listener
async function boot() {
  await initializeDatabase();
  
  server.listen(PORT, () => {
    const activeUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`;
    console.log(`\n==========================================`);
    console.log(`🚀 ARIA Backend Server is running live on:`);
    console.log(`   Base URL: ${activeUrl}`);
    console.log(`==========================================\n`);
  });
}

boot();

export default app;
