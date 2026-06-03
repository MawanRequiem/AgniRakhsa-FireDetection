# WhatsApp Gateway Service

The WhatsApp Gateway acts as the communication bridge between the Ifrit backend and the security personnel on the ground. 

## Technology Stack
- **Node.js & Express.js:** Exposes a REST API for the Python backend to send commands to.
- **Baileys (`@whiskeysockets/baileys`):** A lightweight WhatsApp Web API library that doesn't require a heavy browser automation tool like Puppeteer.

## Core Responsibilities

### 1. Alert Notification Broadcast
When the backend's Late Fusion engine detects a fire risk (Critical/High), it sends a POST request to this gateway. The gateway then iterates through the active contacts list and sends a detailed WhatsApp message containing:
- Risk level and Fusion Score
- A summary of which sensors triggered the alert
- An attached image frame from the CCTV camera (if available)
- Actionable steps for the personnel

### 2. Interactive NLP Chatbot
The gateway listens to incoming WhatsApp messages from registered personnel. 
- If a message is received (e.g., *"Tolong cek status ruang server"*), it forwards the message payload to the Python backend's NLP endpoint (`/api/v1/nlp_routes/chat`).
- The Python backend processes the natural language, checks the database, generates a response, and replies.
- The gateway then forwards this response back to the user on WhatsApp.

## Running the Gateway

```bash
cd whatsapp-gateway
npm install
npm run dev
```

*Note: On the first run, the gateway will generate a QR code in the terminal. You must scan this QR code with a WhatsApp account that will act as the bot sender.*

The authentication session is saved in the `auth_info_baileys` directory, allowing it to reconnect automatically on subsequent restarts.
