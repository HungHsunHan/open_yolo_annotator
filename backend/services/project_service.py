from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from models import Project, User, project_assignments
from schemas import ProjectCreate, ProjectResponse, ProjectUpdate, DirectoryStructure
import uuid
from typing import List


class ProjectService:
    
    async def create_project(self, db: Session, project_data: ProjectCreate, created_by: str) -> Project:
        """Create a new project"""
        project_id = str(uuid.uuid4())
        
        # Create directory structure
        directory_structure = {
            "images": f"/projects/{project_data.name}/images",
            "labels": f"/projects/{project_data.name}/labels",
            "classes": f"/projects/{project_data.name}/classes.txt"
        }
        
        project = Project(
            id=project_id,
            name=project_data.name,
            created_by=created_by,
            class_names=project_data.class_names,
            class_definitions=[cd.dict() for cd in project_data.class_definitions],
            directory_structure=directory_structure
        )
        
        db.add(project)
        
        # Assign creator to project
        creator = db.query(User).filter(User.id == created_by).first()
        if creator:
            project.assigned_users.append(creator)
        
        db.commit()
        db.refresh(project)
        
        return project
    
    
    async def get_project(self, db: Session, project_id: str, current_user: User) -> Project:
        """Get project by ID with access control"""
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Check access permissions
        if current_user.role != "admin":
            # Annotators can only access assigned projects
            user_assignment = db.query(project_assignments).filter(
                project_assignments.c.project_id == project_id,
                project_assignments.c.user_id == current_user.id
            ).first()
            
            if not user_assignment:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this project"
                )
        
        return project
    
    
    async def get_user_projects(self, db: Session, current_user: User) -> List[Project]:
        """Get projects accessible to current user"""
        if current_user.role == "admin":
            # Admins see all projects
            return db.query(Project).all()
        else:
            # Annotators see only assigned projects
            return db.query(Project).join(project_assignments).filter(
                project_assignments.c.user_id == current_user.id
            ).all()
    
    
    async def update_project(
        self, 
        db: Session, 
        project_id: str, 
        project_update: ProjectUpdate, 
        current_user: User
    ) -> Project:
        """Update project"""
        project = await self.get_project(db, project_id, current_user)
        
        # Only admins and project creators can update projects
        if current_user.role != "admin" and project.created_by != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to update project"
            )
        
        # Update fields
        if project_update.name is not None:
            project.name = project_update.name
            # Update directory structure if name changed
            project.directory_structure = {
                "images": f"/projects/{project_update.name}/images",
                "labels": f"/projects/{project_update.name}/labels", 
                "classes": f"/projects/{project_update.name}/classes.txt"
            }
        
        if project_update.class_names is not None:
            project.class_names = project_update.class_names
        
        if project_update.class_definitions is not None:
            project.class_definitions = [cd.dict() for cd in project_update.class_definitions]
        
        db.commit()
        db.refresh(project)
        
        return project
    
    
    async def delete_project(self, db: Session, project_id: str, current_user: User) -> dict:
        """Delete project"""
        project = await self.get_project(db, project_id, current_user)
        
        # Only admins and project creators can delete projects
        if current_user.role != "admin" and project.created_by != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to delete project"
            )
        
        try:
            # Delete project (cascade will handle images and annotations)
            db.delete(project)
            db.commit()
            
            return {"message": "Project deleted successfully"}
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to delete project: {str(e)}"
            )
    
    
    async def assign_user(self, db: Session, project_id: str, user_id: str) -> dict:
        """Assign user to project"""
        # Get project and user
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if already assigned
        if user in project.assigned_users:
            return {"message": "User already assigned to project", "assigned": True}
        
        # Add assignment
        project.assigned_users.append(user)
        db.commit()
        
        return {"message": "User assigned to project successfully", "assigned": True}
    
    
    async def unassign_user(self, db: Session, project_id: str, user_id: str) -> dict:
        """Unassign user from project"""
        # Get project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Cannot unassign project creator
        if project.created_by == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot unassign project creator"
            )
        
        # Find and remove user
        user = db.query(User).filter(User.id == user_id).first()
        if user and user in project.assigned_users:
            project.assigned_users.remove(user)
            db.commit()
        
        return {"message": "User unassigned from project successfully", "assigned": False}