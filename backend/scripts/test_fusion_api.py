import requests
import json
import uuid
import time
import hmac
import hashlib
from io import BytesIO
from PIL import Image

# Configuration
BASE_URL = "http://localhost/api/v1"
TEST_MAC_ADDRESS = "00:11:22:33:44:FF"
TEST_ROOM_NAME = "Fusion Test Room"
MASTER_KEY = b"more-than-thirty-two-bytes-change-me-in-production"  # Must match the one used in the backend for signing

def normalize_mac(mac_address: str) -> str:
    """
    Match backend MAC normalization exactly.
    """
    mac = mac_address.replace("-", ":").replace(".", ":").upper()

    parts = [p for p in mac.split(":") if p]

    if len(parts) != 6:
        raise ValueError("Invalid MAC address format")

    return ":".join(part.zfill(2) for part in parts)


def derive_device_secret(mac_address: str) -> bytes:
    """
    Derive per-device secret from master key.
    """
    normalized_mac = normalize_mac(mac_address)

    return hmac.new(
        MASTER_KEY,
        normalized_mac.encode(),
        hashlib.sha256,
    ).digest()


def sign_provision_request(mac_address: str) -> tuple[int, str]:
    """
    Generate timestamp + HMAC signature.
    """
    normalized_mac = normalize_mac(mac_address)

    device_secret = derive_device_secret(normalized_mac)

    timestamp = int(time.time())

    payload = f"{normalized_mac}:{timestamp}".encode()

    signature = hmac.new(
        device_secret,
        payload,
        hashlib.sha256,
    ).hexdigest()

    return timestamp, signature

def run_test():
    print(f"--- Starting Fusion Feature Test ---")
    print("BASE_URL =", BASE_URL)
    
    # 1. Provision a test device and room
    print("\n1. Provisioning test device and room...")
    timestamp, signature = sign_provision_request(TEST_MAC_ADDRESS)

    provision_payload = {
        "name": "Fusion Test Device",
        "mac_address": TEST_MAC_ADDRESS,
        "room_name": TEST_ROOM_NAME,
        "sensor_types": ["shtc3_temp", "mq2", "mq4"],
        "timestamp": timestamp,
        "signature": signature,
    }
    
    try:
        print(f"Timestamp : {timestamp}")
        print(f"Signature : {signature}")
        resp = requests.post(f"{BASE_URL}/devices/provision", json=provision_payload)
        resp.raise_for_status()
        provision_data = resp.json()
        device_id = provision_data["device_id"]
        sensors = provision_data["sensors"]
        print(f"✅ Device Provisioned. Device ID: {device_id}")
        print(f"   Sensors Created: {json.dumps(sensors, indent=2)}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to provision device: {e}")
        if hasattr(e.response, 'text'):
            print(e.response.text)
        return
    
    print("\n1b. Testing invalid signature rejection...")

    bad_payload = provision_payload.copy()
    bad_payload["signature"] = "0" * 64

    bad_resp = requests.post(
        f"{BASE_URL}/devices/provision",
        json=bad_payload
    )

    if bad_resp.status_code == 401:
        print("✅ Invalid signature correctly rejected")
    else:
        print("❌ Invalid signature was unexpectedly accepted")
        print(bad_resp.status_code, bad_resp.text)

    # To send detection image, we need the room_id.
    # We can get the device details to find its room_id.
    print("\n2. Fetching Room ID for the device...")
    try:
        resp = requests.get(f"{BASE_URL}/devices/{device_id}")
        resp.raise_for_status()
        room_id = resp.json().get("room_id")
        print(f"✅ Room ID found: {room_id}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to fetch device details: {e}")
        return

    # 3. Send high-risk sensor data
    print("\n3. Simulating high-risk sensor readings...")
    readings = []
    # Sending abnormal values (e.g., high temp, high gas)
    if "shtc3_temp" in sensors:
        readings.append({"sensor_id": sensors["shtc3_temp"], "value": 85.5}) # High Temp
    if "mq2" in sensors:
        readings.append({"sensor_id": sensors["mq2"], "value": 600.0})
    if "mq4" in sensors:
        readings.append({"sensor_id": sensors["mq4"], "value": 450.0})

    batch_payload = {
        "device_id": device_id,
        "readings": readings
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/sensors/readings/batch", json=batch_payload)
        resp.raise_for_status()
        print(f"✅ Sensor data ingested successfully: {resp.json()}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to send sensor data: {e}")
        if hasattr(e.response, 'text'):
            print(e.response.text)
        return

    # Give the backend a tiny moment to process the sensor batch and update Redis
    time.sleep(1)

    # 4. Trigger detection with a dummy image
    print("\n4. Sending dummy image to trigger detection and Late Fusion...")
    
    # Create a dummy image in memory (red square to somewhat look like fire, though YOLO might not detect it,
    # the test will still trigger the fusion flow and use the sensor score).
    # If YOLO returns 0 confidence, fusion will still calculate based on the high sensor scores.
    img = Image.new('RGB', (416, 416), color = 'red')
    img_byte_arr = BytesIO()
    img.save(img_byte_arr, format='JPEG')
    img_byte_arr = img_byte_arr.getvalue()
    
    files = {
        'file': ('dummy_fire.jpg', img_byte_arr, 'image/jpeg')
    }
    data = {
        'device_id': device_id,
        'room_id': room_id
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/detection/image", files=files, data=data)
        resp.raise_for_status()
        detection_result = resp.json()
        print(f"✅ Image processed successfully.")
        print(f"--- Detection Result ---")
        print(json.dumps(detection_result, indent=2))
        
        print("\nNote: The late fusion is processed asynchronously via Redis Streams.")
        print("To see the final fusion result, you would check the dashboard or alert tables.")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to send image: {e}")
        if hasattr(e.response, 'text'):
            print(e.response.text)
        return

    print("\n✅ Test script finished.")

if __name__ == "__main__":
    run_test()
