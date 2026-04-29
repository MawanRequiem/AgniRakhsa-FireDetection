from fastapi import APIRouter, HTTPException, status, Query
from typing import List, Optional
from uuid import UUID
from app.core.db import supabase
from app.schemas.contact import Contact, ContactCreate, ContactUpdate
from app.api.deps import CurrentUser

router = APIRouter()

@router.get("/", response_model=List[Contact])
async def list_contacts(
    current_user: CurrentUser,
    active_only: bool = Query(False)
):
    """
    List all emergency contacts.
    """
    query = supabase.table("contacts").select("*")
    if active_only:
        query = query.eq("is_active", True)
    
    res = query.order("created_at").execute()
    return res.data

@router.post("/", response_model=Contact, status_code=status.HTTP_201_CREATED)
async def create_contact(
    contact_in: ContactCreate,
    current_user: CurrentUser
):
    """
    Add a new emergency contact.
    """
    res = supabase.table("contacts").insert(contact_in.dict()).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create contact"
        )
    return res.data[0]

@router.patch("/{contact_id}", response_model=Contact)
async def update_contact(
    contact_id: UUID,
    contact_in: ContactUpdate,
    current_user: CurrentUser
):
    """
    Update an existing contact.
    """
    # Filter out None values
    update_data = {k: v for k, v in contact_in.dict().items() if v is not None}
    
    res = supabase.table("contacts").update(update_data).eq("id", str(contact_id)).execute()
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )
    return res.data[0]

@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: UUID,
    current_user: CurrentUser
):
    """
    Remove an emergency contact.
    """
    res = supabase.table("contacts").delete().eq("id", str(contact_id)).execute()
    if not res.data:
        # Check if actually deleted or just not found
        pass
    return None
