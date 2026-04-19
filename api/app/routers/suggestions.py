"""AI Suggestions router"""
from fastapi import APIRouter, Depends
from typing import Optional
from pydantic import BaseModel

from app.database.connection import get_supabase_client
from app.routers.auth import get_current_user

router = APIRouter()


class SuggestionFeedback(BaseModel):
    feedback: str  # accept, reject, snooze, done
    note: Optional[str] = None


@router.get("/suggestions")
async def get_suggestions(
    is_active: Optional[bool] = True,
    current_user: dict = Depends(get_current_user)
):
    """Get AI suggestions"""
    client = get_supabase_client()
    
    query = client.table("ai_suggestions").select(
        "*, life_stage_profiles!inner(user_id)"
    ).eq("life_stage_profiles.user_id", current_user["id"])
    
    if is_active is not None:
        query = query.eq("is_active", is_active)
    
    result = query.order("created_at", desc=True).execute()
    return {"suggestions": result.data}


@router.post("/suggestions/{suggestion_id}/feedback")
async def update_suggestion_feedback(
    suggestion_id: int,
    feedback: SuggestionFeedback,
    current_user: dict = Depends(get_current_user)
):
    """Update suggestion with user feedback"""
    client = get_supabase_client()
    
    # Verify ownership
    check = client.table("ai_suggestions").select(
        "*, life_stage_profiles!inner(user_id)"
    ).eq("id", suggestion_id).eq("life_stage_profiles.user_id", current_user["id"]).execute()
    
    if not check.data:
        return {"error": "Suggestion not found"}
    
    # Update
    result = client.table("ai_suggestions").update({
        "user_feedback": feedback.feedback,
        "user_note": feedback.note,
        "is_active": feedback.feedback not in ["accept", "reject"]
    }).eq("id", suggestion_id).execute()
    
    return {"suggestion": result.data[0]}


@router.get("/suggestions/decision-trail")
async def get_decision_trail(
    current_user: dict = Depends(get_current_user)
):
    """Get history of all suggestions and decisions"""
    client = get_supabase_client()
    
    result = client.table("ai_suggestions").select(
        "*, life_stage_profiles!inner(user_id)"
    ).eq("life_stage_profiles.user_id", current_user["id"]).order("created_at", desc=True).execute()
    
    return {"trail": result.data}