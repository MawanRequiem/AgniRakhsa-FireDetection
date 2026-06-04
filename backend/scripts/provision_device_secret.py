import hashlib
import hmac
import serial
import time

MASTER_KEY = "replace with actual key"


def normalize_mac(mac: str) -> str:
    mac = mac.replace("-", ":").upper()
    parts = [p for p in mac.split(":") if p]

    return ":".join(part.zfill(2) for part in parts)


def derive_device_secret(mac: str) -> bytes:
    normalized = normalize_mac(mac)

    return hmac.new(
        MASTER_KEY.encode(),
        normalized.encode(),
        hashlib.sha256,
    ).digest()


mac = "AA:BB:CC:DD:EE:FF" #replace with actual MAC printed from the serial console

secret = derive_device_secret(mac)

with serial.Serial(
    "COM3",
    115200,
    timeout=5,
    dsrdtr=False,
    rtscts=False
) as ser:

    # prevent auto reset
    ser.setDTR(False)
    ser.setRTS(False)

    time.sleep(3)

    payload = f"PROVISION_KEY:{secret.hex()}\n"

    print("Sending:", payload)

    ser.write(payload.encode())
    ser.flush()

    time.sleep(1)

    while ser.in_waiting:
        print(ser.readline().decode(errors="ignore").strip())