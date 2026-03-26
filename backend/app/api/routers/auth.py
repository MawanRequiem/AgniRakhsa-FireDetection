from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated
from app.core import security

router = APIRouter()

@router.post("/token")
def login_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
):
    """
    OAuth2 compatible token login. Mock implementation for testuser.
    """
    if form_data.username != "testuser" or form_data.password != "testpass":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username or password",
        )
        
    access_token = security.create_access_token(subject=form_data.username)
    return {"access_token": access_token, "token_type": "bearer"}
