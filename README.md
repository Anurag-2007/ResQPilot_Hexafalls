# 🚑 ResQPilot – AI-Powered Emergency Response & Intelligent Hospital Triage Platform

<p align="center">

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-Backend-000000?style=for-the-badge&logo=express)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-010101?style=for-the-badge&logo=socketdotio)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Mongoose](https://img.shields.io/badge/Mongoose-ODM-880000?style=for-the-badge)
![Google GenAI](https://img.shields.io/badge/Google-GenAI-4285F4?style=for-the-badge&logo=google)
![Vercel](https://img.shields.io/badge/Vercel-Frontend-000000?style=for-the-badge&logo=vercel)
![Render](https://img.shields.io/badge/Render-Backend-46E3B7?style=for-the-badge&logo=render)

</p>

---

# Executive Summary

**ResQPilot** is an AI-driven emergency response and hospital triage platform designed to minimise treatment delays during medical emergencies by intelligently connecting citizens with healthcare providers in real time.

Traditional emergency workflows rely heavily on manual communication, fragmented patient information, and delayed hospital notifications. These inefficiencies often consume the critical **golden hour**, significantly affecting patient outcomes.

ResQPilot transforms this process through:

- 🤖 LM and SVM model based emergency assessment
- 🎙️ Voice-driven symptom collection
- 📍 Real-time GPS-based hospital routing
- ⚡ Live WebSocket communication for instant updates
- 🏥 Instant hospital notification dashboards
- 🚑 Instant Ambulance notification dashboard with fastest route navigation to Patient's real time location
- 🧠 Intelligent triage prioritisation
- 📊 Persistent emergency records

Instead of waiting until a patient reaches the hospital, medical teams receive structured emergency information instantly, allowing preparation before arrival and significantly reducing response latency.

---

# 🚀 Value Proposition

ResQPilot bridges the communication gap between citizens and hospitals by providing:

-  LM and SVM model powered emergency severity assessment
- Intelligent hospital recommendation
- Real-time emergency broadcasting
- Automated patient queue creation
- Persistent medical event logging
- Reduced emergency admission time
- Improved hospital resource utilization
- Faster clinical decision support
- Better Healthcare support for public

---

# 🛠 Comprehensive Tech Stack

## Frontend

| Technology | Purpose |
|------------|----------|
| React (Vite) | Component-based SPA |
| Tailwind CSS | Responsive UI styling |
| Socket.IO Client | Real-time communication via websockets |
| Google GenAI SDK | AI conversation, voice understanding & triage assistance |
| Browser Geolocation API | Live GPS coordinates |
| Web Speech API | Voice capture & transcription |

---

## Backend

| Technology | Purpose |
|------------|----------|
| Node.js | Runtime environment |
| Express.js | REST API server |
| Socket.IO | Real-time event logging & broadcasting |
| Mongoose | MongoDB Object Document Mapper |
| MongoDB Atlas | Cloud database for storage of patient data |
| Async/Await | Non-blocking database operations |

---

## Database

### MongoDB Atlas

Database:

```
resqpilot
```

Primary Collection:

```
patients
```

Stores:

- Patient details
- Emergency requests
- Symptoms
- AI-generated triage score
- GPS coordinates
- Hospital assignment
- Queue status
- Emergency timestamps

---

## Deployment

| Layer | Platform |
|--------|----------|
| Frontend | Vercel |
| Backend | Render |
| Database | MongoDB Atlas |

---

# 🏗 System Architecture

```
                     Citizen Portal
                           │
                           │
                 React + Tailwind UI
                           │
                 Socket.IO Client
                           │
────────────────────────────────────────────────────
                    WebSocket Layer
────────────────────────────────────────────────────
                           │
                     Node.js Backend
                           │
            ┌──────────────┴──────────────┐
            │                             │
      Google GenAI                 Socket.IO Server
     Speech to text                  Broadcast
            │                             │
            └──────────────┬──────────────┘
                           │
                    Mongoose ODM
                           │
                 MongoDB Atlas Database
              resqpilot.patients Collection
                           │
Hospital Dashboard Clients + Ambulance Dashboard portal
                           │
             Live Emergency Queue Management
```

---

# 🔄 Technical Data Flow

## 1. Emergency Trigger

The citizen initiates an emergency request through the React-based Citizen Portal by selecting the patient profile from the secure family vault.

The application automatically retrieves:

- Patient demographics
- Medical history
- Emergency contacts
- Existing conditions

---

## 2. AI Symptom Assessment

The citizen can either:

- speak naturally,
- type symptoms,
- or answer guided questions.

Voice input is processed using speech recognition before being analysed through the Google GenAI SDK.

The AI extracts:

- primary symptoms
- possible medical condition
- severity indicators
- recommended urgency level

---

## 3. GPS Acquisition

The browser Geolocation API captures:

```
Latitude
Longitude
Accuracy
Timestamp
```

These coordinates are attached to the emergency request.

---

## 4. WebSocket Transport

Once validated, the frontend emits a Socket.IO event.

Example:

```javascript
socket.emit("newEmergency", emergencyPayload);
```

Unlike REST polling, WebSockets maintain a persistent duplex connection, enabling hospitals to receive emergency alerts immediately without repeatedly querying the server.

---

## 5. Backend Processing

Express receives the incoming emergency payload.

Backend responsibilities include:

- payload validation
- AI metadata attachment
- hospital recommendation
- timestamp generation
- queue creation
- event broadcasting

---

## 6. Asynchronous MongoDB Persistence

Using Mongoose, the emergency request is asynchronously persisted into MongoDB Atlas.

```javascript
await Patient.create(emergencyPayload);
```

Stored in:

```
resqpilot.patients
```

Each document contains:

- Patient Profile
- Symptoms
- AI Triage Score
- Coordinates
- Queue Position
- Hospital Assignment
- Status
- Emergency Timestamp

Asynchronous persistence ensures that incoming emergency requests do not block concurrent connections, allowing the backend to remain responsive even under high request volumes.

---

## 7. Broadcast Routing

Following successful persistence, Socket.IO broadcasts the event to subscribed hospital terminals.

```javascript
io.emit("incomingEmergency", emergencyData);
```

Every connected hospital dashboard immediately receives:

- incoming patient
- AI severity score
- live location
- ETA
- queue priority
- medical notes

without requiring any page refresh.

---

# 👤 Step-by-Step User Flow

## Step 1 — Family Vault Selection

The citizen opens ResQPilot and selects the patient profile from the secure Family Vault.

Profiles may include:

- Self
- Parent
- Child
- Guardian

This eliminates manual data entry during emergencies.

---

## Step 2 — Emergency Assessment

The application begins a guided emergency assessment.

The user may:

- describe symptoms
- answer AI-generated questions
- provide additional medical context

---

## Step 3 — AI Voice Transcription

If voice mode is selected:

1. Speech is captured.
2. Converted into text.
3. Processed by Google GenAI.
4. Structured symptoms are extracted.
5. Severity score is generated.

This significantly reduces interaction time during stressful situations.

---

## Step 4 — GPS Coordination

The system automatically retrieves the patient's live location.

Location data is used to:

- identify nearby hospitals
- estimate travel time
- optimise routing
- prioritise emergency dispatch

---

## Step 5 — Intelligent Hospital Routing

The backend evaluates available hospitals using:

- distance
- emergency capacity
- queue load
- department availability
- AI triage priority

The optimal hospital is automatically selected.

---

## Step 6 — Hospital Queue Creation

A new emergency queue entry is generated.

Hospital staff instantly view:

- Patient identity
- AI assessment
- Symptoms
- Arrival estimate
- Queue priority
- Medical history

Preparation can begin before patient arrival.

---

## Step 7 — Live Monitoring

Throughout the emergency lifecycle:

- queue updates
- patient status
- hospital acknowledgements
- arrival confirmations

are synchronised across all connected clients using WebSockets.

---

# 📈 Key Impacts & Performance Metrics

## 🕒 Golden-Hour Response Optimisation

Traditional emergency workflows often delay treatment due to repeated information collection and manual hospital communication.

ResQPilot digitises the complete emergency intake process, enabling hospitals to begin preparation before the patient arrives and helping maximise the effectiveness of the critical golden hour.

---

## 🤖 Automated AI Triage Scoring

The integrated AI engine analyses:

- symptoms
- spoken descriptions
- medical context
- urgency indicators

to generate a structured triage score that assists healthcare professionals in prioritising incoming cases more efficiently.

---

## 📍 Spatial Hospital Routing

ResQPilot applies the **Haversine distance formula** to calculate the shortest geographical distance between the patient's current GPS coordinates and nearby healthcare facilities.

Routing decisions can additionally consider:

- available beds
- department availability
- queue length
- emergency capacity
- AI severity level

to recommend the most suitable destination rather than simply the nearest hospital.

---

## ⚡ Real-Time Emergency Broadcasting

Persistent WebSocket connections eliminate polling delays by instantly broadcasting emergency events to connected hospital terminals, enabling immediate awareness and coordinated response.

---

## 🗄 Reliable Emergency Persistence

Every emergency request is securely stored in MongoDB Atlas using asynchronous Mongoose operations, creating a durable record for clinical review, analytics, and future audit requirements.

---

# 🔒 Core Features

- AI-powered emergency assessment
- Voice-to-text symptom reporting
- Family medical vault
- Real-time WebSocket communication
- Intelligent hospital routing
- GPS-based emergency localisation
- Live hospital dashboards
- Automated triage scoring
- Queue management
- MongoDB Atlas persistence
- Cloud-native deployment
- Scalable event-driven architecture

---

# 🌍 Vision

ResQPilot aims to modernise emergency healthcare by combining artificial intelligence, real-time communication, and cloud-native architecture into a unified platform that accelerates emergency response, improves hospital preparedness, and ultimately contributes to better patient outcomes when every second matters.
