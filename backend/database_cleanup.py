#!/usr/bin/env python3
"""
Database cleanup script for YOLO annotation web app.
Removes orphaned image files and ensures database consistency.
"""

import os
import shutil
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Project, Image, Annotation

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./yolo_annotation.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def analyze_data_consistency(dry_run=True):
    """Analyze data consistency between database and filesystem"""
    db = SessionLocal()
    
    try:
        # Get storage directory
        storage_dir = Path("storage/images")
        if not storage_dir.exists():
            print("Storage directory not found: storage/images")
            return
        
        print("=== Database vs Filesystem Analysis ===")
        
        # Get all projects from database
        db_projects = db.query(Project).all()
        print(f"Database projects: {len(db_projects)}")
        for project in db_projects:
            print(f"  - {project.id}: {project.name}")
        
        # Get all project directories from filesystem
        fs_project_dirs = [d for d in storage_dir.iterdir() if d.is_dir()]
        print(f"Filesystem project directories: {len(fs_project_dirs)}")
        for proj_dir in fs_project_dirs:
            image_count = len([f for f in proj_dir.iterdir() if f.is_file()])
            print(f"  - {proj_dir.name}: {image_count} files")
        
        # Find orphaned directories (exist in filesystem but not in database)
        db_project_ids = {str(p.id) for p in db_projects}
        fs_project_ids = {d.name for d in fs_project_dirs}
        
        orphaned_dirs = fs_project_ids - db_project_ids
        if orphaned_dirs:
            print(f"\nOrphaned directories (no database record): {len(orphaned_dirs)}")
            for orphaned_id in orphaned_dirs:
                orphaned_dir = storage_dir / orphaned_id
                image_count = len([f for f in orphaned_dir.iterdir() if f.is_file()])
                total_size = sum(f.stat().st_size for f in orphaned_dir.rglob('*') if f.is_file())
                print(f"  - {orphaned_id}: {image_count} files, {total_size/1024/1024:.1f}MB")
        
        # Find missing directories (exist in database but not in filesystem)  
        missing_dirs = db_project_ids - fs_project_ids
        if missing_dirs:
            print(f"\nMissing directories (database record exists): {len(missing_dirs)}")
            for missing_id in missing_dirs:
                project = next(p for p in db_projects if str(p.id) == missing_id)
                image_count = db.query(Image).filter(Image.project_id == missing_id).count()
                print(f"  - {missing_id}: {project.name}, {image_count} images in DB")
        
        # Get detailed image analysis
        print("\n=== Image Analysis ===")
        total_db_images = db.query(Image).count()
        total_db_annotations = db.query(Annotation).count()
        print(f"Total database images: {total_db_images}")
        print(f"Total database annotations: {total_db_annotations}")
        
        total_fs_images = 0
        for proj_dir in fs_project_dirs:
            image_files = [f for f in proj_dir.iterdir() if f.is_file()]
            total_fs_images += len(image_files)
        print(f"Total filesystem images: {total_fs_images}")
        
        if not dry_run:
            print("\n=== CLEANUP ACTIONS ===")
            cleanup_orphaned_data(db, storage_dir, orphaned_dirs)
        else:
            print("\n=== DRY RUN - No changes made ===")
            print("Run with dry_run=False to execute cleanup")
        
    finally:
        db.close()

def cleanup_orphaned_data(db, storage_dir, orphaned_dirs):
    """Remove orphaned directories and files"""
    
    for orphaned_id in orphaned_dirs:
        orphaned_dir = storage_dir / orphaned_id
        
        try:
            print(f"Removing orphaned directory: {orphaned_dir}")
            shutil.rmtree(orphaned_dir)
            print(f"  ✓ Removed {orphaned_dir}")
        except Exception as e:
            print(f"  ✗ Failed to remove {orphaned_dir}: {e}")
    
    # Also clean up any orphaned annotation directories
    annotation_storage = Path("storage/annotations")
    if annotation_storage.exists():
        for orphaned_id in orphaned_dirs:
            orphaned_ann_dir = annotation_storage / orphaned_id
            if orphaned_ann_dir.exists():
                try:
                    print(f"Removing orphaned annotation directory: {orphaned_ann_dir}")
                    shutil.rmtree(orphaned_ann_dir)
                    print(f"  ✓ Removed {orphaned_ann_dir}")
                except Exception as e:
                    print(f"  ✗ Failed to remove {orphaned_ann_dir}: {e}")

def verify_foreign_keys():
    """Verify foreign key constraints are working"""
    db = SessionLocal()
    
    try:
        # Test foreign key constraint by checking if they're enabled  
        from sqlalchemy import text
        result = db.execute(text("PRAGMA foreign_keys")).fetchone()
        if result and result[0] == 1:
            print("✓ Foreign key constraints are ENABLED")
        else:
            print("✗ Foreign key constraints are DISABLED")
            
        # Check for any constraint violations
        violations = db.execute(text("PRAGMA foreign_key_check")).fetchall()
        if violations:
            print(f"✗ Found {len(violations)} foreign key violations:")
            for violation in violations:
                print(f"  - {violation}")
        else:
            print("✓ No foreign key violations found")
            
    except Exception as e:
        print(f"Error checking foreign keys: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    import sys
    
    print("YOLO Annotation Database Cleanup")
    print("=" * 40)
    
    # Check if --execute flag is provided for actual cleanup
    execute_cleanup = "--execute" in sys.argv
    
    if execute_cleanup:
        print("EXECUTING CLEANUP - Files will be deleted!")
        confirm = input("Are you sure? Type 'yes' to continue: ")
        if confirm.lower() != 'yes':
            print("Cleanup cancelled.")
            sys.exit(0)
    
    # Run analysis
    analyze_data_consistency(dry_run=not execute_cleanup)
    
    # Check foreign key status
    print("\n=== Foreign Key Status ===")
    verify_foreign_keys()
    
    print("\nCleanup completed!")
    if not execute_cleanup:
        print("Run with --execute flag to actually remove orphaned files")