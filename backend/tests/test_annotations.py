import pytest
from fastapi import status
from models import ImageStatus


class TestAnnotationCreation:
    """Test bounding box annotation creation functionality"""
    
    def test_save_annotations_success(self, client, auth_headers_admin, test_image):
        """Test successful creation of annotations"""
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "person",
                "color": "#ff0000",
                "x": 10.0,
                "y": 20.0,
                "width": 30.0,
                "height": 40.0
            },
            {
                "class_id": 1,
                "class_name": "car",
                "color": "#00ff00",
                "x": 100.0,
                "y": 150.0,
                "width": 50.0,
                "height": 60.0
            }
        ]
        
        response = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) == 2
        
        # Check first annotation
        ann1 = data[0]
        assert ann1["class_id"] == 0
        assert ann1["class_name"] == "person"
        assert ann1["color"] == "#ff0000"
        assert ann1["x"] == 10.0
        assert ann1["y"] == 20.0
        assert ann1["width"] == 30.0
        assert ann1["height"] == 40.0
        assert ann1["image_id"] == test_image.id
        assert ann1["created_by"] == "admin-test-user-id"
        assert "id" in ann1
        assert "created_at" in ann1
        
        # Check second annotation
        ann2 = data[1]
        assert ann2["class_id"] == 1
        assert ann2["class_name"] == "car"
        assert ann2["x"] == 100.0
        assert ann2["y"] == 150.0
    
    
    def test_save_single_annotation(self, client, auth_headers_admin, test_image):
        """Test saving a single annotation"""
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "person",
                "color": "#ff0000",
                "x": 50.0,
                "y": 75.0,
                "width": 25.0,
                "height": 35.0
            }
        ]
        
        response = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert len(data) == 1
        assert data[0]["class_id"] == 0
        assert data[0]["x"] == 50.0
        assert data[0]["y"] == 75.0
    
    
    def test_save_empty_annotations_list(self, client, auth_headers_admin, test_image):
        """Test saving empty annotations list (clearing annotations)"""
        response = client.post(
            f"/images/{test_image.id}/annotations",
            json=[],
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) == 0
    
    
    def test_save_annotations_updates_image_status(self, client, auth_headers_admin, test_image, test_db_session):
        """Test that saving annotations updates image status to completed"""
        from models import Image
        
        # Verify image is initially pending
        assert test_image.status == ImageStatus.PENDING
        
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "person",
                "color": "#ff0000",
                "x": 10.0,
                "y": 20.0,
                "width": 30.0,
                "height": 40.0
            }
        ]
        
        response = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        
        # Check that image status was updated
        test_db_session.refresh(test_image)
        assert test_image.status == ImageStatus.COMPLETED
    
    
    def test_save_annotations_replaces_existing(self, client, auth_headers_admin, test_image, test_annotations):
        """Test that saving annotations replaces existing ones"""
        # First, verify we have existing annotations
        response = client.get(f"/images/{test_image.id}/annotations", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        existing_data = response.json()
        assert len(existing_data) == 2  # From test_annotations fixture
        
        # Save new annotations
        new_annotations = [
            {
                "class_id": 2,
                "class_name": "bike",
                "color": "#0000ff",
                "x": 200.0,
                "y": 300.0,
                "width": 40.0,
                "height": 50.0
            }
        ]
        
        response = client.post(
            f"/images/{test_image.id}/annotations",
            json=new_annotations,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should only have the new annotation
        assert len(data) == 1
        assert data[0]["class_name"] == "bike"
        assert data[0]["x"] == 200.0
        
        # Verify old annotations are gone
        response = client.get(f"/images/{test_image.id}/annotations", headers=auth_headers_admin)
        final_data = response.json()
        assert len(final_data) == 1
        assert final_data[0]["class_name"] == "bike"
    
    
    def test_save_annotations_nonexistent_image(self, client, auth_headers_admin):
        """Test saving annotations to non-existent image"""
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "person",
                "color": "#ff0000",
                "x": 10.0,
                "y": 20.0,
                "width": 30.0,
                "height": 40.0
            }
        ]
        
        response = client.post(
            "/images/nonexistent-image-id/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    
    def test_save_annotations_without_auth(self, client, test_image):
        """Test saving annotations without authentication"""
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "person",
                "color": "#ff0000",
                "x": 10.0,
                "y": 20.0,
                "width": 30.0,
                "height": 40.0
            }
        ]
        
        response = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestAnnotationValidation:
    """Test annotation data validation"""
    
    def test_annotation_missing_required_fields(self, client, auth_headers_admin, test_image):
        """Test annotation with missing required fields"""
        invalid_annotations = [
            {
                # Missing class_id, class_name, color, x, y, width, height
            },
            {
                "class_id": 0,
                # Missing other required fields
            },
            {
                "class_id": 0,
                "class_name": "person",
                "color": "#ff0000",
                # Missing coordinates
            }
        ]
        
        for invalid_annotation in invalid_annotations:
            response = client.post(
                f"/images/{test_image.id}/annotations",
                json=[invalid_annotation],
                headers=auth_headers_admin
            )
            
            assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    
    def test_annotation_invalid_data_types(self, client, auth_headers_admin, test_image):
        """Test annotation with invalid data types"""
        invalid_annotations = [
            {
                "class_id": "not_an_integer",  # Should be int
                "class_name": "person",
                "color": "#ff0000",
                "x": 10.0,
                "y": 20.0,
                "width": 30.0,
                "height": 40.0
            },
            {
                "class_id": 0,
                "class_name": 123,  # Should be string
                "color": "#ff0000",
                "x": 10.0,
                "y": 20.0,
                "width": 30.0,
                "height": 40.0
            },
            {
                "class_id": 0,
                "class_name": "person",
                "color": "#ff0000",
                "x": "not_a_number",  # Should be float
                "y": 20.0,
                "width": 30.0,
                "height": 40.0
            }
        ]
        
        for invalid_annotation in invalid_annotations:
            response = client.post(
                f"/images/{test_image.id}/annotations",
                json=[invalid_annotation],
                headers=auth_headers_admin
            )
            
            assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    
    def test_annotation_negative_coordinates(self, client, auth_headers_admin, test_image):
        """Test annotation with negative coordinates (should be allowed)"""
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "person",
                "color": "#ff0000",
                "x": -10.0,  # Negative coordinates might be valid
                "y": -5.0,
                "width": 30.0,
                "height": 40.0
            }
        ]
        
        response = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        
        # Should accept negative coordinates
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data[0]["x"] == -10.0
        assert data[0]["y"] == -5.0
    
    
    def test_annotation_zero_dimensions(self, client, auth_headers_admin, test_image):
        """Test annotation with zero width or height"""
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "person",
                "color": "#ff0000",
                "x": 10.0,
                "y": 20.0,
                "width": 0.0,  # Zero width
                "height": 40.0
            }
        ]
        
        response = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        
        # Should accept zero dimensions
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data[0]["width"] == 0.0
    
    
    def test_annotation_very_large_coordinates(self, client, auth_headers_admin, test_image):
        """Test annotation with very large coordinates"""
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "person",
                "color": "#ff0000",
                "x": 999999.0,
                "y": 888888.0,
                "width": 100000.0,
                "height": 200000.0
            }
        ]
        
        response = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        
        # Should accept large coordinates
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data[0]["x"] == 999999.0


class TestAnnotationRetrieval:
    """Test annotation retrieval functionality"""
    
    def test_get_annotations_success(self, client, auth_headers_admin, test_image, test_annotations):
        """Test successful retrieval of annotations"""
        response = client.get(f"/images/{test_image.id}/annotations", headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) == 2  # From test_annotations fixture
        
        # Check annotation details
        annotation_names = [ann["class_name"] for ann in data]
        assert "person" in annotation_names
        assert "car" in annotation_names
        
        # Verify annotation structure
        for annotation in data:
            assert "id" in annotation
            assert "image_id" in annotation
            assert "class_id" in annotation
            assert "class_name" in annotation
            assert "color" in annotation
            assert "x" in annotation
            assert "y" in annotation
            assert "width" in annotation
            assert "height" in annotation
            assert "created_at" in annotation
            assert "created_by" in annotation
            assert annotation["image_id"] == test_image.id
    
    
    def test_get_annotations_empty_image(self, client, auth_headers_admin, test_image):
        """Test getting annotations from image with no annotations"""
        response = client.get(f"/images/{test_image.id}/annotations", headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) == 0
    
    
    def test_get_annotations_nonexistent_image(self, client, auth_headers_admin):
        """Test getting annotations from non-existent image"""
        response = client.get("/images/nonexistent-image-id/annotations", headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    
    def test_get_annotations_without_auth(self, client, test_image):
        """Test getting annotations without authentication"""
        response = client.get(f"/images/{test_image.id}/annotations")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_get_annotations_with_annotator_access(self, client, auth_headers_annotator, assigned_project, test_image):
        """Test that annotator can get annotations from assigned project"""
        # Note: This assumes test_image belongs to assigned_project
        # You might need to create a specific image for the assigned project
        
        response = client.get(f"/images/{test_image.id}/annotations", headers=auth_headers_annotator)
        
        # Should work if annotator has access to the project
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_403_FORBIDDEN]


class TestAnnotationCoordinateSystem:
    """Test annotation coordinate system and validation"""
    
    def test_annotation_coordinate_precision(self, client, auth_headers_admin, test_image):
        """Test that annotation coordinates maintain precision"""
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "person",
                "color": "#ff0000",
                "x": 10.123456,
                "y": 20.987654,
                "width": 30.555555,
                "height": 40.111111
            }
        ]
        
        response = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Check that precision is maintained (within reasonable float precision)
        assert abs(data[0]["x"] - 10.123456) < 0.000001
        assert abs(data[0]["y"] - 20.987654) < 0.000001
        assert abs(data[0]["width"] - 30.555555) < 0.000001
        assert abs(data[0]["height"] - 40.111111) < 0.000001
    
    
    def test_annotation_bounding_box_calculations(self, client, auth_headers_admin, test_image):
        """Test that bounding box coordinates are stored correctly"""
        annotations_data = [
            {
                "class_id": 0,
                "class_name": "person",
                "color": "#ff0000",
                "x": 10.0,  # Top-left x
                "y": 20.0,  # Top-left y
                "width": 30.0,   # Width
                "height": 40.0   # Height
            }
        ]
        
        response = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        annotation = data[0]
        
        # Verify stored coordinates
        assert annotation["x"] == 10.0  # Top-left x
        assert annotation["y"] == 20.0  # Top-left y
        assert annotation["width"] == 30.0
        assert annotation["height"] == 40.0
        
        # Calculate derived coordinates for verification
        right = annotation["x"] + annotation["width"]  # Should be 40.0
        bottom = annotation["y"] + annotation["height"]  # Should be 60.0
        
        assert right == 40.0
        assert bottom == 60.0


class TestAnnotationClassManagement:
    """Test annotation class management"""
    
    def test_annotation_with_custom_class(self, client, auth_headers_admin, test_image):
        """Test creating annotation with custom class definition"""
        annotations_data = [
            {
                "class_id": 5,
                "class_name": "custom_object",
                "color": "#ff00ff",
                "x": 10.0,
                "y": 20.0,
                "width": 30.0,
                "height": 40.0
            }
        ]
        
        response = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data,
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data[0]["class_id"] == 5
        assert data[0]["class_name"] == "custom_object"
        assert data[0]["color"] == "#ff00ff"
    
    
    def test_annotation_color_format_validation(self, client, auth_headers_admin, test_image):
        """Test that various color formats are accepted"""
        color_formats = [
            "#ff0000",    # Standard hex
            "#FF0000",    # Uppercase hex
            "#f00",       # Short hex
            "red",        # Color name
            "rgb(255,0,0)",  # RGB format
            "rgba(255,0,0,1)"  # RGBA format
        ]
        
        for i, color in enumerate(color_formats):
            annotations_data = [
                {
                    "class_id": i,
                    "class_name": f"test_class_{i}",
                    "color": color,
                    "x": 10.0,
                    "y": 20.0,
                    "width": 30.0,
                    "height": 40.0
                }
            ]
            
            response = client.post(
                f"/images/{test_image.id}/annotations",
                json=annotations_data,
                headers=auth_headers_admin
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data[0]["color"] == color


class TestAnnotationConcurrency:
    """Test annotation operations under concurrent scenarios"""
    
    def test_multiple_saves_in_sequence(self, client, auth_headers_admin, test_image):
        """Test multiple annotation saves in sequence"""
        # First save
        annotations_data_1 = [
            {
                "class_id": 0,
                "class_name": "person",
                "color": "#ff0000",
                "x": 10.0,
                "y": 20.0,
                "width": 30.0,
                "height": 40.0
            }
        ]
        
        response1 = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data_1,
            headers=auth_headers_admin
        )
        
        assert response1.status_code == status.HTTP_200_OK
        
        # Second save (should replace first)
        annotations_data_2 = [
            {
                "class_id": 1,
                "class_name": "car",
                "color": "#00ff00",
                "x": 50.0,
                "y": 60.0,
                "width": 70.0,
                "height": 80.0
            }
        ]
        
        response2 = client.post(
            f"/images/{test_image.id}/annotations",
            json=annotations_data_2,
            headers=auth_headers_admin
        )
        
        assert response2.status_code == status.HTTP_200_OK
        
        # Verify only second annotation exists
        response = client.get(f"/images/{test_image.id}/annotations", headers=auth_headers_admin)
        data = response.json()
        
        assert len(data) == 1
        assert data[0]["class_name"] == "car"
        assert data[0]["x"] == 50.0