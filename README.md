🆘 ARIA: AI Real-time Incident Assistant
An AI-powered personal safety platform that detects, analyzes, and responds to emergency situations in real time.
ARIA helps individuals quickly alert emergency services during dangerous situations, such as being threatened, followed, harassed, or abducted, while automatically generating actionable intelligence for first responders.

🚨 The Problem
When someone is in danger, every second counts, but most safety apps stop at "send an alert." They don't tell responders what's happening, how serious it is, or where to look. ARIA closes that gap by combining real-time location tracking, audio evidence capture, and AI-driven threat analysis into a single incident pipeline that flows straight to a police dispatch dashboard.

✨ What ARIA Does
Capability	Description
🔴 SOS Trigger	Manual or automatic emergency activation from the mobile app
📍 Live GPS Tracking	Real-time location streaming during an active incident
🎙️ Audio Evidence Capture	Records and securely transmits audio for analysis
🧠 AI Threat Analysis	Transcribes speech (Whisper) and analyzes tone & context
📊 Risk Scoring	Generates a real-time risk score for prioritizing response
🚓 Police Dispatch Dashboard	Live view of incidents, locations, and risk levels for responders
📄 Incident Dossier (PDF)	Auto-generated, police-ready report with evidence and transcript
🛣️ Safe Ride Mode	Passive monitoring during commutes or rideshares

🧩 How It Works
 User in Danger
       │
       ▼
 1. SOS Triggered (manual / automatic)
       │
       ▼
 2. GPS Coordinates Captured
       │
       ▼
 3. Audio Evidence Recorded → sent to AI Engine
       │
       ▼
 4. AI Engine generates:
       • Transcript
       • Risk Score
       • Threat Context
       │
       ▼
 5. Backend creates & stores Incident
       │
       ▼
 6. Incident emitted via Socket.IO (real-time)
       │
       ▼
 7. Police Dashboard receives live update
       │
       ▼
 8. PDF Incident Dossier generated for responders

🏗️ System Architecture
ARIA is built as four cooperating services:
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   User App        │◄────►│   Backend API     │◄────►│   AI Engine        │
│  (React + Vite)    │      │ (Node.js/Express)  │      │ (Python/FastAPI)    │
└──────────────────┘      └──────────────────┘      └──────────────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │ Police Dashboard   │
                          │  (React + Vite)     │
                          └──────────────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │ Neon PostgreSQL     │
                          └──────────────────┘

1. Frontend: User App
	• Stack: React, Vite, TypeScript, Socket.IO Client, Axios
	• Screens: Home Dashboard, Monitor, Safe Ride, Logs, Contacts, Profile
	• Responsibilities: authentication, SOS activation, live GPS, incident history, contacts & profile management
	• Deployment: Vercel
2. Backend API Server
	• Stack: Node.js, Express.js, Socket.IO, PostgreSQL, JWT, Multer
	• Responsibilities: authentication, incident management, police-facing APIs, report generation, GPS streaming, real-time socket events
	• Deployment: Render
3. AI Engine
	• Stack: Python, FastAPI, OpenAI Whisper, custom risk-scoring & context/tone analysis models
	• Responsibilities: audio transcription, threat detection, contextual risk scoring, incident intelligence generation
	• Deployment: Render
4. Police Dispatch Dashboard
	• Stack: React, Vite, Socket.IO Client, Axios
	• Responsibilities: live incident monitoring, risk score visibility, GPS tracking, report generation, incident resolution
	• Auth: X-Police-API-Key header
	• Deployment: Vercel
Database
	• Provider: Neon PostgreSQL
	• Core tables: users, incidents, reports, plus supporting operational entities
Real-Time Layer
	• Technology: Socket.IO
	• Purpose: live incident creation, GPS updates, and instant dashboard synchronization between the user app, backend, and police dashboard

🔐 Security & Reliability
	• JWT-based authentication on all sensitive routes (profile, incident creation, report generation)
	• API key authentication for the police dispatch dashboard
	• No hardcoded localhost URLs, fully environment-aware via BACKEND_URL / VITE_API_URL
	• No fake GPS data: real coordinates only, with 0,0 as an explicit "unavailable" fallback (never a fabricated default location)
	• HTTPS-compatible geolocation handling with graceful error states

⚙️ Environment Variables
Backend
DATABASE_URL
JWT_SECRET
AI_ENGINE_URL
BACKEND_URL
POLICE_API_KEY
Frontend (User App)
VITE_API_URL
Police Dashboard
VITE_API_URL
VITE_SOCKET_URL
VITE_POLICE_API_KEY
	⚠️ Vite only exposes variables prefixed with VITE_ to the client bundle.

🚀 Deployment
Component	Platform
User App	Vercel
Police Dashboard	Vercel
Backend API	Render
AI Engine	Render
Database	Neon PostgreSQL
Live backend: https://aria-backend-2e96.onrender.com
Health checks:
GET /health
GET /api/health

📄 Incident Dossier (PDF Reports)
Every incident can generate a structured, police-ready PDF containing:
	• User information
	• Incident details & timestamps
	• GPS coordinates
	• AI-generated risk score
	• Full audio transcript
	• Links to evidence
All generated links use the BACKEND_URL environment variable, with no localhost references shipped to production.

🛠️ Tech Stack Summary
Layer	Technologies
Frontend	React, Vite, TypeScript, Socket.IO Client, Axios
Backend	Node.js, Express.js, Socket.IO, PostgreSQL, JWT, Multer
AI Engine	Python, FastAPI, Whisper, custom risk/context/tone models
Database	Neon PostgreSQL
Hosting	Vercel (frontends), Render (backend & AI engine)

🗺️ Roadmap
	• [ ] Wearable device integration for hands-free SOS
	• [ ] Multi-language support for AI transcription & analysis
	• [ ] Offline-first SOS queuing for low-connectivity areas
	• [ ] Trusted contact escalation chains
	• [ ] Expanded analytics for police dashboard (heatmaps, incident trends)

🤝 Why ARIA Matters
Personal safety apps are common; real-time, AI-analyzed, responder-ready intelligence is not. ARIA isn't just an alarm button; it's a pipeline that turns a moment of crisis into structured, actionable information for the people who can actually help, delivered in seconds.

📬 Contact
For questions, demos, or collaboration inquiries, please reach out via the repository's issues page or the contact details provided in our submission.

