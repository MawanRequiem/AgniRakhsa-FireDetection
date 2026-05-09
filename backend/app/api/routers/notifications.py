from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import httpx
from app.api.deps import CurrentUser
from app.services.whatsapp import send_whatsapp_message
from app.core.config import settings

router = APIRouter()

class WhatsAppMessageRequest(BaseModel):
    phone: str = Field(..., description="Phone number with country code")
    message: str = Field(..., min_length=1, max_length=4096)

@router.get("/whatsapp/status")
async def get_whatsapp_status(
    current_user: CurrentUser
):
    """
    Check if the WhatsApp Gateway is online and retrieve connection status & QR image.
    """
    url = f"{settings.GATEWAY_URL.rstrip('/')}/api/messages/status"
    headers = {
        "x-api-key": settings.GATEWAY_API_KEY
    }
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                return {
                    "connected": data.get("connected", False),
                    "status": data.get("status", "disconnected"),
                    "qr": data.get("qr")
                }
    except Exception as e:
        print(f"[Gateway Status Error] Failed to contact gateway: {e}")
    
    return {
        "connected": False,
        "status": "disconnected",
        "qr": None
    }

@router.post("/whatsapp")
async def send_whatsapp(
    req: WhatsAppMessageRequest,
    current_user: CurrentUser
):
    """
    Send a WhatsApp notification.
    """
    success = await send_whatsapp_message(phone=req.phone, message=req.message)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send message via WhatsApp Gateway"
        )
    
    return {"status": "success", "message": "WhatsApp message queued successfully"}
