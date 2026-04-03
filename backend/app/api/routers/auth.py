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
    response: Response,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
):
    """
    Login endpoint. Checks credentials against the DB,
    sets a secure HttpOnly cookie for the JWT, and returns a CSRF token.
    """
    # Fetch user from DB
    user_res = supabase.table("users").select("*").eq("email", form_data.username).execute()
    users = user_res.data
    
    if not users or not security.verify_password(form_data.password, users[0]["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )
        
    user = users[0]
    if not user.get("is_active", True):
        raise HTTPException(status_code=400, detail="Inactive user")

    # Generate a random CSRF token
    csrf_token = secrets.token_urlsafe(32)

    # Generate the JWT including the CSRF token
    access_token = security.create_access_token(subject=user["id"], csrf_token=csrf_token)
    
    # Set the JWT as an HttpOnly, Secure cookie
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        secure=True, # Should be False for localhost HTTP development, but True is best practice
        samesite="lax",
        max_age=8 * 24 * 60 * 60 # 8 days in seconds
    )

    return {
        "message": "Successfully logged in",
        "csrf_token": csrf_token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "role": user["role"]
        }
    }

@router.post("/logout")
def logout(response: Response):
    """
    Clears the access token cookie to log the user out.
    """
    response.delete_cookie(
        key="access_token", 
        path="/", 
        samesite="lax",
        httponly=True,
        secure=True
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
    Get current user profile based on HttpOnly cookie and expose CSRF token.
    """
    token = request.cookies.get("access_token")
    if token:
        try:
            payload = jwt.decode(token, app.core.config.settings.SECRET_KEY, algorithms=["HS256"])
            csrf_token = payload.get("csrf_token")
            if csrf_token:
               response.headers["X-CSRF-Token"] = csrf_token
               response.headers["Access-Control-Expose-Headers"] = "X-CSRF-Token"
        except jwt.PyJWTError:
            pass
    return current_user
