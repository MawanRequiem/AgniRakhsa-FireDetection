from supabase import create_client, Client
from app.core.config import settings

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

# Service-role client for operations that must bypass RLS
# (e.g., user registration where the users table has RLS enabled).
supabase_admin: Client | None = None

if settings.SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase_admin = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
    except Exception:
        supabase_admin = None
