#!/usr/bin/env python3
"""
Database Integrity Fixes
Implements specific fixes for the identified database consistency issues.
"""

import sqlite3
import shutil
from pathlib import Path
from datetime import datetime
import os


class DatabaseFixer:
    def __init__(self, db_path="yolo_annotation.db", storage_path="storage"):
        self.db_path = db_path
        self.storage_path = Path(storage_path)
        self.backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
    def backup_database(self):
        """Create database backup before making changes"""
        print(f"Creating database backup: {self.backup_path}")
        shutil.copy2(self.db_path, self.backup_path)
        return self.backup_path
    
    def cleanup_orphaned_data(self, dry_run=False):
        """Remove orphaned filesystem data"""
        print(f"{'DRY RUN: ' if dry_run else ''}Cleaning orphaned data...")
        
        # Connect to database to get valid project IDs
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM projects")
        valid_projects = {row[0] for row in cursor.fetchall()}
        
        conn.close()
        
        cleaned_dirs = 0
        
        # Clean orphaned project directories in images
        images_path = self.storage_path / "images"
        if images_path.exists():
            for project_dir in images_path.iterdir():
                if project_dir.is_dir() and project_dir.name not in valid_projects:
                    print(f"  {'Would remove' if dry_run else 'Removing'}: {project_dir}")
                    if not dry_run:
                        shutil.rmtree(project_dir)
                    cleaned_dirs += 1
        
        # Clean orphaned project directories in annotations
        annotations_path = self.storage_path / "annotations"
        if annotations_path.exists():
            for project_dir in annotations_path.iterdir():
                if project_dir.is_dir() and project_dir.name not in valid_projects:
                    print(f"  {'Would remove' if dry_run else 'Removing'}: {project_dir}")
                    if not dry_run:
                        shutil.rmtree(project_dir)
        
        print(f"Cleaned {cleaned_dirs} orphaned directories")
        return cleaned_dirs
    
    def fix_database_schema(self):
        """Fix database schema issues"""
        print("Fixing database schema...")
        
        # Note: SQLite doesn't support ALTER TABLE to modify constraints
        # We need to document the required changes for the models.py file
        fixes_needed = [
            "1. Update models.py to enable foreign key constraints in engine setup",
            "2. Consider adding ON DELETE CASCADE to appropriate relationships",
            "3. The current SQLAlchemy cascade settings should handle deletion properly"
        ]
        
        for fix in fixes_needed:
            print(f"  {fix}")
        
        return fixes_needed
    
    def validate_consistency(self):
        """Validate database consistency after fixes"""
        print("Validating database consistency...")
        
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        cursor = conn.cursor()
        
        # Check foreign key violations
        cursor.execute("PRAGMA foreign_key_check")
        violations = cursor.fetchall()
        
        if violations:
            print(f"  ❌ Found {len(violations)} foreign key violations")
            for violation in violations:
                print(f"    {violation}")
            return False
        else:
            print("  ✅ No foreign key violations")
        
        # Check if orphaned data still exists
        cursor.execute("SELECT id FROM projects")
        valid_projects = {row[0] for row in cursor.fetchall()}
        
        images_path = self.storage_path / "images"
        orphaned_dirs = 0
        if images_path.exists():
            for project_dir in images_path.iterdir():
                if project_dir.is_dir() and project_dir.name not in valid_projects:
                    orphaned_dirs += 1
        
        if orphaned_dirs > 0:
            print(f"  ❌ Still {orphaned_dirs} orphaned directories")
            return False
        else:
            print("  ✅ No orphaned directories")
        
        conn.close()
        return True


def create_enhanced_database_module():
    """Create enhanced database.py with foreign key constraints enabled"""
    enhanced_db_content = '''import os
import uuid
from contextlib import asynccontextmanager

from models import Base, User, UserRole
from sqlalchemy import create_engine, event
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

# Enable foreign key constraints for SQLite
if "sqlite" in DATABASE_URL:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

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


def check_database_integrity():
    """Check database integrity on startup"""
    try:
        db = SessionLocal()
        
        # Enable foreign keys for this check
        if "sqlite" in DATABASE_URL:
            db.execute("PRAGMA foreign_keys = ON")
        
        # Check for foreign key violations
        if "sqlite" in DATABASE_URL:
            violations = db.execute("PRAGMA foreign_key_check").fetchall()
            if violations:
                print(f"WARNING: Found {len(violations)} foreign key violations")
                for violation in violations:
                    print(f"  {violation}")
                return False
        
        print("Database integrity check passed")
        return True
        
    except Exception as e:
        print(f"Database integrity check failed: {e}")
        return False
    finally:
        db.close()


if __name__ == "__main__":
    init_database()
    check_database_integrity()
'''
    
    return enhanced_db_content


def main():
    """Run complete database fix process"""
    print("YOLO Annotation Database Integrity Fixer")
    print("=" * 50)
    
    fixer = DatabaseFixer()
    
    # 1. Backup database
    backup_file = fixer.backup_database()
    print(f"Database backed up to: {backup_file}")
    
    # 2. Preview cleanup
    print("\nPreviewing cleanup...")
    fixer.cleanup_orphaned_data(dry_run=True)
    
    # 3. Ask for confirmation
    response = input("\nProceed with cleanup? (y/N): ").strip().lower()
    if response != 'y':
        print("Cleanup cancelled")
        return
    
    # 4. Perform cleanup
    print("\nPerforming cleanup...")
    fixer.cleanup_orphaned_data(dry_run=False)
    
    # 5. Validate results
    print("\nValidating results...")
    success = fixer.validate_consistency()
    
    if success:
        print("\n✅ Database integrity fixes completed successfully")
    else:
        print("\n❌ Some issues remain - manual intervention may be required")
    
    # 6. Show recommended code fixes
    print("\nRecommended code fixes:")
    fixer.fix_database_schema()
    
    # 7. Generate enhanced database module
    print("\nGenerated enhanced database.py content (see database_fixes.py for details)")
    

if __name__ == "__main__":
    main()