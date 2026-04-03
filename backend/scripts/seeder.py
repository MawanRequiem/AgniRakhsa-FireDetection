import os
import sys
from pathlib import Path

# Add the project root to the python path
sys.path.append(str(Path(__file__).parent.parent))

from app.core.security import get_password_hash
from app.core.db import supabase

def seed_admin():
    print("Seeding admin user...")
    admin_email = "admin@agniraksha.com"
    admin_password = "admin"
    
    # Check if admin already exists
    response = supabase.table("users").select("id").eq("email", admin_email).execute()
    if len(response.data) > 0:
        print(f"Admin user {admin_email} already exists.")
        return
        
    # Insert new admin
    hashed_pw = get_password_hash(admin_password)
    user_data = {
        "email": admin_email,
        "password_hash": hashed_pw,
        "role": "admin"
    }
    
    insert_response = supabase.table("users").insert(user_data).execute()
    if len(insert_response.data) > 0:
        print(f"Successfully created admin user: {admin_email} | Password: {admin_password}")
    else:
        print("Failed to create admin user.")

if __name__ == "__main__":
    seed_admin()
