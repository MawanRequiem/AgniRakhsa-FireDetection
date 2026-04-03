# 🔥 AgniRakhsa — Fire Detection & Monitoring System

> **Agni** (Sanskrit: Api) + **Rakhsa** (Sanskrit: Penjaga) — Penjaga Api.

Sistem deteksi dan monitoring kebakaran berbasis AI yang mengintegrasikan Computer Vision (CCTV), sensor IoT, dan komunikasi WhatsApp untuk peringatan dini secara real-time.

---

## 📐 Arsitektur Sistem

```
┌─────────────────┐     WebSocket/REST      ┌──────────────────────┐
│   Web Dashboard  │◄──────────────────────► │   Backend & AI Core  │
│   (React.js)     │                         │   (Python + FastAPI)  │
└─────────────────┘                         └──────────┬───────────┘
                                                       │
                                            ┌──────────┼───────────┐
                                            │          │           │
                                       ┌────▼───┐ ┌───▼────┐ ┌───▼────────┐
                                       │ Sensor │ │  CCTV  │ │  Supabase  │
                                       │  IoT   │ │ Stream │ │    (DB)    │
                                       └────────┘ └────────┘ └────────────┘
                                                       │
                                            REST API   │
                                                       ▼
                                            ┌──────────────────────┐
                                            │  WhatsApp Gateway    │
                                            │  (Node.js + Express) │
                                            └──────────────────────┘
                                                       │
                                                       ▼
                                                 📱 WhatsApp
                                            (Alert & Chatbot)
```

---

## 🧩 Komponen Utama

### 1. Web Dashboard — `web/`

| Item          | Detail                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------- |
| **Teknologi** | React.js (JavaScript) + Vite                                                                |
| **Styling**   | Tailwind CSS v4 + shadcn/ui                                                                 |
| **Fungsi**    | Dashboard monitoring real-time: grafik sensor, visual CCTV, status ruangan, card notifikasi |
| **Port**      | `5173` (dev)                                                                                |

### 2. Backend & AI Core — `backend/`

| Item                | Detail                           |
| ------------------- | -------------------------------- |
| **Teknologi**       | Python 3.11+ + FastAPI           |
| **Package Manager** | uv                               |
| **Database**        | Supabase (PostgreSQL)            |
| **Fungsi**          | Pusat logika & kecerdasan sistem |

**Fungsi Web & API:**

- Menerima data metrik dari sensor IoT (via MQTT/HTTP)
- Menyimpan data ke Supabase
- Menyajikan data ke dashboard React (WebSocket untuk real-time update)

**Fungsi AI/ML:**

- Computer Vision: YOLO & Semantic Segmentation untuk video CCTV
- Data Mining: Random Forest / XGBoost untuk analisis data sensor
- NLP: Text generation untuk chatbot dan laporan otomatis

### 3. WhatsApp Gateway — `whatsapp-gateway/`

| Item          | Detail                                   |
| ------------- | ---------------------------------------- |
| **Teknologi** | Node.js + Express.js + Baileys           |
| **Fungsi**    | Bot WhatsApp untuk komunikasi interaktif |
| **Port**      | `3001` (dev)                             |

**Capabilities:**

- Menerima perintah dari backend via REST API (kirim alert, notifikasi)
- Menangkap pesan dari pengguna (satpam) → forward ke backend untuk dijawab AI NLP
- Mengirim alert otomatis saat ada deteksi bahaya

---

## 🗂️ Struktur Folder

```
AgniRakhsa-FireDetection/
├── web/                        # Frontend Dashboard
│   ├── src/
│   │   ├── components/         # UI components
│   │   ├── pages/              # Page components
│   │   ├── lib/                # Utilities
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
│
├── backend/                    # Backend & AI Core
│   ├── app/
│   │   ├── api/                # API routers
│   │   ├── core/               # Config, settings
│   │   ├── models/             # Pydantic schemas
│   │   ├── services/           # Business logic
│   │   └── main.py             # FastAPI entry
│   ├── pyproject.toml
│   └── .env.example
│
├── whatsapp-gateway/           # WhatsApp Bot Service
│   ├── src/
│   │   ├── routes/             # Express routes
│   │   ├── handlers/           # Baileys event handlers
│   │   ├── config.js
│   │   └── index.js
│   ├── package.json
│   └── .env.example
│
├── docker-compose.yml
└── README.md
```

---

## 🔄 Alur Data (Data Flow)

```
1. SENSOR IoT ──► HTTP/MQTT ──► Backend (FastAPI)
                                  │
                                  ├──► Simpan ke Supabase
                                  ├──► Analisis AI/ML
                                  │     ├── Sensor data → Random Forest/XGBoost
                                  │     ├── CCTV stream → YOLO + Segmentation
                                  │     └── NLP → Chatbot response & laporan
                                  │
                                  ├──► WebSocket ──► Web Dashboard (React)
                                  │
                                  └──► REST API ──► WhatsApp Gateway (Express)
                                                      │
                                                      └──► Baileys ──► WhatsApp User
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **uv** (`pip install uv` atau `curl -LsSf https://astral.sh/uv/install.sh | sh`)

### 1. Frontend

```bash
cd web
npm install
npm run dev
# → http://localhost:5173
```

### 2. Backend

```bash
cd backend
cp .env.example c.env        # isi credential Supabase
uv sync
uv run uvicorn app.main:app --reload
# → http://localhost:8000
```

### 3. WhatsApp Gateway

```bash
cd whatsapp-gateway
npm install
cp .env.example .env
npm run dev
# → http://localhost:3001
```

---

## 🔐 Environment Variables

Setiap service punya `.env.example` masing-masing. Copy ke `.env` dan isi sesuai kebutuhan:

| Service    | File                            | Key Variables                                |
| ---------- | ------------------------------- | -------------------------------------------- |
| Web        | `web/.env.example`              | `VITE_API_URL`                               |
| Backend    | `backend/.env.example`          | `SUPABASE_URL`, `SUPABASE_KEY`, `SECRET_KEY` |
| WA Gateway | `whatsapp-gateway/.env.example` | `PORT`, `BACKEND_API_URL`                    |

---

## 🐳 Docker (Optional)

```bash
docker compose up --build
```

---

## 📝 Approach & Methodology

### Tahap Pengerjaan

| Fase                           | Deskripsi                                              | Status         |
| ------------------------------ | ------------------------------------------------------ | -------------- |
| **1. Setup**                   | Scaffolding project, struktur folder, konfigurasi awal | 🔄 In Progress |
| **2. Requirement Engineering** | Analisis kebutuhan, use case, user story               | ⏳ Pending     |
| **3. Database Design**         | Schema Supabase, tabel, relasi, RLS policies           | ⏳ Pending     |
| **4. Backend API**             | Endpoint CRUD, auth, WebSocket, integrasi Supabase     | ⏳ Pending     |
| **5. AI/ML Integration**       | YOLO, segmentation, data mining, NLP chatbot           | ⏳ Pending     |
| **6. Frontend Dashboard**      | UI monitoring, grafik real-time, notifikasi            | ⏳ Pending     |
| **7. WhatsApp Bot**            | Integrasi Baileys, alert otomatis, chatbot             | ⏳ Pending     |
| **8. Testing & QA**            | Unit test, integration test, UAT                       | ⏳ Pending     |
| **9. Deployment**              | Docker, cloud deployment, CI/CD                        | ⏳ Pending     |

### Prinsip Development

- **Iterative**: Develop per-fitur, bukan big-bang
- **API-First**: Backend API didefinisikan dulu, frontend dan WA gateway consume
- **Separation of Concerns**: Setiap service punya tanggung jawab jelas
- **Environment-based Config**: Semua secret via `.env`, tidak hardcode

---

## 📄 License

Private — All rights reserved.
