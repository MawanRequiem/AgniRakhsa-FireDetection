import asyncio
import os
import uuid
import time
from dotenv import load_dotenv

# Ensure we load env vars so Firebase initializes correctly
load_dotenv(".env")

from app.services.fcm_service import send_push
from app.core.db import supabase

async def test_production_fcm():
    print("Fetching registered device tokens from Supabase...")
    try:
        res = supabase.table("device_tokens").select("fcm_token").execute()
        tokens = [r["fcm_token"] for r in res.data] if res.data else []
        print(f"Found {len(tokens)} token(s).")
    except Exception as e:
        print(f"Error fetching tokens: {e}")
        return

    if not tokens:
        print("No tokens found. Please log in on the mobile app to register your device's FCM token.")
        return

    print("Fetching 'Ruang Raka Herdika' from Supabase...")
    res = supabase.table("rooms").select("id, name").ilike("name", "%raka%").execute()
    room_record = res.data[0] if res.data else None
    
    if room_record:
        room_name = room_record["name"]
        room_id = room_record["id"]
        print(f"Found room: {room_name} ({room_id})")
    else:
        room_name = "Ruang Raka Herdika (Test)"
        room_id = str(uuid.uuid4())
        print(f"Room not found, using simulated: {room_name} ({room_id})")

    print("Sending CRITICAL risk FCM push notification to mobile devices...")
    
    room_name_en = room_name
    risk_level = "critical"
    fusion_score = 0.95
    
    risk_label_en = "CRITICAL"
    risk_label_id = "KRITIS"

    # Simulated explanations
    explanation_id = "Analisis visual dari kamera (AI mendeteksi objek menyerupai api) serta deteksi asap dari sensor (Asap tebal) sangat aktif. Sistem menyimpulkan tingkat bahaya yang sangat tinggi."
    explanation_en = "Visual analysis from the camera (AI detected fire-like objects) and smoke detection from sensors (Thick smoke) are highly active. The system concludes a very high danger level."
    
    # Use real camera frame image instead of SVG
    image_url = "https://ujdypvzfiyhxusydyyjo.supabase.co/storage/v1/object/public/detection-captures/2355e3d4/73691c8ce0d7.jpg"
    
    title_en = f"FIRE ALERT: {room_name_en} ({risk_label_en})"
    title_id = f"PERINGATAN KEBAKARAN: {room_name} ({risk_label_id})"

    body_en = (
        f"{risk_label_en} risk detected in {room_name_en}. "
        f"{explanation_en}"
    )
    body_id = (
        f"Risiko {risk_label_id} terdeteksi di {room_name}. "
        f"{explanation_id}"
    )

    # Insert into database so it appears in history!
    try:
        import json
        alert_res = supabase.table("alerts").insert({
            "room_id": room_id,
            "severity": risk_level,
            "alert_type": "fire",
            "image_url": image_url,
            "message": json.dumps({
                "en": body_en,
                "id": body_id,
                "explanation_en": explanation_en,
                "explanation_id": explanation_id
            })
        }).execute()
        alert_id = alert_res.data[0]["id"]
        print(f"Inserted alert into history with ID: {alert_id}")
    except Exception as e:
        print(f"Failed to insert alert into DB: {e}")
        alert_id = str(uuid.uuid4())

    fcm_data = {
        "type": "FIRE_ALERT",
        "alert_id": alert_id,
        "room_name": room_name,
        "risk_level": risk_level,
        "severity": risk_level,
        "fusion_score": str(round(fusion_score, 3)),
        "title_en": title_en,
        "title_id": title_id,
        "body_en": body_en,
        "body_id": body_id,
        "room_id": str(room_id),
        "image_url": image_url
    }
    
    # Actually send to FCM (No Mocking)
    sent_count = send_push(
        title=title_en, # Firebase requires a default title
        body=body_en,   # Firebase requires a default body
        data=fcm_data,
        image_url=image_url
    )
    
    print(f"\nPayload Sent:")
    print(f" - Title (EN): {title_en}")
    print(f" - Title (ID): {title_id}")
    print(f" - Image URL: {image_url}")
    print(f" - Explanation Included: Yes")
    print(f"\nResult: Sent {sent_count} successfully out of {len(tokens)} attempted.")

if __name__ == "__main__":
    asyncio.run(test_production_fcm())
