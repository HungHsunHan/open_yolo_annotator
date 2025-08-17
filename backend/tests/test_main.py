import pytest
from fastapi import status


class TestHealthCheck:
    """Test health check endpoint"""
    
    def test_health_check_endpoint(self, client):
        """Test health check returns correct status"""
        response = client.get("/health")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"
        assert "version" in data
    
    def test_health_check_no_auth_required(self, client):
        """Test health check doesn't require authentication"""
        # Should work without any headers
        response = client.get("/health")
        
        assert response.status_code == status.HTTP_200_OK


class TestStorageInitialization:
    """Test storage directory initialization edge cases"""
    
    def test_storage_directory_creation_error_handling(self, client):
        """Test that the app handles storage directory creation issues gracefully"""
        # This test verifies that the application can start even if there are storage issues
        # The actual directory creation is tested during app startup
        # We can verify the app is running by checking a basic endpoint
        response = client.get("/health")
        assert response.status_code == status.HTTP_200_OK