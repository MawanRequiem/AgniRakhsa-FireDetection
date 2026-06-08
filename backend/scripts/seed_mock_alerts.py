"""
Seed script: creates 5 rooms and ~200 mock alerts for UI testing.
Run from backend/:
    python scripts/seed_mock_alerts.py
"""
import json
import os
import sys
import random
from datetime import datetime, timezone, timedelta
from uuid import uuid4

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.db import supabase
from app.core.config import settings

ROOMS = [
    {"name": "Server Room A", "floor": "B1", "building_name": "Gedung Utama", "description": "Rak server utama dan pendingin"},
    {"name": "Kitchen Area",    "floor": "1F", "building_name": "Gedung Utama", "description": "Dapur utama dengan kompor gas"},
    {"name": "Warehouse B",     "floor": "B1", "building_name": "Gedung Timur",  "description": "Gudang penyimpanan material"},
    {"name": "Office Floor 3",  "floor": "3F", "building_name": "Gedung Utama", "description": "Ruang kerja lantai 3"},
    {"name": "Electrical Room", "floor": "B1", "building_name": "Gedung Utama", "description": "Panel listrik dan trafo"},
]

SEVERITIES = ["critical", "high", "medium", "low"]

MESSAGES = [
    {"en": "Flame detected by camera — high confidence", "id": "Api terdeteksi kamera — keyakinan tinggi", "explanation_en": "YOLOv8 model detected flame with 0.92 confidence.", "explanation_id": "Model YOLOv8 mendeteksi api dengan keyakinan 0.92.", "sensors": {"temperature": 78, "humidity": 22, "gas_level": 850, "flame_detected": True}},
    {"en": "Smoke concentration rising rapidly", "id": "Konsentrasi asap meningkat cepat", "explanation_en": "MQ2 sensor reading jumped from 200ppm to 1200ppm in 30s.", "explanation_id": "Pembacaan sensor MQ2 melonjak dari 200ppm ke 1200ppm dalam 30 detik.", "sensors": {"temperature": 62, "humidity": 18, "gas_level": 1200, "flame_detected": True}},
    {"en": "Temperature anomaly — exceeds safety threshold", "id": "Anomali suhu — melebihi ambang batas aman", "explanation_en": "SHTC3 sensor reports 95°C, normal range is 20-35°C.", "explanation_id": "Sensor SHTC3 melaporkan 95°C, rentang normal 20-35°C.", "sensors": {"temperature": 95, "humidity": 12, "gas_level": 300, "flame_detected": False}},
    {"en": "CO level elevated — possible combustion", "id": "Level CO meningkat — kemungkinan pembakaran", "explanation_en": "Carbon monoxide reading at 85ppm, safe limit is 35ppm.", "explanation_id": "Pembacaan karbon monoksida 85ppm, batas aman 35ppm.", "sensors": {"temperature": 55, "humidity": 30, "gas_level": 600, "flame_detected": False}},
    {"en": "LPG leak detected in sensor array", "id": "Kebocoran LPG terdeteksi sensor", "explanation_en": "Gas sensor cluster reports LPG at 2500ppm.", "explanation_id": "Kluster sensor gas melaporkan LPG 2500ppm.", "sensors": {"temperature": 42, "humidity": 35, "gas_level": 2500, "flame_detected": False}},
    {"en": "Flame sensor triggered — IR spike", "id": "Sensor api terpicu — lonjakan IR", "explanation_en": "Infrared flame sensor detected spike above 400 units.", "explanation_id": "Sensor api inframerah mendeteksi lonjakan di atas 400 unit.", "sensors": {"temperature": 68, "humidity": 20, "gas_level": 450, "flame_detected": True}},
    {"en": "Humidity drop + heat rise — possible fire signature", "id": "Kelembaban turun + panas naik — kemungkinan tanda api", "explanation_en": "Combined sensor pattern matches early-stage fire signature.", "explanation_id": "Pola sensor gabungan cocok dengan tanda api tahap awal.", "sensors": {"temperature": 72, "humidity": 15, "gas_level": 700, "flame_detected": True}},
    {"en": "Sensor calibration drift detected", "id": "Pergeseran kalibrasi sensor terdeteksi", "explanation_en": "Routine check found 3% drift in temperature sensor.", "explanation_id": "Pemeriksaan rutin menemukan pergeseran 3% pada sensor suhu.", "sensors": {"temperature": 32, "humidity": 55, "gas_level": 100, "flame_detected": False}},
    {"en": "Routine sensor check — all normal", "id": "Pemeriksaan sensor rutin — semua normal", "explanation_en": "Scheduled health check passed with all sensors within range.", "explanation_id": "Pemeriksaan kesehatan terjadwal lulus, semua sensor dalam rentang.", "sensors": {"temperature": 28, "humidity": 50, "gas_level": 80, "flame_detected": False}},
    {"en": "System restart after maintenance", "id": "Restart sistem setelah pemeliharaan", "explanation_en": "Planned maintenance completed, all systems back online.", "explanation_id": "Pemeliharaan terjadwal selesai, semua sistem kembali online.", "sensors": None},
    {"en": "Brief sensor spike — resolved automatically", "id": "Lonjakan sensor singkat — teratasi otomatis", "explanation_en": "Transient spike in LPG reading, returned to normal within 60s.", "explanation_id": "Lonjakan sementara pada pembacaan LPG, kembali normal dalam 60 detik.", "sensors": {"temperature": 35, "humidity": 45, "gas_level": 200, "flame_detected": False}},
]


def seed_rooms():
    print("Creating rooms...")
    created = []
    for room_data in ROOMS:
        res = supabase.table("rooms").insert(room_data).execute()
        if res.data:
            r = res.data[0]
            created.append(r)
            print(f"  ✓ {r['name']} ({r['id']})")
        else:
            print(f"  ✗ Failed: {room_data['name']}")
    return created


def seed_alerts(rooms):
    print(f"\nCreating alerts for {len(rooms)} rooms...")
    now = datetime.now(timezone.utc)
    total = 0

    for room in rooms:
        room_id = room["id"]
        room_name = room["name"]
        room_msg = random.sample(MESSAGES, min(5, len(MESSAGES)))
        n = random.randint(35, 45)

        for i in range(n):
            days_ago = random.randint(0, 14)
            hours_ago = random.randint(0, 23)
            mins_ago = random.randint(0, 59)
            created_at = now - timedelta(days=days_ago, hours=hours_ago, minutes=mins_ago)

            is_ack = random.random() < 0.4
            sev = random.choices(SEVERITIES, weights=[15, 25, 30, 30], k=1)[0]

            msg_template = random.choice(room_msg)
            msg_obj = dict(msg_template)
            msg_obj.pop("sensors", None)
            sensor_data = msg_template.get("sensors")
            if sensor_data:
                msg_obj["sensors"] = sensor_data

            message = json.dumps(msg_obj)

            alert_row = {
                "room_id": str(room_id),
                "severity": sev,
                "alert_type": "fire",
                "message": message,
                "is_acknowledged": is_ack,
                "created_at": created_at.isoformat(),
            }

            if is_ack:
                ack_time = created_at + timedelta(minutes=random.randint(1, 60))
                alert_row["acknowledged_at"] = (created_at + timedelta(
                    minutes=random.randint(1, 60)
                )).isoformat()

            res = supabase.table("alerts").insert(alert_row).execute()
            if res.data:
                total += 1

        print(f"  ✓ {room_name}: {n} alerts inserted")

    print(f"\nDone! {total} total alerts across {len(rooms)} rooms.")


def main():
    print("=" * 50)
    print("Seed Mock Alerts for IFRIT UI Testing")
    print("=" * 50)

    # Check for existing rooms to avoid duplication
    existing = supabase.table("rooms").select("id", count="exact").execute()
    if existing.count and existing.count > 0:
        confirm = input(
            f"\n⚠ Found {existing.count} existing rooms. "
            "Continue to create MORE rooms + alerts? (y/N): "
        )
        if confirm.lower() != "y":
            print("Aborted.")
            return

    rooms = seed_rooms()
    if not rooms:
        print("No rooms created. Aborting alert seed.")
        return

    seed_alerts(rooms)


if __name__ == "__main__":
    main()
