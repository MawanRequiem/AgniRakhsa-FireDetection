import asyncio
import os
from dotenv import load_dotenv

# Ensure we load env vars so Firebase initializes correctly
load_dotenv(".env")

from app.services.fcm_service import send_push
from app.core.db import supabase

async def test_real_fcm():
    print("Fetching registered device tokens from Supabase...")
    try:
        res = supabase.table("device_tokens").select("fcm_token").execute()
        tokens = [r["fcm_token"] for r in res.data] if res.data else []
        print(f"Found {len(tokens)} token(s).")
    except Exception as e:
        print(f"Error fetching tokens: {e}")
        return

    if not tokens:
        print("No tokens found. Cannot send push notification.")
        return

    print("Sending HIGH risk FCM push notification to mobile devices...")
    
    room_name = "Ruang Server (Test FCM)"
    risk_level = "high"
    fusion_score = 0.85
    risk_label = "HIGH"
    
    title = f"FIRE ALERT: {room_name} ({risk_label})"
    body = (
        f"{risk_label} risk detected in Server Room. "
        f"Fusion score: {fusion_score*100:.0f}%. Open app for details."
    )
    
    fcm_data = {
        "type": "FIRE_ALERT",
        "room_name": room_name,
        "risk_level": risk_level,
        "severity": risk_level,
        "fusion_score": str(round(fusion_score, 3))
    }
    
    # Actually send to FCM (No Mocking)
    sent_count = send_push(
        title=title, 
        body=body, 
        data=fcm_data
    )
    
    print(f"Result: Sent {sent_count} successfully out of {len(tokens)} attempted.")

if __name__ == "__main__":
    asyncio.run(test_real_fcm())
