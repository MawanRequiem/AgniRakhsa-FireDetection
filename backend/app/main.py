import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.routers import auth, notifications, detection, sensors, rooms, devices, dashboard, ws, alerts, cameras, camera_stream, nlp_routes, contacts, calibration, device_tokens, user_preferences
from app.core.config import settings
from app.ai import registry
from app.services.device_watchdog import run_watchdog
from app.services.fusion_worker import run_fusion_worker

from app.core.redis import redis_manager

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events for FastAPI application."""
    # Connect to Redis Cache Server
    try:
        redis_manager.connect()
    except Exception as e:
        logger.error(f"Redis initialization failed: {e}")

    # ─── Security Guard: Reject default SECRET_KEY in production ──────────
    _env = os.getenv("ENVIRONMENT", "development").lower()
    _DEFAULT_SECRET = "ag-super-secret-key-pls-change-in-prod-2026"
    if settings.SECRET_KEY == _DEFAULT_SECRET:
        if _env == "production":
            logger.error(
                "CRITICAL SECURITY RISK: SECRET_KEY must be changed in production! "
                "Set a strong random key in your .env file."
            )
        else:
            logger.warning(
                "⚠️ Using default SECRET_KEY — NOT SAFE FOR PRODUCTION. "
                "Set ENVIRONMENT=production and a real SECRET_KEY before deploying."
            )
    
    # ─── Security Guard: Reject default DEVICE_PROVISIONING_KEY ───────
    _DEFAULT_DEVICE_KEY = "CHANGE-ME-factory-provisioning-master-key"

    if settings.DEVICE_PROVISIONING_KEY == _DEFAULT_DEVICE_KEY:
        if _env == "production":
            logger.error(
                "CRITICAL SECURITY RISK: DEVICE_PROVISIONING_KEY must be changed "
                "in production! Set a strong random key in your .env file."
            )
        else:
            logger.warning(
                "⚠️ Using default DEVICE_PROVISIONING_KEY — "
                "NOT SAFE FOR PRODUCTION."
            )

    # Load AI model into memory on startup
    try:
        registry.load_detector(
            model_type=settings.MODEL_TYPE,
            model_path=settings.MODEL_PATH,
            confidence_threshold=settings.MODEL_CONFIDENCE_THRESHOLD,
            input_size=settings.MODEL_INPUT_SIZE
        )
    except Exception as e:
        logger.error(f"AI Model failed to load: {e}")
    
    # Load sensor anomaly detection model (Isolation Forest)
    try:
        registry.load_sensor_detector(model_dir=settings.SENSOR_MODEL_DIR)
    except Exception as e:
        logger.error(f"Sensor ML model failed to load: {e}")
    
    # Start the device watchdog as a background task
    import asyncio
    watchdog_task = asyncio.create_task(run_watchdog())
    fusion_worker_task = asyncio.create_task(run_fusion_worker())
    
    yield
    
    # Teardown: cancel tasks
    watchdog_task.cancel()
    fusion_worker_task.cancel()
    try:
        await watchdog_task
        await fusion_worker_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend & AI Core for Fire Detection System",
    version="0.0.1",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# CORS — izinkan frontend dev server dan production domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-CSRF-Token"],
)

# Custom Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(notifications.router, prefix=f"{settings.API_V1_STR}/notifications", tags=["notifications"])
app.include_router(contacts.router, prefix=f"{settings.API_V1_STR}/contacts", tags=["contacts"])

# --- AI & Core Functionality Routers ---
app.include_router(detection.router, prefix=settings.API_V1_STR)
app.include_router(sensors.router, prefix=settings.API_V1_STR)
app.include_router(rooms.router, prefix=settings.API_V1_STR)
app.include_router(devices.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(cameras.router, prefix=settings.API_V1_STR)
app.include_router(camera_stream.router, prefix=settings.API_V1_STR)
app.include_router(ws.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["WebSockets"])

# 2. DAFTARKAN router NLP di sini
app.include_router(nlp_routes.router, prefix=settings.API_V1_STR)
app.include_router(calibration.router, prefix=settings.API_V1_STR)
app.include_router(device_tokens.router, prefix=settings.API_V1_STR)
app.include_router(user_preferences.router, prefix=settings.API_V1_STR)

@app.get("/")
async def health_check():
    return {
        "status": "ok",
        "service": "agniraksha-backend",
        "version": "0.0.1",
    }
