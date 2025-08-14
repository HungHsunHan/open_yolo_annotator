from sqlalchemy.orm import Session
from fastapi import HTTPException, status, UploadFile
from fastapi.responses import FileResponse
from models import Image, Annotation, Project, ImageStatus, project_assignments
from schemas import ImageResponse, ImageUpdate, AnnotationCreate, AnnotationResponse
from pathlib import Path
from typing import List
import uuid
import shutil
from PIL import Image as PILImage
import io


class FileService:
    
    def __init__(self, storage_dir: Path):
        self.storage_dir = storage_dir
        self.images_dir = storage_dir / "images"
        self.annotations_dir = storage_dir / "annotations"
    
    
    async def upload_images(
        self, 
        db: Session, 
        project_id: str, 
        files: List[UploadFile], 
        uploaded_by: str
    ) -> List[Image]:
        """Upload multiple images to project"""
        # Verify project exists
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Create project-specific directory
        project_dir = self.images_dir / project_id
        project_dir.mkdir(exist_ok=True)
        
        uploaded_images = []
        failed_files = []
        
        for file in files:
            try:
                # Validate file type
                if not file.content_type or not file.content_type.startswith('image/'):
                    failed_files.append({"filename": file.filename, "error": "Not an image file"})
                    continue
                
                # Generate unique filename
                image_id = str(uuid.uuid4())
                file_extension = Path(file.filename).suffix
                storage_filename = f"{image_id}{file_extension}"
                file_path = project_dir / storage_filename
                
                # Save file to disk
                with open(file_path, "wb") as buffer:
                    content = await file.read()
                    buffer.write(content)
                
                # Get image dimensions
                try:
                    with PILImage.open(file_path) as img:
                        width, height = img.size
                except Exception:
                    width, height = None, None
                
                # Create database record
                image = Image(
                    id=image_id,
                    project_id=project_id,
                    name=file.filename,
                    file_path=str(file_path),
                    size=len(content),
                    type=file.content_type,
                    uploaded_by=uploaded_by,
                    status=ImageStatus.PENDING,
                    width=width,
                    height=height
                )
                
                db.add(image)
                uploaded_images.append(image)
                
            except Exception as e:
                failed_files.append({"filename": file.filename, "error": str(e)})
        
        try:
            db.commit()
            for image in uploaded_images:
                db.refresh(image)
        except Exception as e:
            db.rollback()
            # Clean up uploaded files on database error
            for image in uploaded_images:
                try:
                    Path(image.file_path).unlink(missing_ok=True)
                except Exception:
                    pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}"
            )
        
        return uploaded_images
    
    
    async def download_image(self, db: Session, image_id: str, current_user) -> FileResponse:
        """Download image file"""
        image = await self._get_accessible_image(db, image_id, current_user)
        
        if not Path(image.file_path).exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image file not found on disk"
            )
        
        return FileResponse(
            path=image.file_path,
            filename=image.name,
            media_type=image.type
        )
    
    
    async def update_image(
        self, 
        db: Session, 
        image_id: str, 
        image_update: ImageUpdate, 
        current_user
    ) -> Image:
        """Update image metadata"""
        image = await self._get_accessible_image(db, image_id, current_user)
        
        if image_update.status is not None:
            image.status = image_update.status
        
        if image_update.width is not None:
            image.width = image_update.width
        
        if image_update.height is not None:
            image.height = image_update.height
        
        db.commit()
        db.refresh(image)
        
        return image
    
    
    async def delete_image(self, db: Session, image_id: str, current_user) -> dict:
        """Delete image and its file"""
        image = await self._get_accessible_image(db, image_id, current_user)
        
        try:
            # Delete file from disk
            Path(image.file_path).unlink(missing_ok=True)
            
            # Delete from database (cascade will handle annotations)
            db.delete(image)
            db.commit()
            
            return {"message": "Image deleted successfully"}
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete image: {str(e)}"
            )
    
    
    async def save_annotations(
        self, 
        db: Session, 
        image_id: str, 
        annotations: List[AnnotationCreate], 
        created_by: str
    ) -> List[Annotation]:
        """Save annotations for image"""
        image = db.query(Image).filter(Image.id == image_id).first()
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )
        
        # Clear existing annotations
        db.query(Annotation).filter(Annotation.image_id == image_id).delete()
        
        # Create new annotations
        db_annotations = []
        for ann_data in annotations:
            annotation = Annotation(
                id=str(uuid.uuid4()),
                image_id=image_id,
                class_id=ann_data.class_id,
                class_name=ann_data.class_name,
                color=ann_data.color,
                x=ann_data.x,
                y=ann_data.y,
                width=ann_data.width,
                height=ann_data.height,
                created_by=created_by
            )
            db.add(annotation)
            db_annotations.append(annotation)
        
        # Update image status to completed if annotations exist
        if annotations:
            image.status = ImageStatus.COMPLETED
        
        db.commit()
        for annotation in db_annotations:
            db.refresh(annotation)
        
        return db_annotations
    
    
    async def get_annotations(self, db: Session, image_id: str, current_user) -> List[Annotation]:
        """Get annotations for image"""
        image = await self._get_accessible_image(db, image_id, current_user)
        return db.query(Annotation).filter(Annotation.image_id == image_id).all()
    
    
    async def download_annotations(self, db: Session, image_id: str, current_user) -> FileResponse:
        """Download YOLO format annotation file"""
        image = await self._get_accessible_image(db, image_id, current_user)
        annotations = db.query(Annotation).filter(Annotation.image_id == image_id).all()
        
        if not annotations:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No annotations found for this image"
            )
        
        # Convert annotations to YOLO format
        yolo_lines = []
        for ann in annotations:
            if image.width and image.height:
                # Convert absolute coordinates to normalized YOLO format
                center_x = (ann.x + ann.width / 2) / image.width
                center_y = (ann.y + ann.height / 2) / image.height
                norm_width = ann.width / image.width
                norm_height = ann.height / image.height
                
                yolo_lines.append(f"{ann.class_id} {center_x:.6f} {center_y:.6f} {norm_width:.6f} {norm_height:.6f}")
        
        # Create temporary annotation file
        annotation_content = "\n".join(yolo_lines)
        annotation_dir = self.annotations_dir / image.project_id
        annotation_dir.mkdir(exist_ok=True)
        
        annotation_file = annotation_dir / f"{Path(image.name).stem}.txt"
        with open(annotation_file, "w") as f:
            f.write(annotation_content)
        
        return FileResponse(
            path=str(annotation_file),
            filename=f"{Path(image.name).stem}.txt",
            media_type="text/plain"
        )
    
    
    async def _get_accessible_image(self, db: Session, image_id: str, current_user) -> Image:
        """Get image with access control"""
        image = db.query(Image).filter(Image.id == image_id).first()
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image not found"
            )
        
        # Check project access
        project = image.project
        if current_user.role != "admin":
            user_assignment = db.query(project_assignments).filter(
                project_assignments.c.project_id == project.id,
                project_assignments.c.user_id == current_user.id
            ).first()
            
            if not user_assignment:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this image"
                )
        
        return image