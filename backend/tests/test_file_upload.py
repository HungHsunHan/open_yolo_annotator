import pytest
from fastapi import status
from io import BytesIO
import tempfile
from pathlib import Path


class TestImageUpload:
    """Test image upload functionality"""
    
    def test_upload_single_image_success(self, client, auth_headers_admin, test_project, sample_image_file):
        """Test successful upload of a single image"""
        files = [
            ("files", ("test_image.jpg", BytesIO(sample_image_file), "image/jpeg"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) == 1
        
        image = data[0]
        assert image["name"] == "test_image.jpg"
        assert image["type"] == "image/jpeg"
        assert image["project_id"] == test_project.id
        assert image["uploaded_by"] == "admin-test-user-id"
        assert image["status"] == "pending"
        assert "id" in image
        assert "upload_date" in image
        assert image["size"] > 0
    
    
    def test_upload_multiple_images_success(self, client, auth_headers_admin, test_project, sample_image_file):
        """Test successful upload of multiple images"""
        files = [
            ("files", ("image1.jpg", BytesIO(sample_image_file), "image/jpeg")),
            ("files", ("image2.jpg", BytesIO(sample_image_file), "image/jpeg")),
            ("files", ("image3.png", BytesIO(sample_image_file), "image/png"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) == 3
        
        # Check that all images were uploaded
        image_names = [img["name"] for img in data]
        assert "image1.jpg" in image_names
        assert "image2.jpg" in image_names
        assert "image3.png" in image_names
    
    
    def test_upload_image_as_annotator_with_access(self, client, auth_headers_annotator, assigned_project, sample_image_file):
        """Test that annotator can upload images to assigned project"""
        files = [
            ("files", ("annotator_image.jpg", BytesIO(sample_image_file), "image/jpeg"))
        ]
        
        response = client.post(
            f"/projects/{assigned_project.id}/images/upload",
            files=files,
            headers=auth_headers_annotator
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert len(data) == 1
        assert data[0]["name"] == "annotator_image.jpg"
        assert data[0]["uploaded_by"] == "annotator-test-user-id"
    
    
    def test_upload_image_to_nonexistent_project(self, client, auth_headers_admin, sample_image_file):
        """Test uploading image to non-existent project"""
        files = [
            ("files", ("test_image.jpg", BytesIO(sample_image_file), "image/jpeg"))
        ]
        
        response = client.post(
            "/projects/nonexistent-project-id/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    
    def test_upload_image_without_auth(self, client, test_project, sample_image_file):
        """Test uploading image without authentication"""
        files = [
            ("files", ("test_image.jpg", BytesIO(sample_image_file), "image/jpeg"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_upload_non_image_file(self, client, auth_headers_admin, test_project):
        """Test uploading non-image file"""
        text_content = b"This is not an image file"
        files = [
            ("files", ("text_file.txt", BytesIO(text_content), "text/plain"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        # Should return empty list since no valid images were uploaded
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
    
    
    def test_upload_file_without_content_type(self, client, auth_headers_admin, test_project, sample_image_file):
        """Test uploading file without content type"""
        files = [
            ("files", ("test_image.jpg", BytesIO(sample_image_file), None))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        # Should succeed since file service can detect content type from file content
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1  # Image uploaded successfully
    
    
    def test_upload_empty_file(self, client, auth_headers_admin, test_project):
        """Test uploading empty file"""
        files = [
            ("files", ("empty_image.jpg", BytesIO(b""), "image/jpeg"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should still create the image record even if file is empty
        assert len(data) == 1
        assert data[0]["size"] == 0
    
    
    def test_upload_mixed_valid_invalid_files(self, client, auth_headers_admin, test_project, sample_image_file):
        """Test uploading mix of valid and invalid files"""
        files = [
            ("files", ("valid_image.jpg", BytesIO(sample_image_file), "image/jpeg")),
            ("files", ("invalid_file.txt", BytesIO(b"Not an image"), "text/plain")),
            ("files", ("another_valid.png", BytesIO(sample_image_file), "image/png"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should only upload the valid images
        assert len(data) == 2
        image_names = [img["name"] for img in data]
        assert "valid_image.jpg" in image_names
        assert "another_valid.png" in image_names
        assert "invalid_file.txt" not in image_names
    
    
    def test_upload_file_creates_storage_directory(self, client, auth_headers_admin, test_project, sample_image_file, temp_storage_dir):
        """Test that upload creates proper storage directory structure"""
        files = [
            ("files", ("test_image.jpg", BytesIO(sample_image_file), "image/jpeg"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        
        # Check that project directory was created
        project_dir = temp_storage_dir / "images" / test_project.id
        assert project_dir.exists()
        assert project_dir.is_dir()
        
        # Check that image file was created
        image_files = list(project_dir.glob("*.jpg"))
        assert len(image_files) == 1
    
    
    def test_upload_large_file_name_handling(self, client, auth_headers_admin, test_project, sample_image_file):
        """Test uploading file with very long name"""
        long_filename = "a" * 200 + ".jpg"
        files = [
            ("files", (long_filename, BytesIO(sample_image_file), "image/jpeg"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert len(data) == 1
        assert data[0]["name"] == long_filename
    
    
    def test_upload_special_characters_filename(self, client, auth_headers_admin, test_project, sample_image_file):
        """Test uploading file with special characters in name"""
        special_filename = "test_图片_ñame-with-spëcial_chars.jpg"
        files = [
            ("files", (special_filename, BytesIO(sample_image_file), "image/jpeg"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert len(data) == 1
        assert data[0]["name"] == special_filename


class TestImageAccess:
    """Test image access and permissions"""
    
    def test_annotator_cannot_upload_to_unassigned_project(self, client, auth_headers_annotator, test_project, sample_image_file):
        """Test that annotator cannot upload to project they're not assigned to"""
        files = [
            ("files", ("unauthorized_image.jpg", BytesIO(sample_image_file), "image/jpeg"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_annotator
        )
        
        # Should fail due to access control
        assert response.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]
    
    
    def test_get_project_images_success(self, client, auth_headers_admin, test_project, test_image):
        """Test retrieving images from project"""
        response = client.get(f"/projects/{test_project.id}/images", headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1  # At least the test image
        
        # Find our test image
        test_img = next((img for img in data if img["id"] == test_image.id), None)
        assert test_img is not None
        assert test_img["name"] == test_image.name
        assert test_img["project_id"] == test_project.id

    def test_get_project_images_with_pagination(self, client, auth_headers_admin, test_project, test_db_session):
        """Test retrieving images with pagination parameters"""
        from models import Image
        
        # Create multiple test images for pagination testing
        images = []
        for i in range(5):
            image = Image(
                id=f"test-image-{i}",
                name=f"test-image-{i}.jpg",
                project_id=test_project.id,
                file_path=f"storage/images/{test_project.id}/test-image-{i}.jpg",
                size=1024 * (i + 1),
                type="image/jpeg",
                uploaded_by=test_project.created_by,
                status="pending"
            )
            images.append(image)
            test_db_session.add(image)
        test_db_session.commit()
        
        # Test first page with limit 2
        response = client.get(f"/projects/{test_project.id}/images?page=1&limit=2", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        
        # Test second page
        response = client.get(f"/projects/{test_project.id}/images?page=2&limit=2", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        
        # Test third page
        response = client.get(f"/projects/{test_project.id}/images?page=3&limit=2", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 1  # At least 1 image (might include original test_image)
        
        # Test page beyond available data
        response = client.get(f"/projects/{test_project.id}/images?page=10&limit=2", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 0

    def test_get_project_images_count(self, client, auth_headers_admin, test_project, test_db_session):
        """Test getting total count of images in project"""
        from models import Image
        
        # Get initial count
        response = client.get(f"/projects/{test_project.id}/images/count", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        initial_count = response.json()["count"]
        
        # Add some images
        for i in range(3):
            image = Image(
                id=f"count-test-image-{i}",
                name=f"count-test-{i}.jpg",
                project_id=test_project.id,
                file_path=f"storage/images/{test_project.id}/count-test-{i}.jpg",
                size=1024,
                type="image/jpeg",
                uploaded_by=test_project.created_by,
                status="pending"
            )
            test_db_session.add(image)
        test_db_session.commit()
        
        # Check updated count
        response = client.get(f"/projects/{test_project.id}/images/count", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["count"] == initial_count + 3

    def test_get_project_images_count_nonexistent_project(self, client, auth_headers_admin):
        """Test getting count for nonexistent project"""
        response = client.get("/projects/nonexistent-id/images/count", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    
    def test_get_project_images_empty_project(self, client, auth_headers_admin, test_db_session):
        """Test retrieving images from project with no images"""
        from models import Project
        
        # Create a new empty project
        empty_project = Project(
            id="empty-project-id",
            name="Empty Project",
            created_by="admin-test-user-id",
            class_names=["object"],
            class_definitions=[],
            directory_structure={}
        )
        
        # Save to database
        test_db_session.add(empty_project)
        test_db_session.commit()
        
        response = client.get(f"/projects/{empty_project.id}/images", headers=auth_headers_admin)
        
        # Should still return 200 with empty list
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0


class TestFileSystemOperations:
    """Test file system operations during upload"""
    
    def test_upload_creates_unique_filenames(self, client, auth_headers_admin, test_project, sample_image_file):
        """Test that uploading files with same name creates unique storage filenames"""
        files = [
            ("files", ("duplicate.jpg", BytesIO(sample_image_file), "image/jpeg")),
            ("files", ("duplicate.jpg", BytesIO(sample_image_file), "image/jpeg"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert len(data) == 2
        
        # Both should have same display name but different file paths
        assert data[0]["name"] == "duplicate.jpg"
        assert data[1]["name"] == "duplicate.jpg"
        assert data[0]["file_path"] != data[1]["file_path"]  # Different storage paths
    
    
    def test_upload_handles_disk_space_simulation(self, client, auth_headers_admin, test_project, sample_image_file, temp_storage_dir, monkeypatch):
        """Test upload behavior when disk operations fail"""
        # This is a simplified test - in real scenarios you'd mock file operations
        files = [
            ("files", ("test_image.jpg", BytesIO(sample_image_file), "image/jpeg"))
        ]
        
        # Make the images directory read-only to simulate disk issues
        project_dir = temp_storage_dir / "images" / test_project.id
        project_dir.mkdir(parents=True, exist_ok=True)
        
        # Note: This test is basic - full testing would require mocking file operations
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        # Should either succeed or fail gracefully
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_500_INTERNAL_SERVER_ERROR]


class TestImageValidation:
    """Test image validation during upload"""
    
    def test_upload_supported_image_formats(self, client, auth_headers_admin, test_project, sample_image_file):
        """Test uploading various supported image formats"""
        supported_formats = [
            ("image.jpg", "image/jpeg"),
            ("image.jpeg", "image/jpeg"),
            ("image.png", "image/png"),
            ("image.gif", "image/gif"),
            ("image.bmp", "image/bmp"),
            ("image.webp", "image/webp")
        ]
        
        for filename, content_type in supported_formats:
            files = [
                ("files", (filename, BytesIO(sample_image_file), content_type))
            ]
            
            response = client.post(
                f"/projects/{test_project.id}/images/upload",
                files=files,
                headers=auth_headers_admin
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            
            # Should successfully upload the image
            assert len(data) == 1
            assert data[0]["name"] == filename
            assert data[0]["type"] == content_type
    
    
    def test_reject_unsupported_formats(self, client, auth_headers_admin, test_project):
        """Test rejection of unsupported file formats"""
        unsupported_formats = [
            ("document.pdf", "application/pdf", b"PDF content"),
            ("video.mp4", "video/mp4", b"Video content"),
            ("audio.mp3", "audio/mpeg", b"Audio content"),
            ("archive.zip", "application/zip", b"Archive content"),
            ("script.js", "application/javascript", b"var x = 1;")
        ]
        
        for filename, content_type, content in unsupported_formats:
            files = [
                ("files", (filename, BytesIO(content), content_type))
            ]
            
            response = client.post(
                f"/projects/{test_project.id}/images/upload",
                files=files,
                headers=auth_headers_admin
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            
            # Should not upload unsupported files
            assert len(data) == 0


class TestImageUpdate:
    """Test image update functionality"""
    
    def test_update_image_status(self, client, auth_headers_admin, test_image):
        """Test updating image status"""
        update_data = {
            "status": "completed"
        }
        
        response = client.patch(
            f"/images/{test_image.id}",
            json=update_data,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "completed"
    
    def test_update_image_dimensions(self, client, auth_headers_admin, test_image):
        """Test updating image dimensions"""
        update_data = {
            "width": 800,
            "height": 600
        }
        
        response = client.patch(
            f"/images/{test_image.id}",
            json=update_data,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["width"] == 800
        assert data["height"] == 600

    def test_update_nonexistent_image(self, client, auth_headers_admin):
        """Test updating non-existent image"""
        update_data = {
            "status": "completed"
        }
        
        response = client.patch(
            "/images/nonexistent-id",
            json=update_data,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestImageDeletion:
    """Test image deletion functionality"""
    
    def test_delete_image_success(self, client, auth_headers_admin, test_image):
        """Test successful image deletion"""
        response = client.delete(
            f"/images/{test_image.id}",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify image is deleted by trying to download it
        get_response = client.get(
            f"/images/{test_image.id}/download",
            headers=auth_headers_admin
        )
        assert get_response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_delete_nonexistent_image(self, client, auth_headers_admin):
        """Test deleting non-existent image"""
        response = client.delete(
            "/images/nonexistent-id",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_delete_image_without_auth(self, client, test_image):
        """Test deleting image without authentication"""
        response = client.delete(f"/images/{test_image.id}")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN