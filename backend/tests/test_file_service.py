import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
from fastapi import HTTPException, status
from services.file_service import FileService
from models import Project, ImageStatus


class TestFileServiceErrorHandling:
    """Test file service error handling and edge cases"""
    
    def test_upload_to_nonexistent_project(self, client, auth_headers_admin, sample_image_file):
        """Test uploading to a project that doesn't exist"""
        from io import BytesIO
        
        files = [
            ("files", ("test.jpg", BytesIO(sample_image_file), "image/jpeg"))
        ]
        
        response = client.post(
            "/projects/nonexistent-project-id/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Project not found" in response.json()["detail"]
    
    @patch('services.file_service.Path.mkdir')
    def test_upload_directory_creation_failure(self, mock_mkdir, client, auth_headers_admin, test_project, sample_image_file):
        """Test handling of directory creation failure during upload"""
        from io import BytesIO
        
        # Mock mkdir to raise an exception
        mock_mkdir.side_effect = PermissionError("Permission denied")
        
        files = [
            ("files", ("test.jpg", BytesIO(sample_image_file), "image/jpeg"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Failed to create storage directory" in response.json()["detail"]
    
    def test_upload_invalid_file_format(self, client, auth_headers_admin, test_project):
        """Test uploading invalid file format"""
        from io import BytesIO
        
        # Create a text file instead of image
        files = [
            ("files", ("test.txt", BytesIO(b"This is not an image"), "text/plain"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should skip invalid files
        assert len(data) == 0
    
    def test_upload_corrupted_image(self, client, auth_headers_admin, test_project):
        """Test uploading corrupted image file"""
        from io import BytesIO
        
        # Create a file that looks like JPEG but is corrupted
        corrupted_jpeg = b'\xff\xd8\xff\xe0' + b'corrupted data'
        
        files = [
            ("files", ("corrupted.jpg", BytesIO(corrupted_jpeg), "image/jpeg"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # File service might accept files even if they're corrupted (depends on PIL handling)
        # This test verifies the service doesn't crash on corrupted data
        assert isinstance(data, list)
    
    @patch('services.file_service.PILImage.open')
    def test_upload_image_processing_error(self, mock_pil_open, client, auth_headers_admin, test_project, sample_image_file):
        """Test handling of image processing errors during upload"""
        from io import BytesIO
        
        # Mock PIL to raise an exception
        mock_pil_open.side_effect = Exception("Image processing failed")
        
        files = [
            ("files", ("test.jpg", BytesIO(sample_image_file), "image/jpeg"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # File service handles PIL errors gracefully
        assert isinstance(data, list)


class TestFileServicePermissions:
    """Test file service permission and access control"""
    
    def test_annotator_upload_to_unassigned_project(self, client, auth_headers_annotator, test_project, sample_image_file):
        """Test annotator cannot upload to unassigned project"""
        from io import BytesIO
        
        files = [
            ("files", ("test.jpg", BytesIO(sample_image_file), "image/jpeg"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_annotator
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_update_image_without_permission(self, client, auth_headers_annotator, test_image):
        """Test updating image without proper permissions"""
        update_data = {
            "status": "completed"
        }
        
        response = client.patch(
            f"/images/{test_image.id}",
            json=update_data,
            headers=auth_headers_annotator
        )
        
        # Should fail because annotator doesn't have access to the project
        assert response.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]
    
    def test_delete_image_without_permission(self, client, auth_headers_annotator, test_image):
        """Test deleting image without proper permissions"""
        response = client.delete(
            f"/images/{test_image.id}",
            headers=auth_headers_annotator
        )
        
        # Should fail because annotator doesn't have access to the project
        assert response.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]


class TestFileServiceEdgeCases:
    """Test file service edge cases and boundary conditions"""
    
    def test_upload_empty_file(self, client, auth_headers_admin, test_project):
        """Test uploading completely empty file"""
        from io import BytesIO
        
        files = [
            ("files", ("empty.jpg", BytesIO(b""), "image/jpeg"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # File service might handle empty files differently
        assert isinstance(data, list)
    
    def test_upload_file_with_very_long_name(self, client, auth_headers_admin, test_project, sample_image_file):
        """Test uploading file with extremely long filename"""
        from io import BytesIO
        
        # Create a very long filename
        long_filename = "a" * 200 + ".jpg"  # Reduced length to be more realistic
        
        files = [
            ("files", (long_filename, BytesIO(sample_image_file), "image/jpeg"))
        ]
        
        response = client.post(
            f"/projects/{test_project.id}/images/upload",
            files=files,
            headers=auth_headers_admin
        )
        
        # Should handle long filenames gracefully
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # File service should handle this case
        assert isinstance(data, list)
    
    def test_get_nonexistent_image_annotations(self, client, auth_headers_admin):
        """Test getting annotations for non-existent image"""
        response = client.get(
            "/images/nonexistent-id/annotations",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_save_annotations_to_nonexistent_image(self, client, auth_headers_admin):
        """Test saving annotations to non-existent image"""
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "test",
                "color": "#ff0000",
                "x": 10.0,
                "y": 10.0,
                "width": 50.0,
                "height": 50.0
            }
        ]
        
        response = client.post(
            "/images/nonexistent-id/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND