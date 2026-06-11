import logging
from typing import Optional
from firebase_admin import credentials, initialize_app, messaging

from app.core.config import settings

logger = logging.getLogger(__name__)

_app = None


def _get_app():
    """Lazy-initialize Firebase Admin SDK."""
    global _app
    if _app is None:
        try:
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            _app = initialize_app(cred)
            logger.info("Firebase Admin SDK initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
            _app = None
    return _app


def _fetch_target_tokens(room_id: Optional[str] = None) -> list[str]:
    """
    Fetch device tokens eligible for a given room notification.
    - If room_id is None: returns ALL tokens (backward-compatible broadcast).
    - If room_id is set: returns tokens belonging to:
        * All admin users
        * Basic users subscribed to this room
    Returns the list of unique FCM tokens.
    """
    from app.core.db import supabase

    if room_id is None:
        # Broadcast to all tokens
        try:
            res = supabase.table("device_tokens").select("fcm_token").execute()
            tokens = [r["fcm_token"] for r in res.data] if res.data else []
        except Exception as e:
            logger.error(f"Failed to fetch device tokens: {e}")
            tokens = []
        return tokens

    try:
        # 1. Get all admin user IDs
        admin_res = (
            supabase.table("users")
            .select("id")
            .eq("role", "admin")
            .execute()
        )
        admin_ids = {r["id"] for r in (admin_res.data or [])}

        # 2. Get basic user IDs subscribed to this room
        sub_res = (
            supabase.table("user_room_subscriptions")
            .select("user_id")
            .eq("room_id", room_id)
            .execute()
        )
        subscribed_ids = {r["user_id"] for r in (sub_res.data or [])}

        eligible_user_ids = list(admin_ids | subscribed_ids)

        if not eligible_user_ids:
            logger.info(f"No eligible users for room {room_id}")
            return []

        # 3. Fetch device tokens for eligible users
        tokens_res = (
            supabase.table("device_tokens")
            .select("fcm_token")
            .in_("user_id", eligible_user_ids)
            .execute()
        )
        tokens = [
            r["fcm_token"]
            for r in (tokens_res.data or [])
        ]

        # Deduplicate (user may have registered multiple devices)
        seen = set()
        deduped = []
        for t in tokens:
            if t and t not in seen:
                seen.add(t)
                deduped.append(t)

        logger.info(
            f"FCM targeting: {len(deduped)} tokens for room {room_id} "
            f"(admins: {len(admin_ids)}, subscribers: {len(subscribed_ids)})"
        )
        return deduped

    except Exception as e:
        logger.error(f"Failed to resolve target tokens: {e}")
        return []


def send_push(
    title: str,
    body: str,
    data: Optional[dict] = None,
    image_url: Optional[str] = None,
) -> int:
    """
    Send FCM push notification to registered device tokens.
    If `data` contains a `room_id`, only targets admin users and
    subscribed users for that room.

    Returns the number of successfully sent messages.
    """
    app = _get_app()
    if app is None:
        logger.warning("Firebase not initialized — skipping push notification")
        return 0

    room_id = data.get("room_id") if data else None
    tokens = _fetch_target_tokens(room_id)

    if not tokens:
        logger.info(f"No FCM tokens to notify for room_id={room_id}")
        return 0

    # Android config
    android_config = messaging.AndroidConfig(
        priority="high",
        notification=messaging.AndroidNotification(
            channel_id="fire_alerts",
            priority="max",
            visibility="public",
            sound="default",
        ),
    )

    # APNs config
    apns_config = messaging.APNSConfig(
        payload=messaging.APNSPayload(
            aps=messaging.Aps(
                alert=messaging.ApsAlert(title=title, body=body),
                sound="default",
                badge=1,
                mutable_content=1,
            ),
        ),
    )

    notification = messaging.Notification(title=title, body=body)
    if image_url:
        notification = messaging.Notification(
            title=title, body=body, image_url=image_url
        )

    message = messaging.MulticastMessage(
        tokens=tokens,
        notification=notification,
        data={k: str(v) for k, v in (data or {}).items()},
        android=android_config,
        apns=apns_config,
    )

    try:
        response = messaging.send_each_for_multicast(message)
        success_count = response.success_count
        logger.info(
            f"FCM push sent: {success_count}/{len(tokens)} succeeded"
        )

        # Clean up invalid tokens
        invalid_tokens = []
        for i, resp in enumerate(response.responses):
            if not resp.success:
                if messaging.is_invalid_argument(resp.exception) or messaging.is_unregistered(resp.exception):
                    invalid_tokens.append(tokens[i])

        if invalid_tokens:
            try:
                from app.core.db import supabase
                supabase.table("device_tokens").delete().in_(
                    "fcm_token", invalid_tokens
                ).execute()
                logger.info(f"Cleaned up {len(invalid_tokens)} invalid FCM tokens")
            except Exception as e:
                logger.error(f"Failed to clean up invalid tokens: {e}")

        return success_count

    except Exception as e:
        logger.error(f"FCM push failed: {e}")
        return 0
