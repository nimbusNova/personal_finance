"""Tests for database connection module"""
import pytest
import os
from unittest.mock import patch, MagicMock

from app.database import connection


@pytest.mark.unit
class TestDatabaseConnection:
    """Tests for database connection functions"""
    
    def test_get_engine_creates_engine(self):
        """Test get_engine creates and returns engine"""
        # Reset the global engine
        connection._engine = None
        
        engine = connection.get_engine()
        assert engine is not None
        
        # Second call should return same engine
        engine2 = connection.get_engine()
        assert engine == engine2
    
    def test_get_session_maker_creates_session(self):
        """Test get_session_maker creates session factory"""
        # Reset
        connection._session_maker = None
        
        session_maker = connection.get_session_maker()
        assert session_maker is not None
        
        # Second call should return same
        session_maker2 = connection.get_session_maker()
        assert session_maker == session_maker2
    
    def test_get_db_yields_session(self):
        """Test get_db yields database session"""
        db_gen = connection.get_db()
        db = next(db_gen)
        assert db is not None
        
        # Close the session
        try:
            next(db_gen)
        except StopIteration:
            pass
    
    def test_init_db_creates_tables(self):
        """Test init_db creates database tables"""
        with patch("app.database.connection.get_engine") as mock_get_engine:
            mock_engine = MagicMock()
            mock_get_engine.return_value = mock_engine
            
            with patch("app.database.models.Base") as mock_base:
                connection.init_db()
                
                # Should call create_all
                mock_base.metadata.create_all.assert_called_once()
    
    def test_get_db_path_returns_path(self):
        """Test get_db_path returns database file path"""
        path = connection.get_db_path()
        assert path is not None
        assert isinstance(path, str)
    
    def test_engine_creates_data_directory(self, tmp_path):
        """Test engine creation makes data directory if needed"""
        test_db_path = tmp_path / "data" / "test.db"
        
        with patch("app.config.get_settings") as mock_settings:
            mock_settings.return_value.db_path = str(test_db_path)
            
            # Reset engine
            connection._engine = None
            
            with patch("os.makedirs") as mock_makedirs:
                with patch("sqlalchemy.create_engine") as mock_create_engine:
                    mock_create_engine.return_value = MagicMock()
                    
                    connection.get_engine()
                    
                    # Should create directory
                    mock_makedirs.assert_called_once()
        
        # Reset engine after test
        connection._engine = None


@pytest.mark.unit
class TestDatabaseGlobals:
    """Tests for database global state"""
    
    def test_base_is_declarative(self):
        """Test Base is a declarative base"""
        from app.database.connection import Base
        assert Base is not None
