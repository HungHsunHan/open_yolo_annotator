from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from models import User, UserRole
from schemas import UserCreate, UserResponse, UserUpdate
from auth import hash_password
import uuid


class UserService:
    
    async def create_user(self, db: Session, user_data: UserCreate) -> User:
        """Create a new user"""
        try:
            # Check if username already exists
            existing_user = db.query(User).filter(User.username == user_data.username).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already exists"
                )
            
            # Create new user
            user = User(
                id=f"{user_data.role.value}-{uuid.uuid4()}",
                username=user_data.username,
                password_hash=hash_password(user_data.password),
                role=user_data.role
            )
            
            db.add(user)
            db.commit()
            db.refresh(user)
            
            return user
            
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
    
    
    async def get_user(self, db: Session, user_id: str) -> User:
        """Get user by ID"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user
    
    
    async def update_user(self, db: Session, user_id: str, user_update: UserUpdate) -> User:
        """Update user"""
        user = await self.get_user(db, user_id)
        
        # Check username uniqueness if changing username
        if user_update.username and user_update.username != user.username:
            existing = db.query(User).filter(User.username == user_update.username).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already exists"
                )
            user.username = user_update.username
        
        # Update password if provided
        if user_update.password:
            user.password_hash = hash_password(user_update.password)
        
        # Update role if provided
        if user_update.role:
            user.role = user_update.role
        
        try:
            db.commit()
            db.refresh(user)
            return user
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update user"
            )
    
    
    async def delete_user(self, db: Session, user_id: str) -> dict:
        """Delete user"""
        user = await self.get_user(db, user_id)
        
        try:
            db.delete(user)
            db.commit()
            return {"message": "User deleted successfully"}
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to delete user: {str(e)}"
            )