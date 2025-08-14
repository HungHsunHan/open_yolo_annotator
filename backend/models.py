from sqlalchemy import Column, String, DateTime, Text, Integer, Float, ForeignKey, JSON, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from datetime import datetime

Base = declarative_base()


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    ANNOTATOR = "annotator"


class ImageStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in-progress"
    COMPLETED = "completed"


class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    created_projects = relationship("Project", back_populates="creator")
    assigned_projects = relationship("Project", secondary="project_assignments", back_populates="assigned_users")
    uploaded_images = relationship("Image", back_populates="uploaded_by_user")


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    
    # YOLO class definitions stored as JSON
    class_names = Column(JSON, nullable=False, default=list)
    class_definitions = Column(JSON, nullable=False, default=list)
    
    # Directory structure (mirrors existing interface)
    directory_structure = Column(JSON, nullable=False, default=dict)
    
    # Relationships
    creator = relationship("User", back_populates="created_projects")
    assigned_users = relationship("User", secondary="project_assignments", back_populates="assigned_projects")
    images = relationship("Image", back_populates="project", cascade="all, delete-orphan")


# Association table for many-to-many relationship between Projects and Users
from sqlalchemy import Table
project_assignments = Table(
    'project_assignments',
    Base.metadata,
    Column('project_id', String, ForeignKey('projects.id'), primary_key=True),
    Column('user_id', String, ForeignKey('users.id'), primary_key=True)
)


class Image(Base):
    __tablename__ = "images"
    
    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)  # Path to actual image file
    size = Column(Integer, nullable=False)
    type = Column(String, nullable=False)  # MIME type
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(ImageStatus), nullable=False, default=ImageStatus.PENDING)
    
    # Metadata
    width = Column(Integer)  # Image dimensions
    height = Column(Integer)
    
    # Relationships
    project = relationship("Project", back_populates="images")
    uploaded_by_user = relationship("User", back_populates="uploaded_images")
    annotations = relationship("Annotation", back_populates="image", cascade="all, delete-orphan")


class Annotation(Base):
    __tablename__ = "annotations"
    
    id = Column(String, primary_key=True)
    image_id = Column(String, ForeignKey("images.id"), nullable=False)
    class_id = Column(Integer, nullable=False)
    class_name = Column(String, nullable=False)
    color = Column(String, nullable=False)
    
    # Bounding box coordinates (absolute pixels)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    width = Column(Float, nullable=False)
    height = Column(Float, nullable=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    image = relationship("Image", back_populates="annotations")
    created_by_user = relationship("User")