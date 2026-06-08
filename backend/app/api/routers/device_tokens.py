from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from app.api.deps import CurrentUser
from app.core.db import supabase
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class DeviceTokenRequest(BaseModel):
    fcm_token: str = Field(..., description="FCM/APNs device push token")
    platform: str = Field(default="android", description="Device platform: android or ios")


@router.post("/device-tokens/register")
async def register_device_token(
    req: DeviceTokenRequest,
    current_user: CurrentUser,
):
    """
    Register or update an FCM device token for push notifications.
    Tokens are upserted — re-registering with the same token is idempotent.
    """
    try:
        # Check if token already exists for this user
        existing = (
            supabase.table("device_tokens")
            .select("id")
            .eq("user_id", current_user.id)
            .eq("fcm_token", req.fcm_token)
            .execute()
        )

        if existing.data:
            # Token already registered — update platform and timestamp
            supabase.table("device_tokens").update(
                {
                    "platform": req.platform,
                }
            ).eq("id", existing.data[0]["id"]).execute()
        else:
            # New token — insert
            supabase.table("device_tokens").insert(
                {
                    "user_id": current_user.id,
                    "fcm_token": req.fcm_token,
                    "platform": req.platform,
                }
            ).execute()

        logger.info(
            f"Device token registered for user {current_user.id} "
            f"(platform: {req.platform})"
        )
        return {"status": "ok", "message": "Device token registered"}

    except Exception as e:
        logger.error(f"Failed to register device token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register device token",
        )
