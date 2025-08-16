import pytest
from fastapi import status
from models import UserRole


class TestUserCreation:
    """Test user account creation functionality (admin only)"""
    
    def test_create_user_as_admin_success(self, client, auth_headers_admin):
        """Test successful user creation by admin"""
        user_data = {
            "username": "new_annotator",
            "password": "secure_password123",
            "role": "annotator"
        }
        
        response = client.post("/auth/register", json=user_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["username"] == "new_annotator"
        assert data["role"] == "annotator"
        assert "id" in data
        assert "created_at" in data
        # Password should not be returned
        assert "password" not in data
        assert "password_hash" not in data
    
    
    def test_create_admin_user_as_admin_success(self, client, auth_headers_admin):
        """Test creating an admin user by admin"""
        user_data = {
            "username": "new_admin",
            "password": "admin_password123",
            "role": "admin"
        }
        
        response = client.post("/auth/register", json=user_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["username"] == "new_admin"
        assert data["role"] == "admin"
    
    
    def test_create_user_as_annotator_forbidden(self, client, auth_headers_annotator):
        """Test that annotators cannot create users"""
        user_data = {
            "username": "unauthorized_user",
            "password": "password123",
            "role": "annotator"
        }
        
        response = client.post("/auth/register", json=user_data, headers=auth_headers_annotator)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        data = response.json()
        assert data["detail"] == "Admin access required"
    
    
    def test_create_user_without_auth_forbidden(self, client):
        """Test that unauthenticated users cannot create accounts"""
        user_data = {
            "username": "unauthorized_user",
            "password": "password123",
            "role": "annotator"
        }
        
        response = client.post("/auth/register", json=user_data)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_create_user_duplicate_username(self, client, auth_headers_admin, admin_user):
        """Test creating user with duplicate username"""
        user_data = {
            "username": admin_user.username,  # Use existing username
            "password": "different_password",
            "role": "annotator"
        }
        
        response = client.post("/auth/register", json=user_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "Username already exists" in data["detail"]
    
    
    def test_create_user_missing_username(self, client, auth_headers_admin):
        """Test creating user without username"""
        user_data = {
            "password": "password123",
            "role": "annotator"
        }
        
        response = client.post("/auth/register", json=user_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    
    def test_create_user_missing_password(self, client, auth_headers_admin):
        """Test creating user without password"""
        user_data = {
            "username": "test_user",
            "role": "annotator"
        }
        
        response = client.post("/auth/register", json=user_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    
    def test_create_user_missing_role(self, client, auth_headers_admin):
        """Test creating user without role"""
        user_data = {
            "username": "test_user",
            "password": "password123"
        }
        
        response = client.post("/auth/register", json=user_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    
    def test_create_user_invalid_role(self, client, auth_headers_admin):
        """Test creating user with invalid role"""
        user_data = {
            "username": "test_user",
            "password": "password123",
            "role": "invalid_role"
        }
        
        response = client.post("/auth/register", json=user_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    
    def test_create_user_empty_username(self, client, auth_headers_admin):
        """Test creating user with empty username"""
        user_data = {
            "username": "",
            "password": "password123",
            "role": "annotator"
        }
        
        response = client.post("/auth/register", json=user_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    
    def test_create_user_empty_password(self, client, auth_headers_admin):
        """Test creating user with empty password"""
        user_data = {
            "username": "test_user",
            "password": "",
            "role": "annotator"
        }
        
        response = client.post("/auth/register", json=user_data, headers=auth_headers_admin)
        
        # Should fail - empty passwords are not allowed for security reasons
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestUserRetrieval:
    """Test user listing and retrieval functionality"""
    
    def test_get_users_as_admin(self, client, auth_headers_admin, admin_user, annotator_user):
        """Test getting all users as admin"""
        response = client.get("/users", headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 2  # At least admin and annotator users
        
        # Check that admin user is in the list
        admin_found = any(user["username"] == admin_user.username for user in data)
        assert admin_found
        
        # Check that annotator user is in the list
        annotator_found = any(user["username"] == annotator_user.username for user in data)
        assert annotator_found
    
    
    def test_get_users_as_annotator_forbidden(self, client, auth_headers_annotator):
        """Test that annotators cannot list users"""
        response = client.get("/users", headers=auth_headers_annotator)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        data = response.json()
        assert data["detail"] == "Admin access required"
    
    
    def test_get_users_without_auth_forbidden(self, client):
        """Test that unauthenticated users cannot list users"""
        response = client.get("/users")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestUserUpdate:
    """Test user update functionality"""
    
    def test_update_user_username_as_admin(self, client, auth_headers_admin, annotator_user):
        """Test updating user username as admin"""
        update_data = {
            "username": "updated_username"
        }
        
        response = client.patch(f"/users/{annotator_user.id}", json=update_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["username"] == "updated_username"
        assert data["id"] == annotator_user.id
    
    
    def test_update_user_password_as_admin(self, client, auth_headers_admin, annotator_user):
        """Test updating user password as admin"""
        update_data = {
            "password": "new_secure_password"
        }
        
        response = client.patch(f"/users/{annotator_user.id}", json=update_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Password should not be returned
        assert "password" not in data
        assert "password_hash" not in data
    
    
    def test_update_user_role_as_admin(self, client, auth_headers_admin, annotator_user):
        """Test updating user role as admin"""
        update_data = {
            "role": "admin"
        }
        
        response = client.patch(f"/users/{annotator_user.id}", json=update_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["role"] == "admin"
    
    
    def test_update_user_as_annotator_forbidden(self, client, auth_headers_annotator, admin_user):
        """Test that annotators cannot update users"""
        update_data = {
            "username": "hacked_username"
        }
        
        response = client.patch(f"/users/{admin_user.id}", json=update_data, headers=auth_headers_annotator)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_update_nonexistent_user(self, client, auth_headers_admin):
        """Test updating non-existent user"""
        update_data = {
            "username": "new_username"
        }
        
        response = client.patch("/users/nonexistent-id", json=update_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    
    def test_update_user_duplicate_username(self, client, auth_headers_admin, admin_user, annotator_user):
        """Test updating user with duplicate username"""
        update_data = {
            "username": admin_user.username  # Try to use admin's username
        }
        
        response = client.patch(f"/users/{annotator_user.id}", json=update_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "Username already exists" in data["detail"]
    
    
    def test_update_user_invalid_role(self, client, auth_headers_admin, annotator_user):
        """Test updating user with invalid role"""
        update_data = {
            "role": "invalid_role"
        }
        
        response = client.patch(f"/users/{annotator_user.id}", json=update_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestUserDeletion:
    """Test user deletion functionality"""
    
    def test_delete_user_as_admin(self, client, auth_headers_admin, annotator_user):
        """Test deleting user as admin"""
        response = client.delete(f"/users/{annotator_user.id}", headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert "deleted successfully" in data["message"]
    
    
    def test_delete_user_as_annotator_forbidden(self, client, auth_headers_annotator, admin_user):
        """Test that annotators cannot delete users"""
        response = client.delete(f"/users/{admin_user.id}", headers=auth_headers_annotator)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_delete_self_forbidden(self, client, auth_headers_admin, admin_user):
        """Test that admin cannot delete themselves"""
        response = client.delete(f"/users/{admin_user.id}", headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "Cannot delete yourself" in data["detail"]
    
    
    def test_delete_nonexistent_user(self, client, auth_headers_admin):
        """Test deleting non-existent user"""
        response = client.delete("/users/nonexistent-id", headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    
    def test_delete_user_without_auth_forbidden(self, client, annotator_user):
        """Test that unauthenticated users cannot delete users"""
        response = client.delete(f"/users/{annotator_user.id}")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestUserPasswordSecurity:
    """Test password security and hashing"""
    
    def test_created_user_password_is_hashed(self, client, auth_headers_admin, test_db_session):
        """Test that created user passwords are properly hashed"""
        from models import User
        
        user_data = {
            "username": "security_test_user",
            "password": "plaintext_password",
            "role": "annotator"
        }
        
        response = client.post("/auth/register", json=user_data, headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        
        # Get user from database
        user = test_db_session.query(User).filter(User.username == "security_test_user").first()
        assert user is not None
        
        # Password should be hashed, not stored in plaintext
        assert user.password_hash != "plaintext_password"
        assert user.password_hash.startswith("$2b$")  # bcrypt hash prefix
    
    
    def test_updated_user_password_is_hashed(self, client, auth_headers_admin, annotator_user, test_db_session):
        """Test that updated passwords are properly hashed"""
        from models import User
        
        update_data = {
            "password": "new_plaintext_password"
        }
        
        response = client.patch(f"/users/{annotator_user.id}", json=update_data, headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        
        # Get user from database
        test_db_session.refresh(annotator_user)
        
        # Password should be hashed, not stored in plaintext
        assert annotator_user.password_hash != "new_plaintext_password"
        assert annotator_user.password_hash.startswith("$2b$")  # bcrypt hash prefix
    
    
    def test_user_can_login_after_password_update(self, client, auth_headers_admin, annotator_user):
        """Test that user can login with new password after update"""
        # Update password
        update_data = {
            "password": "brand_new_password"
        }
        
        response = client.patch(f"/users/{annotator_user.id}", json=update_data, headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        
        # Try to login with new password
        login_response = client.post("/auth/login", json={
            "username": annotator_user.username,
            "password": "brand_new_password"
        })
        
        assert login_response.status_code == status.HTTP_200_OK
        login_data = login_response.json()
        assert "access_token" in login_data