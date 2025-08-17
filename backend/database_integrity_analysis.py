#!/usr/bin/env python3
"""
Database Integrity Analysis and Cleanup Script
Analyzes and repairs database consistency issues in YOLO annotation web app.
"""

import sqlite3
import os
import shutil
from pathlib import Path
from datetime import datetime
import json

class DatabaseIntegrityAnalyzer:
    def __init__(self, db_path="yolo_annotation.db", storage_path="storage"):
        self.db_path = db_path
        self.storage_path = Path(storage_path)
        self.images_path = self.storage_path / "images"
        self.annotations_path = self.storage_path / "annotations"
        
    def analyze_integrity(self):
        """Comprehensive database integrity analysis"""
        print("=" * 60)
        print("DATABASE INTEGRITY ANALYSIS REPORT")
        print(f"Generated: {datetime.now()}")
        print("=" * 60)
        
        # Connect to database
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")  # Enable FK constraints
        cursor = conn.cursor()
        
        issues = []
        
        # 1. Check foreign key constraints
        print("\n1. FOREIGN KEY CONSTRAINT STATUS")
        cursor.execute("PRAGMA foreign_keys")
        fk_enabled = cursor.fetchone()[0]
        print(f"   Foreign keys enabled: {bool(fk_enabled)}")
        if not fk_enabled:
            issues.append("CRITICAL: Foreign key constraints are DISABLED")
        
        # 2. Check database integrity
        print("\n2. DATABASE INTEGRITY CHECK")
        cursor.execute("PRAGMA integrity_check")
        integrity_result = cursor.fetchall()
        if integrity_result[0][0] == "ok":
            print("   Database structure: OK")
        else:
            issues.append(f"Database integrity issues: {integrity_result}")
            
        # 3. Check foreign key violations
        print("\n3. FOREIGN KEY VIOLATIONS")
        cursor.execute("PRAGMA foreign_key_check")
        violations = cursor.fetchall()
        if violations:
            print("   VIOLATIONS FOUND:")
            for violation in violations:
                print(f"   - Table: {violation[0]}, Row: {violation[1]}, Parent: {violation[2]}, FK Index: {violation[3]}")
                issues.append(f"FK Violation: {violation}")
        else:
            print("   No foreign key violations")
        
        # 4. Analyze data consistency
        print("\n4. DATA CONSISTENCY ANALYSIS")
        
        # Get all database records
        cursor.execute("SELECT id, name FROM projects")
        db_projects = {row[0]: row[1] for row in cursor.fetchall()}
        
        cursor.execute("SELECT id, project_id, name, file_path FROM images")
        db_images = cursor.fetchall()
        
        cursor.execute("SELECT id, image_id FROM annotations")
        db_annotations = cursor.fetchall()
        
        print(f"   Database records: {len(db_projects)} projects, {len(db_images)} images, {len(db_annotations)} annotations")
        
        # Check filesystem
        if self.images_path.exists():
            fs_project_dirs = [d.name for d in self.images_path.iterdir() if d.is_dir()]
            fs_image_count = sum(len(list(d.iterdir())) for d in self.images_path.iterdir() if d.is_dir())
        else:
            fs_project_dirs = []
            fs_image_count = 0
            
        print(f"   Filesystem: {len(fs_project_dirs)} project directories, {fs_image_count} image files")
        
        # 5. Find orphaned records and files
        print("\n5. ORPHANED DATA ANALYSIS")
        
        # Orphaned project directories
        orphaned_dirs = []
        for fs_project in fs_project_dirs:
            if fs_project not in db_projects:
                orphaned_dirs.append(fs_project)
        
        if orphaned_dirs:
            print(f"   ORPHANED PROJECT DIRECTORIES: {len(orphaned_dirs)}")
            for orphan in orphaned_dirs:
                print(f"   - {orphan}")
                issues.append(f"Orphaned project directory: {orphan}")
        
        # Orphaned image files
        orphaned_files = []
        db_image_paths = {img[3] for img in db_images}
        
        for project_dir in self.images_path.iterdir():
            if project_dir.is_dir():
                for image_file in project_dir.iterdir():
                    if image_file.is_file():
                        rel_path = f"storage/images/{project_dir.name}/{image_file.name}"
                        if rel_path not in db_image_paths:
                            orphaned_files.append(rel_path)
        
        if orphaned_files:
            print(f"   ORPHANED IMAGE FILES: {len(orphaned_files)}")
            for orphan in orphaned_files[:5]:  # Show first 5
                print(f"   - {orphan}")
            if len(orphaned_files) > 5:
                print(f"   ... and {len(orphaned_files) - 5} more")
            for orphan in orphaned_files:
                issues.append(f"Orphaned image file: {orphan}")
        
        # Missing image files
        missing_files = []
        for img in db_images:
            if not Path(img[3]).exists():
                missing_files.append(img[3])
        
        if missing_files:
            print(f"   MISSING IMAGE FILES: {len(missing_files)}")
            for missing in missing_files:
                print(f"   - {missing}")
                issues.append(f"Missing image file: {missing}")
        
        # 6. Check cascade deletion setup
        print("\n6. CASCADE DELETION ANALYSIS")
        tables_with_fks = ['projects', 'images', 'annotations', 'project_assignments']
        
        for table in tables_with_fks:
            cursor.execute(f"PRAGMA foreign_key_list({table})")
            fks = cursor.fetchall()
            for fk in fks:
                if fk[6] == "NO ACTION":  # ON DELETE action
                    print(f"   WARNING: {table}.{fk[3]} -> {fk[2]}.{fk[4]} has NO ACTION on delete")
                    issues.append(f"No cascade delete: {table}.{fk[3]}")
        
        conn.close()
        
        # 7. Summary
        print(f"\n7. SUMMARY")
        print(f"   Total issues found: {len(issues)}")
        if issues:
            print("   CRITICAL ISSUES REQUIRING ATTENTION:")
            for issue in issues:
                print(f"   - {issue}")
        else:
            print("   No integrity issues found")
            
        return issues
    
    def create_cleanup_plan(self):
        """Generate cleanup recommendations"""
        print("\n" + "=" * 60)
        print("CLEANUP AND PREVENTION RECOMMENDATIONS")
        print("=" * 60)
        
        print("\n1. IMMEDIATE FIXES REQUIRED:")
        print("   a) Enable foreign key constraints")
        print("   b) Clean up orphaned files and directories")
        print("   c) Fix missing cascade delete relationships")
        
        print("\n2. CLEANUP PROCEDURES:")
        print("   a) Backup database before cleanup")
        print("   b) Remove orphaned filesystem data")
        print("   c) Verify database consistency")
        print("   d) Enable foreign key constraints permanently")
        
        print("\n3. PREVENTION MEASURES:")
        print("   a) Always use transactions for multi-step operations")
        print("   b) Enable foreign key constraints by default")
        print("   c) Add data validation before filesystem operations")
        print("   d) Implement proper error handling with rollback")
        print("   e) Add database integrity checks to startup routine")
        
        return True
    
    def cleanup_orphaned_data(self, dry_run=True):
        """Clean up orphaned data (dry run by default)"""
        print(f"\n{'DRY RUN: ' if dry_run else ''}CLEANING UP ORPHANED DATA")
        print("-" * 40)
        
        # Connect to database
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get valid project IDs
        cursor.execute("SELECT id FROM projects")
        valid_projects = {row[0] for row in cursor.fetchall()}
        
        cleaned_dirs = 0
        cleaned_files = 0
        
        # Clean orphaned project directories
        if self.images_path.exists():
            for project_dir in self.images_path.iterdir():
                if project_dir.is_dir() and project_dir.name not in valid_projects:
                    print(f"   {'Would remove' if dry_run else 'Removing'} orphaned directory: {project_dir}")
                    if not dry_run:
                        shutil.rmtree(project_dir)
                    cleaned_dirs += 1
        
        # Clean orphaned annotation directories
        if self.annotations_path.exists():
            for project_dir in self.annotations_path.iterdir():
                if project_dir.is_dir() and project_dir.name not in valid_projects:
                    print(f"   {'Would remove' if dry_run else 'Removing'} orphaned annotation directory: {project_dir}")
                    if not dry_run:
                        shutil.rmtree(project_dir)
        
        conn.close()
        
        print(f"   Total: {'Would clean' if dry_run else 'Cleaned'} {cleaned_dirs} directories, {cleaned_files} files")
        return cleaned_dirs, cleaned_files
    
    def enable_foreign_keys(self):
        """Enable foreign key constraints permanently"""
        print("\nENABLING FOREIGN KEY CONSTRAINTS")
        print("-" * 40)
        
        # Note: SQLite foreign keys need to be enabled per connection
        # This is handled in the application startup
        print("   Foreign keys should be enabled in database.py connection setup")
        print("   Add: engine.execute('PRAGMA foreign_keys = ON') after engine creation")
        
        return True

def main():
    """Run complete database integrity analysis"""
    analyzer = DatabaseIntegrityAnalyzer()
    
    # Run analysis
    issues = analyzer.analyze_integrity()
    
    # Generate cleanup plan
    analyzer.create_cleanup_plan()
    
    # Show cleanup preview
    print("\nORPHANED DATA CLEANUP PREVIEW:")
    analyzer.cleanup_orphaned_data(dry_run=True)
    
    if issues:
        print(f"\n⚠️  Found {len(issues)} integrity issues that require attention")
        print("Run cleanup with dry_run=False after reviewing the analysis")
    else:
        print("\n✅ Database integrity check passed")

if __name__ == "__main__":
    main()