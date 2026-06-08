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


def send_push(
    title: str,
    body: str,
    data: Optional[dict] = None,
    image_url: Optional[str] = None,
) -> int:
    """
    Send FCM push notification to all registered device tokens.

    Returns the number of successfully sent messages.
    """
    app = _get_app()
    if app is None:
        logger.warning("Firebase not initialized — skipping push notification")
        return 0

    from app.core.db import supabase

    try:
        res = supabase.table("device_tokens").select("fcm_token").execute()
        tokens = [r["fcm_token"] for r in res.data] if res.data else []
    except Exception as e:
        logger.error(f"Failed to fetch device tokens: {e}")
        return 0

    if not tokens:
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
