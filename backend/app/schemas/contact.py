from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional

class ContactBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=10, max_length=20, description="Phone number with country code")
    role: str = Field("security", description="Role: admin, security, manager")
    is_active: bool = True

class ContactCreate(ContactBase):
    pass

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class Contact(ContactBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
