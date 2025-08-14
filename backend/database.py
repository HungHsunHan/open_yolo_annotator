import os
import uuid
from contextlib import asynccontextmanager

from models import Base, User, UserRole
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

# Database URL (configurable via environment variable)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/yolo_annotation")

# For development, fallback to SQLite if PostgreSQL not available
if not os.getenv("DATABASE_URL"):
    DATABASE_URL = "sqlite:///./yolo_annotation.db"

engine = create_engine(
    DATABASE_URL,
    # SQLite specific settings
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_database():
    """Initialize database tables and default data"""
    # Import hash_password here to avoid circular import
    from auth import hash_password

    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Create default users if they don't exist
    db = SessionLocal()
    try:
        # Check if any users exist
        existing_users = db.query(User).count()
        
        if existing_users == 0:
            # Create default admin user
            admin_user = User(
                id="admin-1",
                username="tcci",
                password_hash=hash_password("tcc1"),
                role=UserRole.ADMIN
            )
            
            # Create default annotator user
            annotator_user = User(
                id="annotator-1", 
                username="tcc",
                password_hash=hash_password("tcc"),
                role=UserRole.ANNOTATOR
            )
            
            db.add(admin_user)
            db.add(annotator_user)
            db.commit()
            
            print("Created default users:")
            print("  Admin: tcci / tcc1")
            print("  Annotator: tcc / tcc")
            
    except Exception as e:
        print(f"Error creating default users: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_database()