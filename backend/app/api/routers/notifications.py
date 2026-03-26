from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from app.api.deps import CurrentUser
from app.services.whatsapp import send_whatsapp_message

router = APIRouter()

class WhatsAppMessageRequest(BaseModel):
    phone: str = Field(..., description="Phone number with country code")
    message: str = Field(..., min_length=1, max_length=4096)

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
