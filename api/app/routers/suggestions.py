"""AI Suggestions router - SQLite edition"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import AISuggestion, LifeStageProfile
from app.routers.auth import get_current_user

router = APIRouter()


class SuggestionFeedback(BaseModel):
    feedback: str  # accept, reject, snooze, done
    note: Optional[str] = None


@router.get("/suggestions")
async def get_suggestions(
    is_active: Optional[bool] = True,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get AI suggestions"""
    query = db.query(AISuggestion).join(LifeStageProfile).filter(
        LifeStageProfile.user_id == current_user.id
    )
    
    if is_active is not None:
        query = query.filter(AISuggestion.is_active == is_active)
    
    suggestions = query.order_by(AISuggestion.created_at.desc()).all()
    
    return {
        "suggestions": [
            {
                "id": s.id,
                "suggestion_type": s.suggestion_type,
                "action_json": s.action_json,
                "reasoning_text": s.reasoning_text,
                "reasoning_json": s.reasoning_json,
                "confidence_score": s.confidence_score,
                "priority": s.priority,
                "user_feedback": s.user_feedback,
                "user_note": s.user_note,
                "is_active": s.is_active,
                "created_at": s.created_at
            }
            for s in suggestions
        ]
    }


@router.post("/suggestions/{suggestion_id}/feedback")
async def update_suggestion_feedback(
    suggestion_id: int,
    feedback: SuggestionFeedback,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update suggestion with user feedback"""
    # Verify ownership
    suggestion = db.query(AISuggestion).join(LifeStageProfile).filter(
        AISuggestion.id == suggestion_id,
        LifeStageProfile.user_id == current_user.id
    ).first()
    
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    # Update
    suggestion.user_feedback = feedback.feedback
    suggestion.user_note = feedback.note
    suggestion.is_active = feedback.feedback not in ["accept", "reject"]
    
    db.commit()
    db.refresh(suggestion)
    
    return {
        "suggestion": {
            "id": suggestion.id,
            "user_feedback": suggestion.user_feedback,
            "user_note": suggestion.user_note,
            "is_active": suggestion.is_active
        }
    }


@router.get("/suggestions/decision-trail")
async def get_decision_trail(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get history of all suggestions and decisions"""
    suggestions = db.query(AISuggestion).join(LifeStageProfile).filter(
        LifeStageProfile.user_id == current_user.id
    ).order_by(AISuggestion.created_at.desc()).all()
    
    return {
        "trail": [
            {
                "id": s.id,
                "suggestion_type": s.suggestion_type,
                "reasoning_text": s.reasoning_text,
                "confidence_score": s.confidence_score,
                "priority": s.priority,
                "user_feedback": s.user_feedback,
                "is_active": s.is_active,
                "created_at": s.created_at
            }
            for s in suggestions
        ]
    }