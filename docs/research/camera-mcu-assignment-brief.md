# Research Brief: Camera-to-Room Assignment with Real MCU Hardware

## Context — What is AgniRakhsa?

AgniRakhsa is an AI-powered fire detection system that uses **Late Fusion** — combining real-time AI camera inference (YOLOv8 on video frames) with IoT sensor readings (gas, temperature, flame) to produce a unified fire risk score per physical room.

The fusion engine pairs camera detections and sensor data by a shared `room_id`. If both a camera and a sensor node are assigned to the same room, their signals are fused together.

---

## The Problem Statement

Currently, **MCU sensor nodes** (ESP32-S3 running the IFRIT firmware) self-provision on boot. They call `POST /api/v1/devices/provision` with their MAC address, sensor types, and a `room_name`. The backend auto-creates the room if it doesn't exist and maps the MCU + its sensors to that room. This works seamlessly.

**Cameras**, however, have a separate registration flow. They are registered via the admin UI (`POST /api/v1/cameras/`) and then assigned to a room via a dropdown selector (`PATCH /api/v1/cameras/{id}`). A separate Python script (`webcam_stream.py`) captures frames from a PC webcam and pipes them to the backend via WebSocket at `ws://localhost:8000/api/v1/camera/stream/{camera_id}`.

### The Gap

In a **real production deployment** with physical MCU hardware (not Wokwi simulation):

1. **How should cameras be discovered and assigned to rooms?** In a real facility, you might have IP cameras (RTSP) or USB cameras attached to edge compute nodes — not a developer's laptop webcam.
2. **Should the MCU firmware also provision its physically co-located camera?** In real deployments, each room might have an ESP32-CAM (camera + sensors on one board) or an IP camera near the MCU node.
3. **What is the pairing workflow?** How does an admin ensure the correct camera is mapped to the correct room when commissioning a new zone?

---

## Current Architecture Snapshot

### Entities & Relationships

```
Room (id, name, description)
  ├── Camera (id, name, room_id, camera_type, stream_url, status)
  └── Device/MCU (id, name, room_id, mac_address, status, firmware_version)
       └── Sensor (id, device_id, room_id, sensor_type, status)
```

### Existing Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/devices/provision` | POST | MCU self-registers by MAC, auto-creates room |
| `/devices/{id}/heartbeat` | POST | MCU sends periodic liveness ping |
| `/sensors/readings/batch` | POST | MCU sends sensor readings |
| `/cameras/` | POST | Admin registers a camera manually |
| `/cameras/{id}` | PATCH | Admin assigns camera to a room |
| `/cameras/{id}` | DELETE | Admin removes a camera |
| `/camera/stream/{camera_id}` | WS | PC script sends frames for AI inference |

### MCU Firmware Flow (Current — Wokwi Simulation)

```
ESP32 boots
  → Connect WiFi
  → POST /devices/provision { mac_address, name, room_name, sensor_types[] }
  → Receive { device_id, sensors: { type: uuid } }
  → Loop: read sensors → POST /sensors/readings/batch
  → Loop: POST /devices/{id}/heartbeat every 30s
```

### Camera Stream Flow (Current — PC Webcam Testing)

```
Admin registers camera via Dashboard UI → gets camera_id
Admin runs: python webcam_stream.py --camera-id <uuid> --source 0
Script opens webcam → captures frame → encodes base64
  → WS send to /camera/stream/{camera_id}
  → Backend runs YOLO → fuses with sensor data → broadcasts to dashboard
```

---

## Research Questions for the Agent

### Q1: Camera Discovery & Registration Strategies

Research and compare the following approaches for camera registration in industrial/facility monitoring systems:

1. **Manual Registration via Admin UI** (current approach) — Admin enters camera name, type, stream URL, and assigns to a room.
2. **ONVIF Auto-Discovery** — Use the ONVIF protocol to automatically discover IP cameras on the local network. How does this work? What libraries exist (Python)?
3. **mDNS/Bonjour Discovery** — ESP32-CAM modules could broadcast their presence via mDNS. How would the backend discover and register them?
4. **QR-Code Commissioning** — Each camera/MCU has a QR code; a mobile app scans it and calls the API to register + assign to the current room.
5. **Firmware-Driven Camera Provisioning** — The MCU firmware itself registers its built-in camera (e.g. ESP32-CAM) during the provision step. The `POST /devices/provision` payload would include a `camera` field.

For each approach, evaluate:
- Complexity to implement
- User experience for the field technician/admin
- Scalability (1 camera vs. 100 cameras)
- Security implications
- Compatibility with our existing FastAPI + Supabase + React stack

### Q2: ESP32-CAM Integration

If we go with ESP32-CAM (a single board with both camera and sensors):

1. Can the ESP32-CAM stream MJPEG frames over WebSocket directly to our backend? What are the performance constraints (resolution, FPS, WiFi bandwidth)?
2. Should the ESP32-CAM do on-device inference (e.g. TFLite Micro) or off-load to the backend (current approach)?
3. How do we handle the case where the ESP32-CAM is the sensor node AND the camera? Should the `provision` endpoint auto-create both a `device` and a `camera` record?
4. What is the typical JPEG frame size at 320x240 / 640x480 resolution? Can the ESP32 sustain WebSocket streaming?

### Q3: Edge Compute Node Architecture (Raspberry Pi / Jetson)

An alternative to ESP32-CAM is having IP cameras (RTSP) connected to an edge compute node (Raspberry Pi or Jetson Nano) in each zone:

1. The edge node pulls RTSP streams, runs YOLO locally, and only sends results (not frames) to the backend.
2. Contrast this with the current approach (backend does all inference).
3. What are the latency, bandwidth, and cost trade-offs?

### Q4: Room Assignment Workflow for Facility Commissioning

Design the ideal admin workflow for commissioning a new room/zone in a facility:

1. Admin creates a Room in the dashboard.
2. Technician powers on the MCU in that room → MCU auto-provisions with `room_name`.
3. Camera is registered and assigned — **how?**
   - Option A: Admin manually selects the camera in the Devices page and picks the room from a dropdown (current).
   - Option B: The MCU firmware includes a `camera_stream_url` field in its provision payload, and the backend auto-creates the camera record.
   - Option C: The camera itself calls a provision endpoint on boot (similar to how the MCU does).
4. Which option minimizes human error and manual steps?

### Q5: Security Considerations

1. How do we authenticate camera streams in production? Currently the WebSocket has no auth.
2. Should cameras use API keys, mTLS certificates, or JWT tokens?
3. How do we prevent rogue devices from impersonating legitimate cameras?
4. What's the standard for IoT device identity in industrial fire safety systems (if any)?

### Q6: Scalability & Reliability

1. How many concurrent camera WebSocket streams can a single FastAPI instance handle?
2. Should we introduce a message broker (e.g. MQTT, RabbitMQ) between cameras and the backend instead of direct WebSocket?
3. MQTT is the de facto standard for IoT telemetry — should our MCU sensors also migrate from HTTP POST to MQTT?
4. What happens when a camera or MCU loses connectivity? How should the system degrade gracefully?

---

## Constraints & Non-Goals

- **Stack**: Python (FastAPI), Supabase (PostgreSQL), React, ESP32 (Arduino/C++)
- **Budget**: University capstone project — prefer open-source, minimal cloud cost
- **Scale target**: 1 building, 5–20 rooms, up to 20 cameras + 20 MCUs
- **Non-goal**: We are NOT building a commercial-grade VMS (Video Management System). We need "just enough" to demo the Late Fusion concept.

---

## Expected Output

After researching, the agent should produce:

1. **A comparison matrix** of camera registration strategies (Q1) with a clear recommendation.
2. **A recommended architecture** for productioncamera-to-room pairing, considering our constraints.
3. **A data flow diagram** showing the boot-to-operational lifecycle of both MCU and camera in the recommended architecture.
4. **Specific API changes** needed (new endpoints, modified payloads, new fields in the DB schema).
5. **A risk assessment** for the recommended approach.

---

## Reference Files

| File | Purpose |
|---|---|
| `IFRIT/src/main.cpp` | MCU firmware — provisioning, telemetry, heartbeat |
| `IFRIT/include/config.h` | MCU configuration — WiFi, API URL, sensor types |
| `backend/app/api/routers/devices.py` | Device CRUD + provisioning API |
| `backend/app/api/routers/cameras.py` | Camera CRUD API |
| `backend/app/api/routers/camera_stream.py` | Camera WebSocket stream + YOLO inference |
| `backend/scripts/webcam_stream.py` | PC-side script that captures webcam and sends to backend |
| `web/src/pages/DeviceManagement.jsx` | Admin UI for device/camera management |
