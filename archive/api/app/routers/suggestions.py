"""AI Suggestions router - SQLite edition"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import AISuggestion, LifeStageProfile

router = APIRouter()
logger = logging.getLogger("api.suggestions")


class SuggestionFeedback(BaseModel):
    feedback: str  # accept, reject, snooze, done
    note: Optional[str] = None


@router.get("/suggestions")
async def get_suggestions(
    is_active: Optional[bool] = True,
    db: Session = Depends(get_db)
):
    """Get AI suggestions"""
    logger.debug(f"Get suggestions: is_active={is_active}")
    query = db.query(AISuggestion)
    
    if is_active is not None:
        query = query.filter(AISuggestion.is_active == is_active)
    
    suggestions = query.order_by(AISuggestion.created_at.desc()).all()
    logger.info(f"Get suggestions returned: {len(suggestions)} records")
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
    db: Session = Depends(get_db)
):
    """Update suggestion with user feedback"""
    logger.info(f"Update suggestion feedback: id={suggestion_id}, feedback={feedback.feedback}")
    suggestion = db.query(AISuggestion).filter(
        AISuggestion.id == suggestion_id
    ).first()
    
    if not suggestion:
        logger.warning(f"Suggestion not found: id={suggestion_id}")
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    suggestion.user_feedback = feedback.feedback
    suggestion.user_note = feedback.note
    suggestion.is_active = feedback.feedback not in ["accept", "reject"]
    
    db.commit()
    db.refresh(suggestion)
    logger.info(f"Suggestion updated: id={suggestion_id}, new_status={suggestion.user_feedback}, active={suggestion.is_active}")
    
    return {
        "suggestion": {
            "id": suggestion.id,
            "user_feedback": suggestion.user_feedback,
            "user_note": suggestion.user_note,
            "is_active": suggestion.is_active
        }
    }


@router.get("/suggestions/decision-trail")
async def get_decision_trail(db: Session = Depends(get_db)):
    """Get history of all suggestions and decisions"""
    suggestions = db.query(AISuggestion).order_by(AISuggestion.created_at.desc()).all()
    
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
