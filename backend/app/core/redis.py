import redis
import redis.asyncio as redis_async
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class RedisManager:
    def __init__(self):
        self.client = None
        self.async_client = None
        self.is_connected = False

    def connect(self):
        if not settings.USE_REDIS:
            logger.info("Redis is disabled by configuration (USE_REDIS = False)")
            return
            
        try:
            logger.info(f"Connecting to Redis at {settings.REDIS_HOST}:{settings.REDIS_PORT} db={settings.REDIS_DB}")
            self.client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                password=settings.REDIS_PASSWORD or None,
                decode_responses=True,
                socket_timeout=2.0
            )
            # Test connection with a ping
            self.client.ping()
            
            # Initialize async client
            self.async_client = redis_async.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                password=settings.REDIS_PASSWORD or None,
                decode_responses=True,
                socket_timeout=2.0
            )
            
            self.is_connected = True
            logger.info("Successfully connected to Redis Cache Server")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}. Falling back to PostgreSQL-only mode.")
            self.is_connected = False
            self.client = None
            self.async_client = None

    def get_client(self):
        if not self.is_connected:
            return None
        return self.client

    def get_async_client(self):
        if not self.is_connected:
            return None
        return self.async_client

redis_manager = RedisManager()
