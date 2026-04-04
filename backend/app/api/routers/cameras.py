"""Camera management API endpoints."""

from fastapi import APIRouter, HTTPException
from uuid import UUID
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from app.core.db import supabase

router = APIRouter(prefix="/cameras", tags=["cameras"])


class CameraCreate(BaseModel):
    """Register a new camera."""
    name: str = Field(..., min_length=1, max_length=100)
    room_id: Optional[UUID] = None
    stream_url: Optional[str] = Field(
        default=None,
        description="RTSP URL or 'webcam:0' for local PC camera",
    )
    camera_type: str = Field(
        default="webcam",
        description="webcam | rtsp | http_mjpeg",
    )


class CameraOut(BaseModel):
    """Camera as returned by the API."""
    id: UUID
    name: str
    room_id: Optional[UUID] = None
    stream_url: Optional[str] = None
    camera_type: str = "webcam"
    status: str = "offline"
    has_detection: bool = False
    last_frame_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


@router.get("/", response_model=list[CameraOut])
async def list_cameras(room_id: UUID | None = None):
    """List all registered cameras."""
    query = supabase.table("cameras").select("*")
    if room_id:
        query = query.eq("room_id", str(room_id))
    result = query.order("created_at").execute()
    return result.data or []


@router.get("/{camera_id}", response_model=CameraOut)
async def get_camera(camera_id: UUID):
    """Get camera details."""
    result = (
        supabase.table("cameras")
        .select("*")
        .eq("id", str(camera_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Camera not found")
    return result.data[0]


@router.post("/", response_model=CameraOut)
async def register_camera(camera: CameraCreate):
    """Register a new camera source."""
    data = camera.model_dump(exclude_unset=True)
    if "room_id" in data and data["room_id"] is not None:
        data["room_id"] = str(data["room_id"])

    result = supabase.table("cameras").insert(data).execute()
    return result.data[0]
