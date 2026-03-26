from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import auth, notifications
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend & AI Core for Fire Detection System",
    version="0.0.1",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS — izinkan frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(notifications.router, prefix=f"{settings.API_V1_STR}/notifications", tags=["notifications"])

@app.get("/")
async def health_check():
    return {
        "status": "ok",
        "service": "agniraksha-backend",
        "version": "0.0.1",
    }
