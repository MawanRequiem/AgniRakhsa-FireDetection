import httpx
from app.core.config import settings

async def send_whatsapp_message(phone: str, message: str) -> bool:
    """
    Sends a WhatsApp message via the internal gateway.
    Applies short timeouts and checks for appropriate responses to prevent hanging requests.
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
    
    try:
        # Secure timeout and strict validation for external/internal calls
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            if response.status_code != 200:
                print(f"[Gateway Error] {response.status_code}: {response.text}")
                return False
                
            data = response.json()
            return data.get("success", False)
            
    except httpx.RequestError as e:
        print(f"[Gateway Connection Error] Failed to contact gateway: {e}")
        return False
