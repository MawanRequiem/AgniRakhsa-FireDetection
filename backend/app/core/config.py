from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "AgniRakhsa API"
    API_V1_STR: str = "/api/v1"
    
    # JWT Auth
    SECRET_KEY: str = "ag-super-secret-key-pls-change-in-prod-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    # Device Provisioning Security
    DEVICE_PROVISIONING_KEY: str = "CHANGE-ME-factory-provisioning-master-key"
    DEVICE_AUTH_TIMESTAMP_TOLERANCE: int = 300  # seconds (5 min window)
    ALLOW_UNSIGNED_PROVISION: bool = True  # Grace period for migration

    # Supabase Connection
    SUPABASE_URL: str
    SUPABASE_KEY: str
    
    # Redis Cache Configuration
    USE_REDIS: bool = True
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""
    
    # WhatsApp Gateway Configuration
    GATEWAY_URL: str = "http://whatsapp-gateway:3001"
    GATEWAY_API_KEY: str = "agniraksha-secure-key-2026"

    # Firebase Cloud Messaging
    FIREBASE_CREDENTIALS_PATH: str = "firebase-credentials.json"
    
    # AI Model Configuration
    MODEL_PATH: str = "app/ai/yolo/fire_detection_model.pt"
    MODEL_TYPE: str = "yolo"  # "yolo" | "custom_rf", etc.
    MODEL_CONFIDENCE_THRESHOLD: float = 0.25
    MODEL_INPUT_SIZE: int = 416

    # Sensor Anomaly Model (Isolation Forest)
    SENSOR_MODEL_DIR: str = "app/ai/iot_sensor"

    # Late Fusion Weights
    FUSION_WEIGHT_IMAGE: float = 0.55
    FUSION_WEIGHT_SENSOR: float = 0.45

    # Risk Level Thresholds
    RISK_THRESHOLD_LOW: float = 0.2
    RISK_THRESHOLD_MEDIUM: float = 0.4
    RISK_THRESHOLD_HIGH: float = 0.6
    RISK_THRESHOLD_CRITICAL: float = 0.8

    # Alert Suppression (Anti-Spam)
    ALERT_COOLDOWN_SECONDS: int = 300           # 5 min grace period after last alert
    SENSOR_ONLY_THRESHOLD: float = 0.7          # Min sensor score for Path 3 (camera-less)
    SENSOR_ONLY_CONSECUTIVE_WINDOWS: int = 3    # Consecutive windows needed for Path 3 alert
    WA_CONTACT_COOLDOWN_SECONDS: int = 600      # 10 min per-contact WhatsApp rate limit
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

settings = Settings()
