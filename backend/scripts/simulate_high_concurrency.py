import os
import sys
import asyncio
import time
import uuid
import logging

# Ensure backend directory is in the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.db import supabase
from app.services import sensor_service
from app.core.redis import redis_manager

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("high_concurrency_test")

async def run_simulation():
    logger.info("Starting high-concurrency simulation run...")
    
    # Connect to Redis
    try:
        redis_manager.connect()
        r_client = redis_manager.get_client()
        if r_client and r_client.ping():
            logger.info("Connected to Redis cache server successfully!")
        else:
            logger.warning("Redis ping failed. Falling back to Postgres-only mode.")
            r_client = None
    except Exception as e:
        logger.warning(f"Could not connect to Redis: {e}. Falling back to Postgres-only mode.")
        r_client = None

    # 1. Fetch available devices & sensors from Supabase
    logger.info("Fetching active device and sensor metadata from Supabase database...")
    devices_res = supabase.table("devices").select("id, name, room_id").limit(10).execute()
    devices = devices_res.data or []
    
    if not devices:
        logger.error("No active devices found in the database. Please register some devices first!")
        return

    logger.info(f"Found {len(devices)} registered devices to simulate.")

    # For each device, fetch its sensors
    device_sensor_map = {}
    for dev in devices:
        dev_id = dev["id"]
        sensors_res = supabase.table("sensors").select("id, sensor_type").eq("device_id", dev_id).execute()
        sensors = sensors_res.data or []
        if sensors:
            device_sensor_map[dev_id] = sensors
            logger.info(f"  Device '{dev['name']}' ({dev_id}) has {len(sensors)} sensors.")

    if not device_sensor_map:
        logger.error("No registered sensors found for any devices. Simulation aborted.")
        return

    # 2. Simulate concurrent telemetry ingestion
    logger.info("Starting concurrent sensor batch ingestion...")
    logger.info(f"Simulating {len(device_sensor_map)} concurrent nodes reporting up to 7 sensors each...")

    start_time = time.perf_counter()

    async def simulate_node_report(device_id, sensors):
        # Build 7 reading reports (MQ2, MQ5, MQ135, flame, temp, etc.)
        readings = [
            {
                "sensor_id": s["id"],
                "value": 20.0 + (time.time() % 15) # Simulated dynamic values
            }
            for s in sensors[:7] # limit to 7 sensors
        ]
        
        node_start = time.perf_counter()
        count = await sensor_service.ingest_readings(uuid.UUID(device_id), readings)
        node_duration = (time.perf_counter() - node_start) * 1000.0
        
        logger.info(f"  Node {device_id[:8]}... ingested {count} readings in {node_duration:.2f}ms")
        return node_duration

    # Execute all node reports concurrently using asyncio.gather
    tasks = [
        simulate_node_report(dev_id, s)
        for dev_id, s in device_sensor_map.items()
    ]
    
    latencies = await asyncio.gather(*tasks)
    
    total_duration = (time.perf_counter() - start_time) * 1000.0
    avg_latency = sum(latencies) / len(latencies) if latencies else 0

    logger.info("=" * 60)
    logger.info("CONCURRENCY SIMULATION RESULTS:")
    logger.info("=" * 60)
    logger.info(f"Total concurrent requests processed: {len(tasks)}")
    logger.info(f"Total readings ingested: {sum(len(s[:7]) for s in device_sensor_map.values())}")
    logger.info(f"Total time elapsed: {total_duration:.2f}ms")
    logger.info(f"Average latency per node batch: {avg_latency:.2f}ms")
    logger.info("=" * 60)

    # 3. Verify Redis Caching
    if r_client:
        logger.info("Verifying Redis write-through metadata & cache state...")
        for dev_id in device_sensor_map.keys():
            room_key = f"device:{dev_id}:room_id"
            status_key = f"device:{dev_id}:status"
            
            cached_room = r_client.get(room_key)
            cached_status = r_client.get(status_key)
            
            logger.info(f"  Device {dev_id[:8]}...: room_id={cached_room}, status={cached_status}")
            
            # Since the cache snapshot was deleted on ingest_readings, let's trigger get_room_sensor_snapshot 
            # to populate it and then inspect it!
            dev_meta = next(d for d in devices if d["id"] == dev_id)
            room_id = dev_meta.get("room_id")
            if room_id:
                logger.info(f"  Querying room sensor snapshot for room {room_id} (populates Redis)...")
                await sensor_service.get_room_sensor_snapshot(uuid.UUID(room_id))
                
                # Retrieve from Redis to verify cache write
                cached_snap = r_client.get(f"room:{room_id}:sensor_snapshot")
                if cached_snap:
                    logger.info(f"    [SUCCESS] Saved sensor snapshot to Redis for fast late-fusion access!")
                else:
                    logger.warning(f"    [MISS] Snapshot was not cached in Redis.")
    logger.info("Simulation run completed successfully.")

if __name__ == "__main__":
    asyncio.run(run_simulation())
