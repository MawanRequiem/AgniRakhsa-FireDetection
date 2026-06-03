# Getting Started Guide

This guide explains how to set up and run the entire Ifrit ecosystem on your local machine or a server.

## Prerequisites

Before you start, ensure you have the following installed:
- **Node.js** (v18 or higher) for the Web Dashboard and WhatsApp Gateway.
- **Python** (v3.11 or higher) for the Backend.
- **uv** package manager (`pip install uv`) for Python dependencies.
- **Docker** and **Docker Compose** (if you prefer running via containers).

## Environment Configuration

Each component requires its own `.env` file. You need to copy the `.env.example` templates and fill them in.

1. **Backend (`backend/.env`)**
   - Needs `SUPABASE_URL` and `SUPABASE_KEY` for database access.
   - Generate a strong `SECRET_KEY` for secure JWT signing.

2. **Web Dashboard (`web/.env`)**
   - Needs `VITE_API_URL` pointing to your backend (e.g., `http://localhost:8000/api/v1`).

3. **WhatsApp Gateway (`whatsapp-gateway/.env`)**
   - Needs `BACKEND_API_URL` to route chatbot queries back to the Python server.

## Running Locally (Development Mode)

You will need three separate terminal windows to run the components independently.

### 1. Start the Backend
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```
*The backend will be available at `http://localhost:8000`.*

### 2. Start the WhatsApp Gateway
```bash
cd whatsapp-gateway
npm install
npm run dev
```
*The first time you run this, a QR code will appear in the terminal. Scan it with the WhatsApp account that will serve as the bot.*

### 3. Start the Web Dashboard
```bash
cd web
npm install
npm run dev
```
*The dashboard will be available at `http://localhost:5173`.*

## Running via Docker (Production / Easy Mode)

If you have Docker installed, you can spin up the entire stack seamlessly. The repository includes a `docker-compose.yml` file.

```bash
docker compose up --build -d
```

This will build the images and start the containers in detached mode.

## Troubleshooting

- **WhatsApp Bot disconnects:** Delete the `whatsapp-gateway/auth_info_baileys` folder and restart the gateway to generate a fresh QR code.
- **AI Models failing to load:** Ensure that the `settings.MODEL_PATH` and `settings.SENSOR_MODEL_DIR` in your backend configuration correctly point to the downloaded model files.
- **WebSocket connection failed:** Check that the `VITE_API_URL` in your frontend strictly matches the backend host and port.
