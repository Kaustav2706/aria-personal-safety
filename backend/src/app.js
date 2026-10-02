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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  }
});

const PORT = process.env.PORT || 5000;

// Enable JSON parsing and CORS
app.use(cors());
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

// Serve local uploads folder statically for evidence audio uploads
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
