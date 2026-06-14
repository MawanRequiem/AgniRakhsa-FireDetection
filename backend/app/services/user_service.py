from app.core.db import supabase, supabase_admin
from typing import Optional, Dict, Any

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Fetch a user by email from the standard supabase client."""
    res = supabase.table("users").select("*").eq("email", email).execute()
    if res.data:
        return res.data[0]
    return None

def check_email_exists(email: str) -> bool:
    """Check if an email already exists."""
    res = supabase.table("users").select("id").eq("email", email).execute()
    return len(res.data) > 0

def create_user_admin(email: str, password_hash: str, role: str = "user") -> Optional[Dict[str, Any]]:
    """
    Create a user using the service_role client to bypass RLS.
    Returns the created user dict or None if creation failed.
    """
    if not supabase_admin:
        return None
        
    res = supabase_admin.table("users").insert({
        "email": email,
        "password_hash": password_hash,
        "role": role,
        "is_active": True,
    }).execute()
    
    if res.data:
        return res.data[0]
    return None
