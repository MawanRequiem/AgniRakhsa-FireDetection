from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated
import secrets
from app.core import security
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
    Login endpoint. Menggunakan Supabase Auth untuk verifikasi (menghapus bcrypt manual),
    menetapkan cookie HttpOnly untuk JWT, dan mengembalikan token CSRF.
    """
    try:
        # 1. Pengecekan email & password langsung melalui layanan Autentikasi Supabase
        # Ini menghapus kebutuhan untuk security.verify_password dan pengecekan bcrypt manual
        auth_res = supabase.auth.sign_in_with_password({
            "email": form_data.username, 
            "password": form_data.password
        })
        
        user = auth_res.user
        
    except Exception:
        # Jika email atau password salah, Supabase akan melempar exception
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # 2. Generate token CSRF random (tetap menggunakan sistem keamanan Anda yang sudah ada)
    csrf_token = secrets.token_urlsafe(32)

    # 3. Generate JWT access token menggunakan ID user dari Supabase
    access_token = security.create_access_token(subject=user.id, csrf_token=csrf_token)
    
    # Set the JWT as an HttpOnly, Secure cookie
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        secure=True, # Should be False for localhost HTTP development, but True is best practice
        samesite="lax",
        max_age=8 * 24 * 60 * 60 # Berlaku 8 hari
    )

    return {
        "message": "Successfully logged in",
        "csrf_token": csrf_token,
        "user": {
            "id": user.id,
            "email": user.email,
            "role": "admin" # Anda bisa menyesuaikan ini sesuai logika metadata user di Supabase
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
            payload = jwt.decode(token, security.config.settings.SECRET_KEY, algorithms=["HS256"])
            csrf_token = payload.get("csrf_token")
            if csrf_token:
               response.headers["X-CSRF-Token"] = csrf_token
               response.headers["Access-Control-Expose-Headers"] = "X-CSRF-Token"
        except jwt.PyJWTError:
            pass
    return current_user