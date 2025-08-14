from datetime import datetime
from typing import Any, Dict, List, Optional

from models import ImageStatus, UserRole
from pydantic import BaseModel, Field, field_serializer, field_validator


# Auth schemas
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: "UserResponse"


# User schemas
class UserBase(BaseModel):
    username: str
    role: UserRole


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None


class UserResponse(UserBase):
    id: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# Class definition schema (matches frontend)
class ClassDefinition(BaseModel):
    id: int
    name: str
    color: str
    key: str


# Project schemas
class DirectoryStructure(BaseModel):
    images: str
    labels: str
    classes: str


class ProjectBase(BaseModel):
    name: str
    class_names: List[str] = Field(default_factory=lambda: ["object"]) 
    class_definitions: List[ClassDefinition] = Field(default_factory=list)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    class_names: Optional[List[str]] = None
    class_definitions: Optional[List[ClassDefinition]] = None


class ProjectResponse(ProjectBase):
    id: str
    created_at: datetime
    updated_at: datetime
    created_by: str
    assigned_users: List[str]
    directory_structure: DirectoryStructure
    
    @field_validator('assigned_users', mode='before')
    @classmethod
    def coerce_assigned_users(cls, v):
        """Coerce SQLAlchemy User objects (or mixed values) to list of user ID strings before validation."""
        if v is None:
            return []
        result: List[str] = []
        try:
            for item in v:
                # If already a string
                if isinstance(item, str):
                    result.append(item)
                # SQLAlchemy User or any object with an 'id' attribute
                elif hasattr(item, 'id'):
                    result.append(str(getattr(item, 'id')))
                else:
                    # Fallback to string conversion
                    result.append(str(item))
        except TypeError:
            # In case v is a single item, not iterable
            if isinstance(v, str):
                result.append(v)
            elif hasattr(v, 'id'):
                result.append(str(getattr(v, 'id')))
            else:
                result.append(str(v))
        return result
    
    @field_serializer('assigned_users')
    def serialize_assigned_users(self, assigned_users):
        """Ensure output is a list of user ID strings."""
        if not assigned_users:
            return []
        result = []
        for user in assigned_users:
            if hasattr(user, 'id'):
                result.append(user.id)
            else:
                result.append(str(user))
        return result
    
    class Config:
        from_attributes = True


# Image schemas
class ImageBase(BaseModel):
    name: str
    type: str
    size: int


class ImageUpdate(BaseModel):
    status: Optional[ImageStatus] = None
    width: Optional[int] = None
    height: Optional[int] = None


class ImageResponse(ImageBase):
    id: str
    project_id: str
    file_path: str
    upload_date: datetime
    uploaded_by: str
    status: ImageStatus
    width: Optional[int] = None
    height: Optional[int] = None
    annotations: int = 0  # Count of annotations
    
    class Config:
        from_attributes = True


# Annotation schemas
class AnnotationBase(BaseModel):
    class_id: int
    class_name: str
    color: str
    x: float
    y: float
    width: float
    height: float


class AnnotationCreate(AnnotationBase):
    pass


class AnnotationResponse(AnnotationBase):
    id: str
    image_id: str
    created_at: datetime
    created_by: str
    
    class Config:
        from_attributes = True


# Bulk operations
class BulkUploadResponse(BaseModel):
    uploaded_images: List[ImageResponse]
    failed_files: List[Dict[str, str]]  # filename -> error message


class StorageStats(BaseModel):
    used: int
    total: int
    available: int


# Assignment operations
class AssignmentResponse(BaseModel):
    project_id: str
    user_id: str
    assigned: bool


# Update forward references
TokenResponse.model_rebuild()