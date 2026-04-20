"""Authenticated tests for suggestions router"""
import pytest
from datetime import datetime

from app.database.models import LifeStageProfile, AISuggestion


@pytest.mark.integration
class TestSuggestionsRouterAuthenticated:
    """Tests for suggestions router with authentication"""
    
    def test_get_suggestions_empty(self, authenticated_client, test_user):
        """Test getting suggestions when user has none"""
        # Need to create a life stage profile first
        response = authenticated_client.get("/api/v1/suggestions")
        
        assert response.status_code == 200
        data = response.json()
        assert "suggestions" in data
        assert data["suggestions"] == []
    
    def test_get_suggestions_active_only(self, authenticated_client, test_user, db_session):
        """Test default is_active=true filter returns only active suggestions"""
        # Create life stage profile
        profile = LifeStageProfile(user_id=test_user.id, age=35, risk_tolerance=7)
        db_session.add(profile)
        db_session.flush()
        
        # Create active suggestion
        active = AISuggestion(
            life_stage_profile_id=profile.id,
            suggestion_type="rebalance",
            action_json='{"action": "rebalance"}',
            reasoning_text="Portfolio drifted",
            confidence_score=0.85,
            priority="high",
            is_active=True
        )
        # Create inactive suggestion
        inactive = AISuggestion(
            life_stage_profile_id=profile.id,
            suggestion_type="tax_loss",
            action_json='{"action": "harvest"}',
            reasoning_text="Tax loss opportunity",
            confidence_score=0.75,
            priority="medium",
            is_active=False
        )
        db_session.add_all([active, inactive])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/suggestions?is_active=true")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["suggestions"]) == 1
        assert data["suggestions"][0]["suggestion_type"] == "rebalance"
    
    def test_get_suggestions_inactive(self, authenticated_client, test_user, db_session):
        """Test is_active=false returns dismissed suggestions"""
        profile = LifeStageProfile(user_id=test_user.id, age=35, risk_tolerance=7)
        db_session.add(profile)
        db_session.flush()
        
        active = AISuggestion(
            life_stage_profile_id=profile.id,
            suggestion_type="rebalance",
            action_json='{}',
            reasoning_text="Drifted",
            confidence_score=0.85,
            is_active=True
        )
        inactive = AISuggestion(
            life_stage_profile_id=profile.id,
            suggestion_type="tax_loss",
            action_json='{}',
            reasoning_text="Tax opportunity",
            confidence_score=0.75,
            is_active=False,
            user_feedback="accept"
        )
        db_session.add_all([active, inactive])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/suggestions?is_active=false")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["suggestions"]) == 1
        assert data["suggestions"][0]["suggestion_type"] == "tax_loss"
    
    def test_get_suggestions_with_data(self, authenticated_client, test_user, db_session):
        """Test suggestions return full objects with all fields"""
        profile = LifeStageProfile(user_id=test_user.id, age=35, risk_tolerance=7)
        db_session.add(profile)
        db_session.flush()
        
        suggestion = AISuggestion(
            life_stage_profile_id=profile.id,
            suggestion_type="rebalance",
            action_json='{"action": "rebalance", "target": "VTI"}',
            reasoning_text="Portfolio has drifted from target allocation",
            reasoning_json='{"drift_pct": 5.2}',
            confidence_score=0.85,
            priority="high",
            user_feedback=None,
            user_note=None,
            is_active=True
        )
        db_session.add(suggestion)
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/suggestions")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["suggestions"]) == 1
        
        s = data["suggestions"][0]
        assert s["suggestion_type"] == "rebalance"
        assert s["action_json"] == '{"action": "rebalance", "target": "VTI"}'
        assert s["reasoning_text"] == "Portfolio has drifted from target allocation"
        assert s["reasoning_json"] == '{"drift_pct": 5.2}'
        assert s["confidence_score"] == 0.85
        assert s["priority"] == "high"
        assert s["is_active"] is True
    
    def test_get_suggestions_sorts_by_created_desc(self, authenticated_client, test_user, db_session):
        """Test suggestions sorted by created_at desc"""
        import time
        
        profile = LifeStageProfile(user_id=test_user.id, age=35, risk_tolerance=7)
        db_session.add(profile)
        db_session.flush()
        
        old = AISuggestion(
            life_stage_profile_id=profile.id,
            suggestion_type="old",
            action_json='{}',
            reasoning_text="Old",
            confidence_score=0.5,
            is_active=True
        )
        db_session.add(old)
        db_session.commit()
        
        time.sleep(0.01)
        
        new = AISuggestion(
            life_stage_profile_id=profile.id,
            suggestion_type="new",
            action_json='{}',
            reasoning_text="New",
            confidence_score=0.6,
            is_active=True
        )
        db_session.add(new)
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/suggestions")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["suggestions"]) == 2
        # Newest first
        assert data["suggestions"][0]["suggestion_type"] == "new"
    
    def test_update_suggestion_feedback_accept(self, authenticated_client, test_user, db_session):
        """Test accepting a suggestion"""
        profile = LifeStageProfile(user_id=test_user.id, age=35, risk_tolerance=7)
        db_session.add(profile)
        db_session.flush()
        
        suggestion = AISuggestion(
            life_stage_profile_id=profile.id,
            suggestion_type="rebalance",
            action_json='{}',
            reasoning_text="Drifted",
            confidence_score=0.85,
            is_active=True
        )
        db_session.add(suggestion)
        db_session.commit()
        
        response = authenticated_client.post(
            f"/api/v1/suggestions/{suggestion.id}/feedback",
            json={"feedback": "accept", "note": "Will do this today"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["suggestion"]["user_feedback"] == "accept"
        assert data["suggestion"]["user_note"] == "Will do this today"
        assert data["suggestion"]["is_active"] is False
    
    def test_update_suggestion_feedback_reject(self, authenticated_client, test_user, db_session):
        """Test rejecting a suggestion"""
        profile = LifeStageProfile(user_id=test_user.id, age=35, risk_tolerance=7)
        db_session.add(profile)
        db_session.flush()
        
        suggestion = AISuggestion(
            life_stage_profile_id=profile.id,
            suggestion_type="rebalance",
            action_json='{}',
            reasoning_text="Drifted",
            confidence_score=0.85,
            is_active=True
        )
        db_session.add(suggestion)
        db_session.commit()
        
        response = authenticated_client.post(
            f"/api/v1/suggestions/{suggestion.id}/feedback",
            json={"feedback": "reject", "note": "Not applicable"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["suggestion"]["user_feedback"] == "reject"
        assert data["suggestion"]["is_active"] is False
    
    def test_update_suggestion_feedback_snooze(self, authenticated_client, test_user, db_session):
        """Test snoozing a suggestion"""
        profile = LifeStageProfile(user_id=test_user.id, age=35, risk_tolerance=7)
        db_session.add(profile)
        db_session.flush()
        
        suggestion = AISuggestion(
            life_stage_profile_id=profile.id,
            suggestion_type="rebalance",
            action_json='{}',
            reasoning_text="Drifted",
            confidence_score=0.85,
            is_active=True
        )
        db_session.add(suggestion)
        db_session.commit()
        
        response = authenticated_client.post(
            f"/api/v1/suggestions/{suggestion.id}/feedback",
            json={"feedback": "snooze"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["suggestion"]["user_feedback"] == "snooze"
        # Snoozed suggestions should still be active
        assert data["suggestion"]["is_active"] is True
    
    def test_update_suggestion_not_found(self, authenticated_client):
        """Test 404 for non-existent suggestion"""
        response = authenticated_client.post(
            "/api/v1/suggestions/99999/feedback",
            json={"feedback": "accept"}
        )
        
        assert response.status_code == 404
    
    def test_update_suggestion_unauthorized(self, authenticated_client, db_session):
        """Test can't update other user's suggestion"""
        from app.database.models import User
        from app.routers.auth import get_password_hash
        
        # Create another user with suggestion
        other_user = User(email="other@example.com", password_hash=get_password_hash("pass"))
        db_session.add(other_user)
        db_session.flush()
        
        other_profile = LifeStageProfile(user_id=other_user.id, age=35, risk_tolerance=7)
        db_session.add(other_profile)
        db_session.flush()
        
        other_suggestion = AISuggestion(
            life_stage_profile_id=other_profile.id,
            suggestion_type="rebalance",
            action_json='{}',
            reasoning_text="Drifted",
            confidence_score=0.85,
            is_active=True
        )
        db_session.add(other_suggestion)
        db_session.commit()
        
        response = authenticated_client.post(
            f"/api/v1/suggestions/{other_suggestion.id}/feedback",
            json={"feedback": "accept"}
        )
        
        assert response.status_code == 404
    
    def test_get_decision_trail(self, authenticated_client, test_user, db_session):
        """Test decision trail returns history of all suggestions"""
        profile = LifeStageProfile(user_id=test_user.id, age=35, risk_tolerance=7)
        db_session.add(profile)
        db_session.flush()
        
        # Create suggestions with different statuses
        accepted = AISuggestion(
            life_stage_profile_id=profile.id,
            suggestion_type="accepted_action",
            action_json='{}',
            reasoning_text="Was good",
            confidence_score=0.9,
            priority="high",
            user_feedback="accept",
            is_active=False
        )
        rejected = AISuggestion(
            life_stage_profile_id=profile.id,
            suggestion_type="rejected_action",
            action_json='{}',
            reasoning_text="Was bad",
            confidence_score=0.6,
            priority="low",
            user_feedback="reject",
            is_active=False
        )
        active = AISuggestion(
            life_stage_profile_id=profile.id,
            suggestion_type="pending_action",
            action_json='{}',
            reasoning_text="Deciding",
            confidence_score=0.75,
            priority="medium",
            is_active=True
        )
        db_session.add_all([accepted, rejected, active])
        db_session.commit()
        
        response = authenticated_client.get("/api/v1/suggestions/decision-trail")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["trail"]) == 3
        
        # Should include all suggestions with their feedback
        feedbacks = {t["user_feedback"]: t for t in data["trail"]}
        assert "accept" in feedbacks
        assert "reject" in feedbacks
        assert None in feedbacks  # Active suggestion has no feedback
    
    def test_suggestion_is_active_logic(self, authenticated_client, test_user, db_session):
        """Test that accept/reject sets is_active=false but snooze keeps it true"""
        profile = LifeStageProfile(user_id=test_user.id, age=35, risk_tolerance=7)
        db_session.add(profile)
        db_session.flush()
        
        for feedback in ["accept", "reject", "done"]:
            suggestion = AISuggestion(
                life_stage_profile_id=profile.id,
                suggestion_type=f"test_{feedback}",
                action_json='{}',
                reasoning_text="Test",
                confidence_score=0.8,
                is_active=True
            )
            db_session.add(suggestion)
            db_session.commit()
            
            response = authenticated_client.post(
                f"/api/v1/suggestions/{suggestion.id}/feedback",
                json={"feedback": feedback}
            )
            
            assert response.status_code == 200
            # accept, reject set is_active=False; done keeps it active=True
            if feedback in ["accept", "reject"]:
                assert response.json()["suggestion"]["is_active"] is False
            else:
                assert response.json()["suggestion"]["is_active"] is True
