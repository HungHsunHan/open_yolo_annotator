import os
from pathlib import Path
from typing import List, Optional
from contextlib import asynccontextmanager

import uvicorn
from database import get_db
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from models import Annotation, Image, Project, User
from schemas import (
    AnnotationCreate,
    AnnotationResponse,
    ImageResponse,
    ImageUpdate,
    LoginRequest,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    TokenResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from services.file_service import FileService
from services.project_service import ProjectService
from services.user_service import UserService
from sqlalchemy.orm import Session

from auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    hash_password,
    verify_token,
)
from database import init_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print("Initializing database and cleaning up orphaned records...")
    init_database()
    print("Database initialization complete.")
    yield
    # Shutdown (if needed)


app = FastAPI(title="YOLO Annotation API", version="1.0.0", lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8080", "http://localhost:8081", "http://127.0.0.1:5173", "http://127.0.0.1:3000", "http://127.0.0.1:8080", "http://127.0.0.1:8081"],  # React dev server
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# File storage setup with proper permissions
STORAGE_DIR = Path("storage")
try:
    STORAGE_DIR.mkdir(exist_ok=True, mode=0o755)
    (STORAGE_DIR / "images").mkdir(exist_ok=True, mode=0o755)
    (STORAGE_DIR / "annotations").mkdir(exist_ok=True, mode=0o755)
    print(f"Storage directories initialized: {STORAGE_DIR.absolute()}")
except Exception as e:
    print(f"Warning: Failed to create storage directories: {e}")
    raise

# Services
file_service = FileService(STORAGE_DIR)
project_service = ProjectService(STORAGE_DIR)
user_service = UserService()


@app.post("/auth/login", response_model=TokenResponse)
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return JWT token"""
    user = authenticate_user(db, login_data.username, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "user": user}


@app.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info"""
    return current_user


@app.post("/auth/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new user (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return await user_service.create_user(db, user_data)


@app.get("/users", response_model=List[UserResponse])
async def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all users (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return db.query(User).all()


@app.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update user (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return await user_service.update_user(db, user_id, user_update)


@app.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete user (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    return await user_service.delete_user(db, user_id)


@app.post("/projects", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new project"""
    return await project_service.create_project(db, project_data, current_user.id)


@app.get("/projects", response_model=List[ProjectResponse])
async def get_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get projects accessible to current user"""
    return await project_service.get_user_projects(db, current_user)


@app.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific project"""
    return await project_service.get_project(db, project_id, current_user)


@app.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update project"""
    return await project_service.update_project(db, project_id, project_update, current_user)


@app.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete project"""
    return await project_service.delete_project(db, project_id, current_user)


@app.post("/projects/{project_id}/assign/{user_id}")
async def assign_user_to_project(
    project_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assign user to project (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return await project_service.assign_user(db, project_id, user_id)


@app.delete("/projects/{project_id}/assign/{user_id}")
async def unassign_user_from_project(
    project_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Unassign user from project (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return await project_service.unassign_user(db, project_id, user_id)


@app.post("/projects/{project_id}/images/upload", response_model=List[ImageResponse])
async def upload_images(
    project_id: str,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload images to project"""
    # Verify user has access to project
    await project_service.get_project(db, project_id, current_user)
    
    return await file_service.upload_images(db, project_id, files, current_user.id)


@app.get("/projects/{project_id}/images", response_model=List[ImageResponse])
async def get_project_images(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get images for project"""
    # Verify user has access to project
    await project_service.get_project(db, project_id, current_user)
    
    return db.query(Image).filter(Image.project_id == project_id).all()


@app.get("/images/{image_id}/download")
async def download_image(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download image file"""
    return await file_service.download_image(db, image_id, current_user)


@app.patch("/images/{image_id}", response_model=ImageResponse)
async def update_image(
    image_id: str,
    image_update: ImageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update image metadata"""
    return await file_service.update_image(db, image_id, image_update, current_user)


@app.delete("/images/{image_id}")
async def delete_image(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete image"""
    return await file_service.delete_image(db, image_id, current_user)


@app.post("/images/{image_id}/annotations", response_model=List[AnnotationResponse])
async def save_annotations(
    image_id: str,
    annotations: List[AnnotationCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save annotations for image"""
    return await file_service.save_annotations(db, image_id, annotations, current_user.id)


@app.get("/images/{image_id}/annotations", response_model=List[AnnotationResponse])
async def get_annotations(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get annotations for image"""
    return await file_service.get_annotations(db, image_id, current_user)


@app.get("/images/{image_id}/annotations/download")
async def download_annotations(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download YOLO format annotation file"""
    return await file_service.download_annotations(db, image_id, current_user)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "1.0.0"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)