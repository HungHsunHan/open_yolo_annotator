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
        print(f"[FileService] Starting upload of {len(files)} files for project {project_id}")
        
        # Verify project exists
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            print(f"[FileService] Project {project_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Create project-specific directory with proper permissions
        project_dir = self.images_dir / project_id
        try:
            project_dir.mkdir(exist_ok=True, mode=0o755)
            print(f"[FileService] Created/verified project directory: {project_dir}")
        except Exception as e:
            print(f"[FileService] Failed to create project directory: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create storage directory: {str(e)}"
            )
        
        uploaded_images = []
        failed_files = []
        uploaded_file_paths = []  # Track files for cleanup on error
        
        for file in files:
            try:
                print(f"[FileService] Processing file: {file.filename} (type: {file.content_type})")
                
                # Validate file type
                if not file.content_type or not file.content_type.startswith('image/'):
                    error_msg = f"Not an image file (type: {file.content_type})"
                    print(f"[FileService] File validation failed for {file.filename}: {error_msg}")
                    failed_files.append({"filename": file.filename, "error": error_msg})
                    continue
                
                # Generate unique filename
                image_id = str(uuid.uuid4())
                file_extension = Path(file.filename).suffix.lower()
                storage_filename = f"{image_id}{file_extension}"
                file_path = project_dir / storage_filename
                
                print(f"[FileService] Saving file {file.filename} as {storage_filename}")
                
                # Save file to disk
                try:
                    with open(file_path, "wb") as buffer:
                        content = await file.read()
                        buffer.write(content)
                    uploaded_file_paths.append(file_path)  # Track for cleanup
                    print(f"[FileService] Successfully wrote file: {file_path} ({len(content)} bytes)")
                except Exception as e:
                    error_msg = f"Failed to save file: {str(e)}"
                    print(f"[FileService] File save failed for {file.filename}: {error_msg}")
                    failed_files.append({"filename": file.filename, "error": error_msg})
                    continue
                
                # Get image dimensions
                width, height = None, None
                try:
                    with PILImage.open(file_path) as img:
                        width, height = img.size
                    print(f"[FileService] Image dimensions for {file.filename}: {width}x{height}")
                except Exception as e:
                    print(f"[FileService] Warning: Could not get dimensions for {file.filename}: {e}")
                
                # Use relative path for database storage
                relative_file_path = f"storage/images/{project_id}/{storage_filename}"
                
                # Create database record
                image = Image(
                    id=image_id,
                    project_id=project_id,
                    name=file.filename,
                    file_path=relative_file_path,  # Store relative path
                    size=len(content),
                    type=file.content_type,
                    uploaded_by=uploaded_by,
                    status=ImageStatus.PENDING,
                    width=width,
                    height=height
                )
                
                print(f"[FileService] Created image record: {image_id} with path {relative_file_path}")
                uploaded_images.append(image)
                
            except Exception as e:
                error_msg = f"Unexpected error processing file: {str(e)}"
                print(f"[FileService] Unexpected error for {file.filename}: {error_msg}")
                failed_files.append({"filename": file.filename, "error": error_msg})
        
        # Only commit to database if we have successfully uploaded images
        if uploaded_images:
            try:
                # Add all images to session
                for image in uploaded_images:
                    db.add(image)
                
                # Commit transaction
                db.commit()
                
                # Refresh objects to get updated data
                for image in uploaded_images:
                    db.refresh(image)
                
                print(f"[FileService] Successfully committed {len(uploaded_images)} images to database")
                
            except Exception as e:
                print(f"[FileService] Database commit failed: {e}")
                db.rollback()
                
                # Clean up uploaded files on database error
                for file_path in uploaded_file_paths:
                    try:
                        file_path.unlink(missing_ok=True)
                        print(f"[FileService] Cleaned up file: {file_path}")
                    except Exception as cleanup_error:
                        print(f"[FileService] Failed to cleanup file {file_path}: {cleanup_error}")
                
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Database error: {str(e)}"
                )
        
        # Log results
        if failed_files:
            print(f"[FileService] Upload completed with {len(uploaded_images)} successes and {len(failed_files)} failures")
            for failure in failed_files:
                print(f"[FileService] Failed: {failure['filename']} - {failure['error']}")
        else:
            print(f"[FileService] Upload completed successfully: {len(uploaded_images)} files")
        
        return uploaded_images
    
    
    async def download_image(self, db: Session, image_id: str, current_user) -> FileResponse:
        """Download image file"""
        image = await self._get_accessible_image(db, image_id, current_user)
        
        # Convert relative path to absolute path based on storage directory
        if image.file_path.startswith('storage/'):
            # Remove 'storage/' prefix and resolve relative to storage_dir
            relative_path = image.file_path[8:]  # Remove 'storage/' prefix
            abs_file_path = self.storage_dir / relative_path
        else:
            # Legacy absolute path format
            abs_file_path = Path(image.file_path)
        
        print(f"[FileService] Downloading image {image_id}: {abs_file_path}")
        
        if not abs_file_path.exists():
            print(f"[FileService] Image file not found: {abs_file_path}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Image file not found on disk"
            )
        
        return FileResponse(
            path=str(abs_file_path),
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
            # Convert relative path to absolute path for file deletion
            if image.file_path.startswith('storage/'):
                # New relative path format
                abs_file_path = Path(image.file_path)
            else:
                # Legacy absolute path format
                abs_file_path = Path(image.file_path)
            
            # Delete file from disk
            abs_file_path.unlink(missing_ok=True)
            print(f"[FileService] Deleted file: {abs_file_path}")
            
            # Delete from database (cascade will handle annotations)
            db.delete(image)
            db.commit()
            
            return {"message": "Image deleted successfully"}
        except Exception as e:
            db.rollback()
            print(f"[FileService] Failed to delete image {image_id}: {e}")
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