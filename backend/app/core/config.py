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
    GATEWAY_URL: str = "http://localhost:3001"
    GATEWAY_API_KEY: str = "agniraksha-secure-key-2026"
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

settings = Settings()
