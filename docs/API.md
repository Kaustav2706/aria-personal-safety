# ARIA Platform API Documentation

This document describes the API interface specs, request parameters, response envelopes, and WebSocket events for the ARIA public safety platform.

---

## Authentication Endpoints

### 1. Register User
* **Method**: `POST`
* **Route**: `/api/auth/register`
* **Content-Type**: `application/json`
* **Payload**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+919876543210",
  "password": "secure_password",
  "emergencyContacts": [
    { "name": "Guardian A", "phone": "+919988776655" }
  ]
}
```
* **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Registration successful",
  "token": "eyJhbGciOi...",
  "user": {
    "id": "usr_abc123",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+919876543210",
    "emergencyContacts": [
      { "name": "Guardian A", "phone": "+919988776655" }
    ],
    "createdAt": "2026-06-12T19:10:25Z"
  }
}
```

### 2. User Login
* **Method**: `POST`
* **Route**: `/api/auth/login`
* **Payload**:
```json
{
  "email": "jane@example.com",
  "password": "secure_password"
}
```
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOi...",
  "user": {
    "id": "usr_abc123",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+919876543210",
    "emergencyContacts": [
      { "name": "Guardian A", "phone": "+919988776655" }
    ]
  }
}
```

---

## Profile Endpoints

### 3. Fetch Profile Info
* **Method**: `GET`
* **Route**: `/api/user/profile`
* **Headers**: `Authorization: Bearer <token>`
* **Response (200 OK)**:
```json
{
  "success": true,
  "user": {
    "id": "usr_abc123",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+919876543210",
    "emergencyContacts": [
      { "name": "Guardian A", "phone": "+919988776655" }
    ]
  }
}
```

---

## Incidents & SOS Endpoints

### 4. Initiate Incident (Optional Audio file)
* **Method**: `POST`
* **Route**: `/api/incidents/create`
* **Headers**: `Authorization: Bearer <token>`
* **Content-Type**: `multipart/form-data`
* **Payload Fields**:
  - `file`: WAV/MP3 file (optional audio upload evidence)
  - `latitude`: `28.6139`
  - `longitude`: `77.2090`
  - `triggerType`: `audio` (options: `manual`, `audio`, `motion`)
  - `isIsolated`: `true` (optional boolean string)
* **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Incident registered and safety protocols deployed",
  "incident": {
    "id": "inc_xyz789",
    "userId": "usr_abc123",
    "status": "active",
    "triggerType": "audio",
    "latitude": 28.6139,
    "longitude": 77.2090,
    "riskScore": 88,
    "audioTranscript": "Help me please, stop it!",
    "createdAt": "2026-06-12T19:12:00Z"
  }
}
```

### 5. Trigger SOS (Direct parameters)
* **Method**: `POST`
* **Route**: `/api/alerts/sos`
* **Headers**: `Authorization: Bearer <token>`
* **Payload**:
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "triggerType": "manual",
  "riskScore": 92,
  "audioTranscript": "SOS Alert Triggered"
}
```
* **Response (201 Created)**:
```json
{
  "success": true,
  "message": "SOS trigger processed and emergency alerts dispatched",
  "incident": {
    "id": "inc_xyz789",
    "status": "active",
    "triggerType": "manual",
    "latitude": 28.6139,
    "longitude": 77.2090,
    "riskScore": 92,
    "audioTranscript": "SOS Alert Triggered",
    "createdAt": "2026-06-12T19:12:00Z"
  }
}
```

### 6. Update Tracker Coordinates
* **Method**: `POST`
* **Route**: `/api/location/update`
* **Headers**: `Authorization: Bearer <token>`
* **Payload**:
```json
{
  "incidentId": "inc_xyz789",
  "latitude": 28.6145,
  "longitude": 77.2102,
  "riskScore": 94
}
```
* **Response (200 OK)**:
```json
{
  "success": true,
  "message": "GPS location coordinates updated",
  "incident": {
    "id": "inc_xyz789",
    "latitude": 28.6145,
    "longitude": 77.2102,
    "riskScore": 94
  }
}
```

---

## WebSocket Events Specs (Socket.io)

### Client Emissions
* `joinIncidentRoom({ incidentId })`: Connects client socket to the incident coordinate stream room.
  - *Returns acknowledgement*: `{ success: true, message: "..." }`
* `leaveIncidentRoom({ incidentId })`: disconnects/removes socket from the stream room.
  - *Returns acknowledgement*: `{ success: true }`
* `locationUpdate({ incidentId, latitude, longitude, riskScore })`: Streams location coordinate track data in real time.
  - *Returns acknowledgement*: `{ success: true }`

### Server Broadcasts
* `incidentCreated(incident)`: Sent globally to notify dispatchers of new alarms.
* `locationUpdate(data)`: Sent to a specific room with updated coordinates `{ incidentId, latitude, longitude, riskScore, timestamp }`.
* `incidentResolved({ incidentId })`: Sent globally and to the room to signal emergency closure.

---

## AI Engine Endpoints (FastAPI)

### 7. Analyze Audio Evidence
* **Method**: `POST`
* **Route**: `http://localhost:8000/analyze`
* **Content-Type**: `multipart/form-data`
* **Payload Fields**:
  - `file`: UploadFile (WAV stream)
  - `latitude`: `28.6139`
  - `longitude`: `77.2090`
  - `is_isolated`: `true`
  - `motion_anomaly`: `false`
  - `timestamp`: `2026-06-12T19:10:25Z`
* **Response (200 OK)**:
```json
{
  "distress": true,
  "confidence": 91.0,
  "transcript": "Help me please, stop!",
  "riskScore": 80
}
```
