"""Test configuration and fixtures"""
import os
import sys
import tempfile
import uuid
import pytest
import shutil
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.models import Base, User, Institution, Account
from app.database import get_db
from app.main import app
from app.routers.auth import create_access_token, get_password_hash


@pytest.fixture(scope="function")
def test_db_dir():
    """Create a temporary directory for test database files"""
    temp_dir = tempfile.mkdtemp(prefix="test_pf_")
    yield temp_dir
    # Cleanup after test
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture(scope="function")
def test_db_path(test_db_dir):
    """Generate a unique database file path in the temp directory"""
    test_id = str(uuid.uuid4())[:8]
    path = os.path.join(test_db_dir, f"test_{test_id}.db")
    return path


@pytest.fixture(scope="function")
def db_engine(test_db_path):
    """Create database engine using shared file path"""
    database_url = f"sqlite:///{test_db_path}"
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    """Create a database session"""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(test_db_path):
    """Test client using the same database file as db_session"""
    database_url = f"sqlite:///{test_db_path}"
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False}
    )
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    del app.dependency_overrides[get_db]


@pytest.fixture(scope="function")
def test_data_dir():
    """Create temporary directory for test data"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture(scope="function")
def test_user(db_session):
    """Create a test user for tests that need one"""
    user = User(
        email="test@example.com",
        password_hash=get_password_hash("testpassword123")
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def auth_token(test_user):
    """Generate JWT token for test user"""
    return create_access_token({"sub": test_user.email})


@pytest.fixture(scope="function")
def authenticated_client(client, auth_token):
    """Test client with authentication header"""
    client.headers["Authorization"] = f"Bearer {auth_token}"
    return client


@pytest.fixture(scope="function")
def test_institution(db_session):
    """Create a test institution"""
    institution = Institution(
        name="Test Bank",
        type="bank"
    )
    db_session.add(institution)
    db_session.commit()
    db_session.refresh(institution)
    return institution


@pytest.fixture(scope="function")
def test_account(db_session, test_user, test_institution):
    """Create a test account for the test user"""
    account = Account(
        user_id=test_user.id,
        institution_id=test_institution.id,
        name="Test Checking",
        account_type="checking",
        account_number_masked="****1234"
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return account


@pytest.fixture
def sample_brokerage_data():
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
            }
        ],
        "cash": {"settled_cash": 5000.00},
        "total_value": 60263.21,
        "extraction_confidence": 0.94
    }


@pytest.fixture
def sample_credit_card_data():
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
            }
        ],
        "extraction_confidence": 0.91
    }


@pytest.fixture
def mock_kimi_response():
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