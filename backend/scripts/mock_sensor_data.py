import os
import sys
import time
import random
import asyncio
import logging
import argparse
from datetime import datetime

import httpx

# Ensure backend root is in PYTHONPATH so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.db import supabase

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

API_URL = "http://localhost:8000/api/v1"

SENSOR_CONFIGS = [
    {"type": "MQ2", "unit": "ppm", "norm_min": 100, "norm_max": 300, "anomaly_min": 800, "anomaly_max": 2000},
    {"type": "MQ4", "unit": "ppm", "norm_min": 100, "norm_max": 300, "anomaly_min": 800, "anomaly_max": 2000},
    {"type": "MQ6", "unit": "ppm", "norm_min": 100, "norm_max": 300, "anomaly_min": 800, "anomaly_max": 2000},
    {"type": "MQ9B", "unit": "ppm", "norm_min": 100, "norm_max": 300, "anomaly_min": 800, "anomaly_max": 2000},
    {"type": "FLAME", "unit": "raw", "norm_min": 3000, "norm_max": 4095, "anomaly_min": 100, "anomaly_max": 1000}, # Flame is analog pull-up, lower means flame
    {"type": "SHTC3_TEMP", "unit": "C", "norm_min": 20.0, "norm_max": 30.0, "anomaly_min": 50.0, "anomaly_max": 85.0},
    {"type": "SHTC3_HUMIDITY", "unit": "%", "norm_min": 40.0, "norm_max": 60.0, "anomaly_min": 10.0, "anomaly_max": 30.0},
]

def bootstrap_env():
    """Ensure a trial room, device, and sensors exist in Supabase."""
    # 1. Room
    room_name = "Mock IoT Test Lab"
    res = supabase.table("rooms").select("*").eq("name", room_name).execute()
    if res.data:
        room_id = res.data[0]["id"]
        logger.info(f"Found existing room '{room_name}' ({room_id})")
    else:
        res = supabase.table("rooms").insert({"name": room_name, "building_name": "Virtual HQ", "description": "Mock Data Generation Room"}).execute()
        room_id = res.data[0]["id"]
        logger.info(f"Created room '{room_name}' ({room_id})")
        
    # 2. Device
    mac = "AA:BB:CC:DD:EE:FF"
    res = supabase.table("devices").select("*").eq("mac_address", mac).execute()
    if res.data:
        device_id = res.data[0]["id"]
        logger.info(f"Found existing device 'ESP32_MOCK' ({device_id})")
    else:
        res = supabase.table("devices").insert({
            "name": "ESP32_MOCK", 
            "mac_address": mac, 
            "room_id": room_id,
            "status": "online"
        }).execute()
        device_id = res.data[0]["id"]
        logger.info(f"Created device 'ESP32_MOCK' ({device_id})")
        
    # 3. Sensors
    res = supabase.table("sensors").select("*").eq("device_id", device_id).execute()
    existing_sensors = {s["sensor_type"]: s["id"] for s in res.data or []}
    sensor_map = {}
    
    for conf in SENSOR_CONFIGS:
        stype = conf["type"]
        if stype in existing_sensors:
            sensor_map[stype] = existing_sensors[stype]
            logger.info(f"Found existing sensor {stype} ({sensor_map[stype]})")
        else:
            ins = supabase.table("sensors").insert({
                "device_id": device_id,
                "room_id": room_id,
                "sensor_type": stype,
                "unit": conf["unit"],
                "status": "active"
            }).execute()
            sensor_map[stype] = ins.data[0]["id"]
            logger.info(f"Created sensor {stype} ({sensor_map[stype]})")
            
    return device_id, sensor_map

async def generate_payloads(args, device_id, sensor_map):
    client = httpx.AsyncClient(timeout=10.0)
    logger.info(f"Starting generation loop. Target rate: 1 payload per {args.rate}s. Anomaly chance: {args.anomaly_chance}%")
    
    try:
        while True:
            # Determine if this payload is anomalous
            is_anomaly = random.random() < (args.anomaly_chance / 100.0)
            
            readings = []
            now = datetime.utcnow().isoformat()
            
            for conf in SENSOR_CONFIGS:
                if is_anomaly:
                    val = random.uniform(conf["anomaly_min"], conf["anomaly_max"])
                else:
                    val = random.uniform(conf["norm_min"], conf["norm_max"])
                    
                # Format to 2 decimal places
                val = round(val, 2)
                
                readings.append({
                    "sensor_id": sensor_map[conf["type"]],
                    "value": val,
                    "reading_at": now
                })
            
            payload = {
                "device_id": device_id,
                "readings": readings
            }
            
            if is_anomaly:
                logger.warning(f"🔥 INJECTING FIRE ANOMALY PAYLOAD!")

            # Send payload
            try:
                resp = await client.post(f"{API_URL}/sensors/readings/batch", json=payload)
                if resp.status_code == 200:
                    logger.info(f"[{'ANOMALY' if is_anomaly else 'NORMAL'}] Ingested batch (Status {resp.status_code})")
                else:
                    logger.error(f"Failed to ingest: {resp.text}")
            except Exception as e:
                logger.error(f"Network error: {e}")
                
            await asyncio.sleep(args.rate)
            
    except asyncio.CancelledError:
        logger.info("Stopping telemetry generation.")
    except KeyboardInterrupt:
        logger.info("Stopping telemetry generation.")
    finally:
        await client.aclose()


def main():
    parser = argparse.ArgumentParser(description="Generate mock IoT telemetry for AgniRakhsa backend.")
    parser.add_argument("--rate", type=float, default=2.0, help="Wait time between payloads in seconds (default: 2.0).")
    parser.add_argument("--anomaly-chance", type=float, default=5.0, help="Percentage chance (0-100) to generate a fire anomaly (default: 5.0).")
    args = parser.parse_args()
    
    logger.info("Connecting to Supabase to bootstrap test environment...")
    try:
        device_id, sensor_map = bootstrap_env()
    except Exception as e:
        logger.error(f"Failed to bootstrap environment: {e}")
        sys.exit(1)
        
    logger.info("Environment ready. Starting async generator loop...")
    
    try:
        asyncio.run(generate_payloads(args, device_id, sensor_map))
    except KeyboardInterrupt:
        logger.info("Exiting...")

if __name__ == "__main__":
    main()
