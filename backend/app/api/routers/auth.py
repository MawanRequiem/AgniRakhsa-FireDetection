from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated
import secrets
from app.core import security
from app.core.config import settings
from app.core.db import supabase
import app.api.deps

router = APIRouter()

@router.post("/login")
def login(
    request: Request,
    response: Response,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
):
    """
    Login endpoint. Mengecek kredensial ke tabel `users` (custom auth),
    menetapkan cookie HttpOnly untuk JWT, dan mengembalikan token CSRF.
    """
    # 1. Fetch user dari tabel users
    user_res = supabase.table("users").select("*").eq("email", form_data.username).execute()
    users = user_res.data
    
    if not users or not security.verify_password(form_data.password, users[0]["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
        
    user = users[0]
    if not user.get("is_active", True):
        raise HTTPException(status_code=400, detail="Inactive user")

    # 2. Generate token CSRF random
    csrf_token = secrets.token_urlsafe(32)

    # 3. Generate JWT access token menggunakan ID user
    access_token = security.create_access_token(subject=user["id"], csrf_token=csrf_token)
    
    # Set the JWT as an HttpOnly, Secure cookie
    is_secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=8 * 24 * 60 * 60 # Berlaku 8 hari
    )

    return {
        "message": "Successfully logged in",
        "csrf_token": csrf_token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "role": user.get("role", "admin")
        }
    }

@router.post("/logout")
def logout(request: Request, response: Response):
    """
    Menghapus cookie access token untuk logout.
    """
    is_secure = request.url.scheme == "https"
    response.delete_cookie(
        key="access_token", 
        path="/", 
        samesite="lax",
        httponly=True,
        secure=is_secure
    )
    return {"message": "Successfully logged out"}

import jwt

@router.get("/me")
def read_users_me(
    response: Response,
    request: Request,
    current_user: Annotated[security.Any, Depends(app.api.deps.get_current_user)]
):
    """
    Mendapatkan profil user saat ini berdasarkan cookie dan mengekspos token CSRF.
    """
    token = request.cookies.get("access_token")
    if token:
        try:
            # Mengambil SECRET_KEY dari konfigurasi sistem Anda
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            csrf_token = payload.get("csrf_token")
            if csrf_token:
               response.headers["X-CSRF-Token"] = csrf_token
               response.headers["Access-Control-Expose-Headers"] = "X-CSRF-Token"
        except jwt.PyJWTError:
            pass
    return current_user