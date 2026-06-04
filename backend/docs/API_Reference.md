# Backend API Reference

This document outlines the core API endpoints exposed by the Ifrit FastAPI backend. The API handles IoT sensor ingestion, computer vision inferences, authentication, and WebSocket-based real-time communication.

## Base URL
All API endpoints are prefixed with `/api/v1`.

---

## 1. Authentication & Users

### POST `/api/v1/auth/login`
Authenticates a user and returns an access token.
- **Request Body:** Standard OAuth2 form data (username/password).
- **Response:**
  ```json
  {
    "access_token": "ey...",
    "token_type": "bearer",
    "user": { "id": "...", "email": "..." }
  }
  ```

---

## 2. Sensors & IoT Ingestion

### POST `/api/v1/sensors/readings/batch`
Ingest a batch of sensor readings from an IoT device.
- **Request Body:**
  ```json
  {
    "device_id": "uuid",
    "readings": [
      { "sensor_type": "mq2", "value": 300, "unit": "ppm" }
    ]
  }
  ```
- **Response:** `200 OK` with ingestion count.

### GET `/api/v1/sensors/history`
Chart-optimized time-series sensor data for the dashboard.
- **Query Params:** `room_id`, `device_id`, `minutes`
- **Response:** Array of historical data points for visualization.

### GET `/api/v1/sensors/health`
Diagnoses sensor health based on recent readings (detects broken, stuck, or dead sensors).

---

## 3. Real-Time Dashboard (WebSockets)

### WS `/api/v1/dashboard/ws`
WebSocket connection for real-time dashboard updates.
- **Events Sent to Client:**
  - `SENSOR_UPDATE`: New data from IoT devices.
  - `NEW_ALERT`: System created a new warning/alert.
  - `FIRE_ALERT`: Critical fire detection event requiring immediate attention.

---

## 4. Computer Vision & Detection

### POST `/api/v1/detection/analyze`
Receives an image frame from a CCTV camera, runs YOLO inference, and records the result.
- **Request Body:** Multipart form data (Image file).
- **Response:** Bounding boxes, confidence scores, and late-fusion risk assessment.

---

## 5. WhatsApp & NLP Integration

### POST `/api/v1/nlp_routes/chat`
Endpoint for the WhatsApp gateway to forward messages to the AI assistant.
- **Request Body:**
  ```json
  {
    "phone_number": "628...",
    "message": "Bagaimana status ruangan Server?"
  }
  ```
- **Response:** AI-generated natural language response explaining the room status.

---

*Note: You can view the full interactive OpenAPI documentation by visiting `http://localhost:8000/docs` while the backend is running.*
