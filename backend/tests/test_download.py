import pytest
from fastapi import status
import tempfile
from pathlib import Path


class TestAnnotationDownload:
    """Test annotation download functionality"""
    
    def test_download_annotations_yolo_format(self, client, auth_headers_admin, test_image, test_annotations):
        """Test downloading annotations in YOLO format"""
        response = client.get(
            f"/images/{test_image.id}/annotations/download",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.headers["content-type"] == "text/plain; charset=utf-8"
        
        # Check filename in response headers
        content_disposition = response.headers.get("content-disposition", "")
        assert "test-image.txt" in content_disposition
        
        # Parse YOLO format content
        content = response.content.decode("utf-8")
        lines = content.strip().split("\n")
        
        assert len(lines) == 2  # Two annotations from test_annotations fixture
        
        # Parse first annotation (person: x=10, y=20, width=30, height=40)
        # Image dimensions: 100x100 (from test_image fixture)
        line1_parts = lines[0].split()
        assert len(line1_parts) == 5
        
        class_id = int(line1_parts[0])
        center_x = float(line1_parts[1])
        center_y = float(line1_parts[2])
        norm_width = float(line1_parts[3])
        norm_height = float(line1_parts[4])
        
        assert class_id == 0  # person class
        
        # Verify YOLO normalization
        # Original: x=10, y=20, width=30, height=40 on 100x100 image
        # Center: (10 + 30/2) = 25, (20 + 40/2) = 40
        # Normalized: center_x = 25/100 = 0.25, center_y = 40/100 = 0.40
        # Normalized: width = 30/100 = 0.30, height = 40/100 = 0.40
        assert abs(center_x - 0.25) < 0.001
        assert abs(center_y - 0.40) < 0.001
        assert abs(norm_width - 0.30) < 0.001
        assert abs(norm_height - 0.40) < 0.001
    
    
    def test_download_annotations_coordinate_conversion(self, client, auth_headers_admin, test_image):
        """Test YOLO coordinate conversion accuracy"""
        # Create specific annotations for testing coordinate conversion
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "test_object",
                "color": "#ff0000",
                "x": 0.0,      # Top-left corner
                "y": 0.0,
                "width": 50.0,  # Half image width
                "height": 100.0  # Full image height
            },
            {
                "class_id": 1,
                "class_name": "center_object",
                "color": "#00ff00",
                "x": 25.0,     # Quarter from left
                "y": 25.0,     # Quarter from top
                "width": 50.0,  # Half width
                "height": 50.0  # Half height
            }
        ]
        
        # Save annotations
        save_response = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        assert save_response.status_code == status.HTTP_200_OK
        
        # Download YOLO format
        response = client.get(
            f"/images/{test_image.id}/annotations/download",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode("utf-8")
        lines = content.strip().split("\n")
        
        # Check first annotation (corner object)
        line1_parts = lines[0].split()
        assert int(line1_parts[0]) == 0
        
        # Center calculation: (0 + 50/2, 0 + 100/2) = (25, 50)
        # Normalized: (25/100, 50/100) = (0.25, 0.5)
        assert abs(float(line1_parts[1]) - 0.25) < 0.001  # center_x
        assert abs(float(line1_parts[2]) - 0.5) < 0.001   # center_y
        assert abs(float(line1_parts[3]) - 0.5) < 0.001   # width
        assert abs(float(line1_parts[4]) - 1.0) < 0.001   # height
        
        # Check second annotation (center object)
        line2_parts = lines[1].split()
        assert int(line2_parts[0]) == 1
        
        # Center calculation: (25 + 50/2, 25 + 50/2) = (50, 50)
        # Normalized: (50/100, 50/100) = (0.5, 0.5)
        assert abs(float(line2_parts[1]) - 0.5) < 0.001   # center_x
        assert abs(float(line2_parts[2]) - 0.5) < 0.001   # center_y
        assert abs(float(line2_parts[3]) - 0.5) < 0.001   # width
        assert abs(float(line2_parts[4]) - 0.5) < 0.001   # height
    
    
    def test_download_annotations_no_annotations(self, client, auth_headers_admin, test_image):
        """Test downloading from image with no annotations"""
        response = client.get(
            f"/images/{test_image.id}/annotations/download",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "No annotations found" in data["detail"]
    
    
    def test_download_annotations_nonexistent_image(self, client, auth_headers_admin):
        """Test downloading annotations from non-existent image"""
        response = client.get(
            "/images/nonexistent-image-id/annotations/download",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    
    def test_download_annotations_without_auth(self, client, test_image):
        """Test downloading annotations without authentication"""
        response = client.get(f"/images/{test_image.id}/annotations/download")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_download_annotations_precision(self, client, auth_headers_admin, test_image):
        """Test YOLO format precision for small annotations"""
        # Create very small annotation to test precision
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "tiny_object",
                "color": "#ff0000",
                "x": 10.123,
                "y": 20.456,
                "width": 5.789,
                "height": 8.012
            }
        ]
        
        # Save annotations
        save_response = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        assert save_response.status_code == status.HTTP_200_OK
        
        # Download YOLO format
        response = client.get(
            f"/images/{test_image.id}/annotations/download",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode("utf-8")
        line_parts = content.strip().split()
        
        # Verify precision is maintained (6 decimal places as per YOLO format)
        assert len(line_parts) == 5
        
        # Check that values have proper precision (not just rounded to integers)
        center_x = float(line_parts[1])
        center_y = float(line_parts[2])
        width = float(line_parts[3])
        height = float(line_parts[4])
        
        # All values should be between 0 and 1 and have reasonable precision
        assert 0 <= center_x <= 1
        assert 0 <= center_y <= 1
        assert 0 <= width <= 1
        assert 0 <= height <= 1
        
        # Check that precision is maintained (should have decimal places)
        assert "." in line_parts[1]
        assert "." in line_parts[2]
        assert "." in line_parts[3]
        assert "." in line_parts[4]
    
    
    def test_download_annotations_edge_coordinates(self, client, auth_headers_admin, test_image):
        """Test YOLO format for annotations at image edges"""
        # Create annotations at various edge positions
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "top_left",
                "color": "#ff0000",
                "x": 0.0,
                "y": 0.0,
                "width": 10.0,
                "height": 10.0
            },
            {
                "class_id": 1,
                "class_name": "bottom_right",
                "color": "#00ff00",
                "x": 90.0,  # Near right edge
                "y": 90.0,  # Near bottom edge
                "width": 10.0,
                "height": 10.0
            },
            {
                "class_id": 2,
                "class_name": "full_image",
                "color": "#0000ff",
                "x": 0.0,
                "y": 0.0,
                "width": 100.0,  # Full width
                "height": 100.0  # Full height
            }
        ]
        
        # Save annotations
        save_response = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        assert save_response.status_code == status.HTTP_200_OK
        
        # Download YOLO format
        response = client.get(
            f"/images/{test_image.id}/annotations/download",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode("utf-8")
        lines = content.strip().split("\n")
        
        assert len(lines) == 3
        
        # Check top-left annotation
        top_left = lines[0].split()
        assert int(top_left[0]) == 0
        assert abs(float(top_left[1]) - 0.05) < 0.001  # center_x = (0 + 10/2)/100
        assert abs(float(top_left[2]) - 0.05) < 0.001  # center_y = (0 + 10/2)/100
        
        # Check bottom-right annotation
        bottom_right = lines[1].split()
        assert int(bottom_right[0]) == 1
        assert abs(float(bottom_right[1]) - 0.95) < 0.001  # center_x = (90 + 10/2)/100
        assert abs(float(bottom_right[2]) - 0.95) < 0.001  # center_y = (90 + 10/2)/100
        
        # Check full image annotation
        full_image = lines[2].split()
        assert int(full_image[0]) == 2
        assert abs(float(full_image[1]) - 0.5) < 0.001   # center_x = (0 + 100/2)/100
        assert abs(float(full_image[2]) - 0.5) < 0.001   # center_y = (0 + 100/2)/100
        assert abs(float(full_image[3]) - 1.0) < 0.001   # width = 100/100
        assert abs(float(full_image[4]) - 1.0) < 0.001   # height = 100/100


class TestImageDownload:
    """Test image file download functionality"""
    
    def test_download_image_success(self, client, auth_headers_admin, test_image):
        """Test successful image download"""
        response = client.get(
            f"/images/{test_image.id}/download",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        assert response.headers["content-type"] == "image/jpeg"
        
        # Check filename in response headers
        content_disposition = response.headers.get("content-disposition", "")
        assert "test-image.jpg" in content_disposition
        
        # Verify content is not empty
        assert len(response.content) > 0
    
    
    def test_download_image_nonexistent(self, client, auth_headers_admin):
        """Test downloading non-existent image"""
        response = client.get(
            "/images/nonexistent-image-id/download",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    
    def test_download_image_without_auth(self, client, test_image):
        """Test downloading image without authentication"""
        response = client.get(f"/images/{test_image.id}/download")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_download_image_file_not_found_on_disk(self, client, auth_headers_admin, test_image, temp_storage_dir):
        """Test downloading image when file doesn't exist on disk"""
        # Remove the actual file from disk
        project_dir = temp_storage_dir / "images" / test_image.project_id
        for file_path in project_dir.glob("*"):
            file_path.unlink()
        
        response = client.get(
            f"/images/{test_image.id}/download",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "Image file not found on disk" in data["detail"]


class TestYOLOFormatValidation:
    """Test YOLO format validation and edge cases"""
    
    def test_yolo_format_structure(self, client, auth_headers_admin, test_image, test_annotations):
        """Test that YOLO format follows correct structure"""
        response = client.get(
            f"/images/{test_image.id}/annotations/download",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode("utf-8")
        lines = content.strip().split("\n")
        
        for line in lines:
            parts = line.split()
            assert len(parts) == 5  # class_id, center_x, center_y, width, height
            
            # Verify class_id is integer
            class_id = int(parts[0])
            assert class_id >= 0
            
            # Verify all coordinates are floats between 0 and 1
            center_x = float(parts[1])
            center_y = float(parts[2])
            width = float(parts[3])
            height = float(parts[4])
            
            assert 0 <= center_x <= 1
            assert 0 <= center_y <= 1
            assert 0 <= width <= 1
            assert 0 <= height <= 1
    
    
    def test_yolo_format_with_zero_dimensions(self, client, auth_headers_admin, test_image):
        """Test YOLO format generation with zero width/height annotations"""
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "zero_width",
                "color": "#ff0000",
                "x": 50.0,
                "y": 50.0,
                "width": 0.0,  # Zero width
                "height": 10.0
            },
            {
                "class_id": 1,
                "class_name": "zero_height",
                "color": "#00ff00",
                "x": 25.0,
                "y": 25.0,
                "width": 10.0,
                "height": 0.0  # Zero height
            }
        ]
        
        # Save annotations
        save_response = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        assert save_response.status_code == status.HTTP_200_OK
        
        # Download YOLO format
        response = client.get(
            f"/images/{test_image.id}/annotations/download",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode("utf-8")
        lines = content.strip().split("\n")
        
        assert len(lines) == 2
        
        # Check zero width annotation
        zero_width_parts = lines[0].split()
        assert float(zero_width_parts[3]) == 0.0  # width should be 0
        assert float(zero_width_parts[4]) == 0.1   # height should be 10/100
        
        # Check zero height annotation
        zero_height_parts = lines[1].split()
        assert float(zero_height_parts[3]) == 0.1  # width should be 10/100
        assert float(zero_height_parts[4]) == 0.0  # height should be 0
    
    
    def test_yolo_format_with_different_image_dimensions(self, client, auth_headers_admin, admin_user, test_project, temp_storage_dir, test_db_session):
        """Test YOLO format generation with different image dimensions"""
        from models import Image, ImageStatus
        
        # Create image with different dimensions
        wide_image = Image(
            id="wide-image-id",
            project_id=test_project.id,
            name="wide-image.jpg",
            file_path=f"storage/images/{test_project.id}/wide-image.jpg",
            size=1000,
            type="image/jpeg",
            uploaded_by=admin_user.id,
            status=ImageStatus.PENDING,
            width=200,  # Wide image
            height=100
        )
        
        # Create annotations for wide image
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "object",
                "color": "#ff0000",
                "x": 0.0,
                "y": 0.0,
                "width": 100.0,  # Half the width
                "height": 50.0   # Half the height
            }
        ]
        
        # Save annotation manually to test database
        test_db_session.add(wide_image)
        test_db_session.commit()
        
        # Save annotations
        save_response = client.post(
            f"/images/{wide_image.id}/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        assert save_response.status_code == status.HTTP_200_OK
        
        # Download YOLO format
        response = client.get(
            f"/images/{wide_image.id}/annotations/download",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode("utf-8")
        line_parts = content.strip().split()
        
        # Verify normalization with different dimensions
        # Center: (0 + 100/2, 0 + 50/2) = (50, 25)
        # Normalized: (50/200, 25/100) = (0.25, 0.25)
        # Size: (100/200, 50/100) = (0.5, 0.5)
        assert abs(float(line_parts[1]) - 0.25) < 0.001  # center_x
        assert abs(float(line_parts[2]) - 0.25) < 0.001  # center_y
        assert abs(float(line_parts[3]) - 0.5) < 0.001   # width
        assert abs(float(line_parts[4]) - 0.5) < 0.001   # height


class TestDownloadFileNaming:
    """Test download file naming conventions"""
    
    def test_annotation_filename_generation(self, client, auth_headers_admin, test_image, test_annotations):
        """Test that annotation filename is correctly generated from image name"""
        response = client.get(
            f"/images/{test_image.id}/annotations/download",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        
        # Check Content-Disposition header for filename
        content_disposition = response.headers.get("content-disposition", "")
        assert "filename=" in content_disposition
        
        # Should be image name with .txt extension
        expected_filename = "test-image.txt"  # test_image.name is "test-image.jpg"
        assert expected_filename in content_disposition
    
    
    def test_annotation_filename_with_complex_image_name(self, client, auth_headers_admin, admin_user, test_project, test_db_session):
        """Test annotation filename generation with complex image names"""
        from models import Image, ImageStatus, Annotation
        
        # Create image with complex name
        complex_image = Image(
            id="complex-image-id",
            project_id=test_project.id,
            name="IMG_2023-08-16_15-30-45_HDR.jpeg",
            file_path=f"storage/images/{test_project.id}/complex.jpeg",
            size=1000,
            type="image/jpeg",
            uploaded_by=admin_user.id,
            status=ImageStatus.PENDING,
            width=100,
            height=100
        )
        
        test_db_session.add(complex_image)
        
        # Add annotation
        annotation = Annotation(
            id="complex-annotation-id",
            image_id=complex_image.id,
            class_id=0,
            class_name="object",
            color="#ff0000",
            x=10.0,
            y=20.0,
            width=30.0,
            height=40.0,
            created_by=admin_user.id
        )
        
        test_db_session.add(annotation)
        test_db_session.commit()
        
        response = client.get(
            f"/images/{complex_image.id}/annotations/download",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        
        # Should generate filename based on image name without extension
        content_disposition = response.headers.get("content-disposition", "")
        expected_filename = "IMG_2023-08-16_15-30-45_HDR.txt"
        assert expected_filename in content_disposition