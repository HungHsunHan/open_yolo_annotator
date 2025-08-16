import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy.exc import SQLAlchemyError
from models import User, UserRole


class TestDatabaseInitialization:
    """Test database initialization and default user creation"""
    
    def test_init_database_creates_default_users(self):
        """Test that init_database creates default admin and annotator users"""
        from database import init_database, SessionLocal
        
        # Create a test database session
        db = SessionLocal()
        try:
            # Clear any existing users
            db.query(User).delete()
            db.commit()
            
            # Call init_database
            init_database()
            
            # Verify users were created
            users = db.query(User).all()
            assert len(users) == 2
            
            # Check admin user
            admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
            assert admin_user is not None
            assert admin_user.username == "tcci"
            assert admin_user.role == UserRole.ADMIN
            
            # Check annotator user  
            annotator_user = db.query(User).filter(User.role == UserRole.ANNOTATOR).first()
            assert annotator_user is not None
            assert annotator_user.username == "tcc"
            assert annotator_user.role == UserRole.ANNOTATOR
        finally:
            db.close()
    
    def test_init_database_skips_existing_users(self, admin_user):
        """Test that init_database doesn't create users if they already exist"""
        from database import init_database, SessionLocal
        
        db = SessionLocal()
        try:
            initial_count = db.query(User).count()
            
            # Call init_database again
            init_database()
            
            # Should not create additional users
            final_count = db.query(User).count()
            assert final_count == initial_count
        finally:
            db.close()
    
    @patch('database.SessionLocal')
    def test_init_database_handles_database_errors(self, mock_session_local):
        """Test that init_database handles database connection errors"""
        from database import init_database
        
        # Mock database session to raise an error
        mock_session = MagicMock()
        mock_session.query.side_effect = SQLAlchemyError("Database connection failed")
        mock_session_local.return_value = mock_session
        
        # Should not raise an exception
        try:
            init_database()
        except Exception as e:
            pytest.fail(f"init_database raised an exception: {e}")
        
        # Verify rollback was called
        mock_session.rollback.assert_called_once()
        mock_session.close.assert_called_once()
    
    @patch('database.SessionLocal')
    def test_init_database_handles_commit_errors(self, mock_session_local):
        """Test that init_database handles commit errors gracefully"""
        from database import init_database
        
        # Mock database session to raise error on commit
        mock_session = MagicMock()
        mock_session.query.return_value.count.return_value = 0  # No existing users
        mock_session.commit.side_effect = SQLAlchemyError("Commit failed")
        mock_session_local.return_value = mock_session
        
        # Should not raise an exception
        try:
            init_database()
        except Exception as e:
            pytest.fail(f"init_database raised an exception: {e}")
        
        # Verify rollback was called after commit error
        mock_session.rollback.assert_called_once()
        mock_session.close.assert_called_once()


class TestDatabaseConnection:
    """Test database connection and session management"""
    
    def test_get_db_session_creation(self):
        """Test that get_db creates a valid database session"""
        from database import get_db
        
        # Get database session generator
        db_gen = get_db()
        
        # Get the actual session
        session = next(db_gen)
        
        # Verify it's a valid session
        assert session is not None
        assert hasattr(session, 'query')
        assert hasattr(session, 'commit')
        assert hasattr(session, 'rollback')
        
        # Clean up
        try:
            next(db_gen)
        except StopIteration:
            pass  # Expected
    
    def test_database_tables_exist(self, test_db_session):
        """Test that all required database tables exist"""
        from models import User, Project, Image, Annotation
        
        # These should not raise exceptions if tables exist
        try:
            test_db_session.query(User).first()
            test_db_session.query(Project).first()
            test_db_session.query(Image).first()
            test_db_session.query(Annotation).first()
        except Exception as e:
            pytest.fail(f"Database tables are not properly created: {e}")