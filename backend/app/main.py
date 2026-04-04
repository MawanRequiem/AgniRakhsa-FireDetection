from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.routers import auth, notifications, detection, sensors, rooms, devices, dashboard, ws, alerts, cameras
from app.core.config import settings
from app.ai import registry

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events for FastAPI application."""
    # Load AI model into memory on startup
    try:
        registry.load_detector(
            model_type=settings.MODEL_TYPE,
            model_path=settings.MODEL_PATH,
            confidence_threshold=settings.MODEL_CONFIDENCE_THRESHOLD,
            input_size=settings.MODEL_INPUT_SIZE
        )
    except Exception as e:
        # We don't crash the server if the model isn't here yet, 
        # but we log the error so ops know AI inference won't work.
        import logging
        logging.getLogger(__name__).error(f"AI Model failed to load: {e}")
    
    yield
    # Teardown logic if needed



app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend & AI Core for Fire Detection System",
    version="0.0.1",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# CORS — izinkan frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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

# --- AI & Core Functionality Routers ---
app.include_router(detection.router, prefix=settings.API_V1_STR)
app.include_router(sensors.router, prefix=settings.API_V1_STR)
app.include_router(rooms.router, prefix=settings.API_V1_STR)
app.include_router(devices.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(cameras.router, prefix=settings.API_V1_STR)
app.include_router(ws.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["WebSockets"])

@app.get("/")
async def health_check():
    return {
        "status": "ok",
        "service": "agniraksha-backend",
        "version": "0.0.1",
    }
