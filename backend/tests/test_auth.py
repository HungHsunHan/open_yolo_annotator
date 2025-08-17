import pytest
from fastapi import status
import jwt
from auth import SECRET_KEY, ALGORITHM


class TestAuthentication:
    """Test authentication and login functionality"""
    
    def test_login_success_admin(self, client, admin_user):
        """Test successful login with admin credentials"""
        response = client.post("/auth/login", json={
            "username": "admin_test",
            "password": "admin_password"
        })
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["username"] == "admin_test"
        assert data["user"]["role"] == "admin"
        
        # Verify token is valid
        token = data["access_token"]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "admin_test"
        assert payload["role"] == "admin"
    
    
    def test_login_success_annotator(self, client, annotator_user):
        """Test successful login with annotator credentials"""
        response = client.post("/auth/login", json={
            "username": "annotator_test",
            "password": "annotator_password"
        })
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["username"] == "annotator_test"
        assert data["user"]["role"] == "annotator"
    
    
    def test_login_invalid_username(self, client):
        """Test login with invalid username"""
        response = client.post("/auth/login", json={
            "username": "nonexistent_user",
            "password": "any_password"
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        data = response.json()
        assert data["detail"] == "Incorrect username or password"
    
    
    def test_login_invalid_password(self, client, admin_user):
        """Test login with invalid password"""
        response = client.post("/auth/login", json={
            "username": "admin_test",
            "password": "wrong_password"
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        data = response.json()
        assert data["detail"] == "Incorrect username or password"
    
    
    def test_login_missing_username(self, client):
        """Test login with missing username"""
        response = client.post("/auth/login", json={
            "password": "some_password"
        })
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    
    def test_login_missing_password(self, client):
        """Test login with missing password"""
        response = client.post("/auth/login", json={
            "username": "some_user"
        })
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    
    def test_get_current_user_with_valid_token(self, client, auth_headers_admin, admin_user):
        """Test getting current user info with valid token"""
        response = client.get("/auth/me", headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["username"] == "admin_test"
        assert data["role"] == "admin"
        assert data["id"] == admin_user.id
    
    
    def test_get_current_user_without_token(self, client):
        """Test getting current user info without token"""
        response = client.get("/auth/me")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_get_current_user_with_invalid_token(self, client):
        """Test getting current user info with invalid token"""
        headers = {"Authorization": "Bearer invalid_token"}
        response = client.get("/auth/me", headers=headers)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    
    def test_get_current_user_with_expired_token(self, client):
        """Test getting current user info with expired token"""
        # Create an expired token (exp in the past)
        import time
        from auth import create_access_token
        from datetime import timedelta
        
        expired_token = create_access_token(
            data={"sub": "test_user", "role": "admin"}, 
            expires_delta=timedelta(seconds=-1)
        )
        
        headers = {"Authorization": f"Bearer {expired_token}"}
        response = client.get("/auth/me", headers=headers)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    
    def test_protected_endpoint_requires_auth(self, client):
        """Test that protected endpoints require authentication"""
        response = client.get("/users")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_protected_endpoint_with_valid_auth(self, client, auth_headers_admin):
        """Test that protected endpoints work with valid authentication"""
        response = client.get("/users", headers=auth_headers_admin)
        
        # Should not get forbidden (may get 200 or other status based on business logic)
        assert response.status_code != status.HTTP_403_FORBIDDEN
        assert response.status_code != status.HTTP_401_UNAUTHORIZED
    
    
    def test_admin_only_endpoint_with_annotator_token(self, client, auth_headers_annotator):
        """Test that admin-only endpoints reject annotator tokens"""
        response = client.get("/users", headers=auth_headers_annotator)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_malformed_authorization_header(self, client):
        """Test request with malformed authorization header"""
        headers = {"Authorization": "Invalid header format"}
        response = client.get("/auth/me", headers=headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_bearer_token_without_bearer_prefix(self, client, admin_token):
        """Test request with token but missing 'Bearer' prefix"""
        headers = {"Authorization": admin_token}
        response = client.get("/auth/me", headers=headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_case_sensitive_bearer_prefix(self, client, admin_token):
        """Test that Bearer prefix is case insensitive (RFC 7235 compliant)"""
        headers = {"Authorization": f"bearer {admin_token}"}
        response = client.get("/auth/me", headers=headers)
        
        assert response.status_code == status.HTTP_200_OK


    def test_get_current_user_with_token_missing_sub(self, client):
        """Test getting current user info with token missing 'sub' field"""
        import jwt
        from auth import SECRET_KEY, ALGORITHM
        
        # Create a token without 'sub' field
        payload = {"role": "admin", "exp": 9999999999}  # Far future expiry
        invalid_token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        
        headers = {"Authorization": f"Bearer {invalid_token}"}
        response = client.get("/auth/me", headers=headers)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_current_user_with_valid_token_but_user_deleted(self, client, admin_user, test_db_session):
        """Test getting current user info when user is deleted after token creation"""
        from auth import create_access_token
        
        # Create a valid token for the user
        token = create_access_token(data={"sub": admin_user.username, "role": admin_user.role.value})
        
        # Delete the user from database
        test_db_session.delete(admin_user)
        test_db_session.commit()
        
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/auth/me", headers=headers)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_admin_required_endpoint_with_annotator(self, client, auth_headers_annotator):
        """Test admin-required endpoint with annotator token"""
        # Try to access an admin-only endpoint like creating users
        user_data = {
            "username": "new_user",
            "password": "password123",
            "role": "annotator"
        }
        
        response = client.post("/auth/register", json=user_data, headers=auth_headers_annotator)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestTokenGeneration:
    """Test JWT token generation and validation"""
    
    def test_token_contains_correct_payload(self, admin_user):
        """Test that generated tokens contain correct payload"""
        from auth import create_access_token
        
        token = create_access_token(data={"sub": admin_user.username, "role": admin_user.role.value})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        assert payload["sub"] == admin_user.username
        assert payload["role"] == admin_user.role.value
        assert "exp" in payload
    
    
    def test_verify_token_function(self, admin_user):
        """Test the verify_token function"""
        from auth import create_access_token, verify_token
        
        token = create_access_token(data={"sub": admin_user.username, "role": admin_user.role.value})
        payload = verify_token(token)
        
        assert payload["sub"] == admin_user.username
        assert payload["role"] == admin_user.role.value
    
    
    def test_verify_invalid_token(self):
        """Test verify_token with invalid token"""
        from auth import verify_token
        from fastapi import HTTPException
        
        with pytest.raises(HTTPException) as exc_info:
            verify_token("invalid_token")
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


class TestPasswordHashing:
    """Test password hashing functionality"""
    
    def test_password_hashing(self):
        """Test that passwords are properly hashed"""
        from auth import hash_password, verify_password
        
        password = "test_password"
        hashed = hash_password(password)
        
        # Hash should be different from original password
        assert hashed != password
        
        # Should be able to verify the password
        assert verify_password(password, hashed) is True
        
        # Wrong password should not verify
        assert verify_password("wrong_password", hashed) is False
    
    
    def test_hash_consistency(self):
        """Test that the same password produces different hashes (salt)"""
        from auth import hash_password
        
        password = "test_password"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        
        # Different hashes due to salt
        assert hash1 != hash2
    
    
    def test_empty_password(self):
        """Test hashing empty password"""
        from auth import hash_password, verify_password
        
        password = ""
        hashed = hash_password(password)
        
        assert verify_password("", hashed) is True
        assert verify_password("not_empty", hashed) is False