import httpx
from typing import Optional
from app.core.config import settings

async def send_whatsapp_message(
    phone: str,
    message: str,
    image_url: Optional[str] = None,
) -> bool:
    """
    Sends a WhatsApp message via the internal gateway.
    
    Supports two modes:
    - Text-only: sends a plain text message
    - Image + caption: sends image from URL with message as caption
    
    Args:
        phone: Target phone number.
        message: Text message body (or caption if image provided).
        image_url: Optional public URL to an image to send as attachment.
        
    Returns:
        True if message was sent successfully.
    """
    url = f"{settings.GATEWAY_URL.rstrip('/')}/api/messages"
    headers = {
        "x-api-key": settings.GATEWAY_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "phone": phone,
        "message": message
    }
    
    # Include image URL if provided
    if image_url:
        payload["imageUrl"] = image_url
    
    try:
        # Secure timeout and strict validation for external/internal calls
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            if response.status_code != 200:
                print(f"[Gateway Error] {response.status_code}: {response.text}")
                return False
                
            data = response.json()
            return data.get("success", False)
            
    except httpx.RequestError as e:
        print(f"[Gateway Connection Error] Failed to contact gateway: {e}")
        return False
