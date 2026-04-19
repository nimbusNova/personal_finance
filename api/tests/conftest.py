"""Test configuration and fixtures"""
import os
import sys
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.models import Base
from app.database import get_db
from app.main import app


# Use file-based test database for integration tests
TEST_DB_PATH = "/tmp/test_personal_finance.db"
TEST_DATABASE_URL = f"sqlite:///{TEST_DB_PATH}"


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test"""
    # Clean up any existing test database
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
    
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Create session
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        if os.path.exists(TEST_DB_PATH):
            os.remove(TEST_DB_PATH)


@pytest.fixture(scope="function")
def client(db_session):
    """Test client for FastAPI app with test database override"""
    # Create a new engine for the test database
    from sqlalchemy import create_engine
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()
    
    # Override the dependency BEFORE creating TestClient
    app.dependency_overrides[get_db] = override_get_db
    
    # Create test client
    with TestClient(app) as test_client:
        yield test_client
    
    # Clean up override
    del app.dependency_overrides[get_db]


@pytest.fixture(scope="function")
def test_data_dir():
    """Create temporary directory for test data"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def sample_brokerage_data():
    """Sample brokerage statement extraction result"""
    return {
        "doc_type": "brokerage",
        "institution": "Charles Schwab",
        "account_type": "Individual Taxable",
        "statement_date": "2024-03-31",
        "holdings": [
            {
                "symbol": "VTI",
                "name": "Vanguard Total Stock Market ETF",
                "quantity": 150.5,
                "price": 280.42,
                "market_value": 42203.21,
                "cost_basis": 35000.00
            },
            {
                "symbol": "VXUS",
                "name": "Vanguard Total International Stock ETF",
                "quantity": 200.0,
                "price": 65.30,
                "market_value": 13060.00,
                "cost_basis": 12000.00
            }
        ],
        "cash": {
            "settled_cash": 5000.00
        },
        "total_value": 60263.21,
        "extraction_confidence": 0.94
    }


@pytest.fixture
def sample_credit_card_data():
    """Sample credit card statement extraction result"""
    return {
        "doc_type": "credit_card",
        "institution": "Chase",
        "account_name": "Chase Sapphire Preferred",
        "statement_date": "2024-03-31",
        "statement_balance": 3250.00,
        "transactions": [
            {
                "date": "2024-03-12",
                "merchant": "Whole Foods",
                "category": "Groceries",
                "amount": 142.35,
                "is_recurring": False
            },
            {
                "date": "2024-03-15",
                "merchant": "Netflix",
                "category": "Entertainment",
                "amount": 15.49,
                "is_recurring": True
            },
            {
                "date": "2024-03-20",
                "merchant": "Shell",
                "category": "Transportation",
                "amount": 45.00,
                "is_recurring": False
            }
        ],
        "extraction_confidence": 0.91
    }


@pytest.fixture
def mock_kimi_response():
    """Mock response from Kimi API"""
    return {
        "success": True,
        "data": {
            "doc_type": "brokerage",
            "institution": "Test Broker",
            "statement_date": "2024-01-01",
            "holdings": [],
            "cash": {"settled_cash": 1000},
            "extraction_confidence": 0.95
        },
        "raw_response": '{"doc_type": "brokerage"}',
        "confidence": 0.95,
        "model": "kimi-latest",
        "usage": {"prompt_tokens": 100, "completion_tokens": 50}
    }
