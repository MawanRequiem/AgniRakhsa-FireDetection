from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "AgniRakhsa API"
    API_V1_STR: str = "/api/v1"
    
    # JWT Auth
    SECRET_KEY: str = "ag-super-secret-key-pls-change-in-prod-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # Supabase Connection
    SUPABASE_URL: str
    SUPABASE_KEY: str
    
    # WhatsApp Gateway Configuration
    # WhatsApp Gateway Configuration
    GATEWAY_URL: str = "http://localhost:3001"
    GATEWAY_API_KEY: str = "agniraksha-secure-key-2026"
    
    # AI Model Configuration
    MODEL_PATH: str = "app/ai/fire_detection_model.pt"
    MODEL_TYPE: str = "yolo"  # "yolo" | "custom_rf", etc.
    MODEL_CONFIDENCE_THRESHOLD: float = 0.25
    MODEL_INPUT_SIZE: int = 416

    # Late Fusion Weights
    FUSION_WEIGHT_IMAGE: float = 0.6
    FUSION_WEIGHT_SENSOR: float = 0.4

    # Risk Level Thresholds
    RISK_THRESHOLD_LOW: float = 0.2
    RISK_THRESHOLD_MEDIUM: float = 0.4
    RISK_THRESHOLD_HIGH: float = 0.6
    RISK_THRESHOLD_CRITICAL: float = 0.8
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

settings = Settings()
