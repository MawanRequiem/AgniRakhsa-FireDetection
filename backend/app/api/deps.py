from typing import Annotated, Optional
from fastapi import Depends, HTTPException, status, Request
import jwt
from pydantic import ValidationError, BaseModel
from app.core.config import settings
from app.core.db import supabase

class User(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool = True

def get_token_from_cookie(request: Request) -> str:
    authorization: str = request.cookies.get("access_token")
    if not authorization:
        # Fallback to header for tools that don't support cookies well
        authorization = request.headers.get("Authorization")
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    
    scheme, _, param = authorization.partition(" ")
    if scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    return param

def get_current_user(
    request: Request,
    token: Annotated[str, Depends(get_token_from_cookie)]
) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = payload.get("sub")
        jwt_csrf = payload.get("csrf")
    except (jwt.PyJWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # CSRF Verification for state-changing requests (POST, PUT, DELETE, PATCH)
    if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
        header_csrf = request.headers.get("X-CSRF-Token")
        if not header_csrf or header_csrf != jwt_csrf:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token validation failed",
            )
            
    if not token_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Fetch user from DB
    user_res = supabase.table("users").select("*").eq("id", token_data).execute()
    users = user_res.data
    
    if not users:
        raise HTTPException(status_code=404, detail="User not found")
        
    user_data = users[0]
    if not user_data.get("is_active", True):
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return User(
        id=user_data["id"],
        email=user_data["email"],
        role=user_data["role"],
        is_active=user_data.get("is_active", True)
    )

CurrentUser = Annotated[User, Depends(get_current_user)]
