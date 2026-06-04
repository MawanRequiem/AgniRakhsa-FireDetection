import hashlib
import hmac
import logging
import time
from dataclasses import dataclass

from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class DeviceIdentity:
    mac_address: str


def normalize_mac(mac_address: str) -> str:
    """
    Normalize MAC address into uppercase colon-separated format.

    Example:
        aa-bb-cc-dd-ee-ff
        -> AA:BB:CC:DD:EE:FF
    """
    mac = mac_address.replace("-", ":").replace(".", ":").upper()

    # Remove accidental double separators
    parts = [p for p in mac.split(":") if p]

    if len(parts) != 6:
        raise ValueError("Invalid MAC address format")

    normalized = ":".join(part.zfill(2) for part in parts)

    return normalized


def derive_device_secret(mac_address: str) -> bytes:
    """
    Derive a per-device secret using:
        HMAC(master_key, normalized_mac)
    """
    normalized_mac = normalize_mac(mac_address)

    return hmac.new(
        settings.DEVICE_PROVISIONING_KEY.encode(),
        normalized_mac.encode(),
        hashlib.sha256,
    ).digest()


def verify_device_signature(
    mac_address: str,
    timestamp: int,
    signature: str,
) -> bool:
    """
    Verify HMAC-SHA256 signature and replay window.
    """

    try:
        normalized_mac = normalize_mac(mac_address)
    except ValueError:
        return False

    # Anti-replay timestamp validation
    now = int(time.time())

    if abs(now - timestamp) > settings.DEVICE_AUTH_TIMESTAMP_TOLERANCE:
        logger.warning(
            "Rejected device auth due to expired timestamp "
            "(mac=%s, timestamp=%s, now=%s)",
            normalized_mac,
            timestamp,
            now,
        )
        return False

    device_secret = derive_device_secret(normalized_mac)

    payload = f"{normalized_mac}:{timestamp}".encode()

    expected_signature = hmac.new(
        device_secret,
        payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(
        expected_signature,
        signature.lower(),
    )


def require_valid_device_signature(
    mac_address: str,
    timestamp: int | None,
    signature: str | None,
) -> DeviceIdentity:
    """
    Shared helper for device-authenticated endpoints.
    """

    if timestamp is None or signature is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Device signature required",
        )

    is_valid = verify_device_signature(
        mac_address=mac_address,
        timestamp=timestamp,
        signature=signature,
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid device signature",
        )

    return DeviceIdentity(
        mac_address=normalize_mac(mac_address)
    )