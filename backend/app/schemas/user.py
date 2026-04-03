from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID

class UserBase(BaseModel):
    email: EmailStr
    is_active: bool = True
    role: str = "user"

class UserCreate(UserBase):
    password: str

class UserInDBBase(UserBase):
    id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserOut(UserInDBBase):
    pass
