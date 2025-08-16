import pytest
from fastapi import status


class TestProjectCreation:
    """Test project creation functionality"""
    
    def test_create_project_success(self, client, auth_headers_admin):
        """Test successful project creation"""
        project_data = {
            "name": "New Test Project",
            "class_names": ["person", "car", "bike"],
            "class_definitions": [
                {"id": 0, "name": "person", "color": "#ff0000", "key": "1"},
                {"id": 1, "name": "car", "color": "#00ff00", "key": "2"},
                {"id": 2, "name": "bike", "color": "#0000ff", "key": "3"}
            ]
        }
        
        response = client.post("/projects", json=project_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["name"] == "New Test Project"
        assert data["class_names"] == ["person", "car", "bike"]
        assert len(data["class_definitions"]) == 3
        assert data["created_by"] == "admin-test-user-id"
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
        assert "directory_structure" in data
    
    
    def test_create_project_with_minimal_data(self, client, auth_headers_admin):
        """Test creating project with minimal required data"""
        project_data = {
            "name": "Minimal Project"
            # class_names and class_definitions will use defaults
        }
        
        response = client.post("/projects", json=project_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["name"] == "Minimal Project"
        assert data["class_names"] == ["object"]  # Default value
        assert isinstance(data["class_definitions"], list)
    
    
    def test_create_project_as_annotator(self, client, auth_headers_annotator):
        """Test that annotators can create projects"""
        project_data = {
            "name": "Annotator Project",
            "class_names": ["object"]
        }
        
        response = client.post("/projects", json=project_data, headers=auth_headers_annotator)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["name"] == "Annotator Project"
        assert data["created_by"] == "annotator-test-user-id"
    
    
    def test_create_project_without_auth(self, client):
        """Test creating project without authentication"""
        project_data = {
            "name": "Unauthorized Project"
        }
        
        response = client.post("/projects", json=project_data)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_create_project_missing_name(self, client, auth_headers_admin):
        """Test creating project without name"""
        project_data = {
            "class_names": ["object"]
        }
        
        response = client.post("/projects", json=project_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    
    def test_create_project_empty_name(self, client, auth_headers_admin):
        """Test creating project with empty name"""
        project_data = {
            "name": "",
            "class_names": ["object"]
        }
        
        response = client.post("/projects", json=project_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestProjectRetrieval:
    """Test project retrieval functionality"""
    
    def test_get_projects_as_admin(self, client, auth_headers_admin, test_project):
        """Test getting projects as admin (should see all projects)"""
        response = client.get("/projects", headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1  # At least the test project
        
        # Admin should see the test project
        project_ids = [p["id"] for p in data]
        assert test_project.id in project_ids
    
    
    def test_get_projects_as_annotator_no_assignments(self, client, auth_headers_annotator):
        """Test getting projects as annotator with no assignments"""
        response = client.get("/projects", headers=auth_headers_annotator)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Annotator should only see projects they're assigned to or created
        assert isinstance(data, list)
        # Should be empty or only contain projects they created
    
    
    def test_get_projects_as_annotator_with_assignments(self, client, auth_headers_annotator, assigned_project):
        """Test getting projects as annotator with assignments"""
        response = client.get("/projects", headers=auth_headers_annotator)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Should see the assigned project
        project_ids = [p["id"] for p in data]
        assert assigned_project.id in project_ids
    
    
    def test_get_specific_project_as_admin(self, client, auth_headers_admin, test_project):
        """Test getting specific project as admin"""
        response = client.get(f"/projects/{test_project.id}", headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["id"] == test_project.id
        assert data["name"] == test_project.name
        assert "assigned_users" in data
    
    
    def test_get_specific_project_as_assigned_annotator(self, client, auth_headers_annotator, assigned_project):
        """Test getting specific project as assigned annotator"""
        response = client.get(f"/projects/{assigned_project.id}", headers=auth_headers_annotator)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["id"] == assigned_project.id
    
    
    def test_get_specific_project_as_unassigned_annotator(self, client, auth_headers_annotator, test_project):
        """Test getting specific project as unassigned annotator"""
        response = client.get(f"/projects/{test_project.id}", headers=auth_headers_annotator)
        
        # Should be forbidden since annotator is not assigned to this project
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_get_nonexistent_project(self, client, auth_headers_admin):
        """Test getting non-existent project"""
        response = client.get("/projects/nonexistent-project-id", headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    
    def test_get_projects_without_auth(self, client):
        """Test getting projects without authentication"""
        response = client.get("/projects")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestProjectAssignment:
    """Test project assignment functionality"""
    
    def test_assign_user_to_project_success(self, client, auth_headers_admin, test_project, annotator_user):
        """Test successful user assignment to project"""
        response = client.post(
            f"/projects/{test_project.id}/assign/{annotator_user.id}",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["project_id"] == test_project.id
        assert data["user_id"] == annotator_user.id
        assert data["assigned"] is True
    
    
    def test_assign_user_to_project_as_annotator_forbidden(self, client, auth_headers_annotator, test_project, admin_user):
        """Test that annotators cannot assign users to projects"""
        response = client.post(
            f"/projects/{test_project.id}/assign/{admin_user.id}",
            headers=auth_headers_annotator
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        data = response.json()
        assert data["detail"] == "Admin access required"
    
    
    def test_assign_nonexistent_user_to_project(self, client, auth_headers_admin, test_project):
        """Test assigning non-existent user to project"""
        response = client.post(
            f"/projects/{test_project.id}/assign/nonexistent-user-id",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    
    def test_assign_user_to_nonexistent_project(self, client, auth_headers_admin, annotator_user):
        """Test assigning user to non-existent project"""
        response = client.post(
            f"/projects/nonexistent-project-id/assign/{annotator_user.id}",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    
    def test_assign_user_already_assigned(self, client, auth_headers_admin, assigned_project, annotator_user):
        """Test assigning user who is already assigned to project"""
        response = client.post(
            f"/projects/{assigned_project.id}/assign/{annotator_user.id}",
            headers=auth_headers_admin
        )
        
        # Should still succeed (idempotent operation)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["assigned"] is True
    
    
    def test_assign_user_without_auth(self, client, test_project, annotator_user):
        """Test assigning user without authentication"""
        response = client.post(f"/projects/{test_project.id}/assign/{annotator_user.id}")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_unassign_user_from_project_success(self, client, auth_headers_admin, assigned_project, annotator_user):
        """Test successful user unassignment from project"""
        response = client.delete(
            f"/projects/{assigned_project.id}/assign/{annotator_user.id}",
            headers=auth_headers_admin
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["project_id"] == assigned_project.id
        assert data["user_id"] == annotator_user.id
        assert data["assigned"] is False
    
    
    def test_unassign_user_not_assigned(self, client, auth_headers_admin, test_project, annotator_user):
        """Test unassigning user who is not assigned to project"""
        response = client.delete(
            f"/projects/{test_project.id}/assign/{annotator_user.id}",
            headers=auth_headers_admin
        )
        
        # Should still succeed (idempotent operation)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["assigned"] is False
    
    
    def test_unassign_user_as_annotator_forbidden(self, client, auth_headers_annotator, assigned_project, admin_user):
        """Test that annotators cannot unassign users from projects"""
        response = client.delete(
            f"/projects/{assigned_project.id}/assign/{admin_user.id}",
            headers=auth_headers_annotator
        )
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_verify_assignment_in_project_response(self, client, auth_headers_admin, test_project, annotator_user):
        """Test that project response includes assigned users"""
        # First assign user to project
        assign_response = client.post(
            f"/projects/{test_project.id}/assign/{annotator_user.id}",
            headers=auth_headers_admin
        )
        assert assign_response.status_code == status.HTTP_200_OK
        
        # Get project and verify assignment is reflected
        project_response = client.get(f"/projects/{test_project.id}", headers=auth_headers_admin)
        assert project_response.status_code == status.HTTP_200_OK
        
        project_data = project_response.json()
        assert annotator_user.id in project_data["assigned_users"]


class TestProjectUpdate:
    """Test project update functionality"""
    
    def test_update_project_name(self, client, auth_headers_admin, test_project):
        """Test updating project name"""
        update_data = {
            "name": "Updated Project Name"
        }
        
        response = client.patch(f"/projects/{test_project.id}", json=update_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["name"] == "Updated Project Name"
        assert data["id"] == test_project.id
    
    
    def test_update_project_class_names(self, client, auth_headers_admin, test_project):
        """Test updating project class names"""
        update_data = {
            "class_names": ["new_class1", "new_class2", "new_class3"]
        }
        
        response = client.patch(f"/projects/{test_project.id}", json=update_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert data["class_names"] == ["new_class1", "new_class2", "new_class3"]
    
    
    def test_update_project_class_definitions(self, client, auth_headers_admin, test_project):
        """Test updating project class definitions"""
        update_data = {
            "class_definitions": [
                {"id": 0, "name": "updated_class", "color": "#ffff00", "key": "u"}
            ]
        }
        
        response = client.patch(f"/projects/{test_project.id}", json=update_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert len(data["class_definitions"]) == 1
        assert data["class_definitions"][0]["name"] == "updated_class"
        assert data["class_definitions"][0]["color"] == "#ffff00"
    
    
    def test_update_project_as_creator_annotator(self, client, auth_headers_annotator, annotator_user, test_db_session):
        """Test that project creator can update their own project"""
        from models import Project
        
        # Create project owned by annotator
        annotator_project = Project(
            id="annotator-owned-project",
            name="Annotator Project",
            created_by=annotator_user.id,
            class_names=["object"],
            class_definitions=[],
            directory_structure={}
        )
        
        test_db_session.add(annotator_project)
        test_db_session.commit()
        
        update_data = {
            "name": "Updated by Creator"
        }
        
        response = client.patch(f"/projects/{annotator_project.id}", json=update_data, headers=auth_headers_annotator)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated by Creator"
    
    
    def test_update_project_as_non_creator_annotator(self, client, auth_headers_annotator, test_project):
        """Test that non-creator annotators cannot update projects"""
        update_data = {
            "name": "Unauthorized Update"
        }
        
        response = client.patch(f"/projects/{test_project.id}", json=update_data, headers=auth_headers_annotator)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_update_nonexistent_project(self, client, auth_headers_admin):
        """Test updating non-existent project"""
        update_data = {
            "name": "Non-existent Project"
        }
        
        response = client.patch("/projects/nonexistent-project-id", json=update_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    
    def test_update_project_without_auth(self, client, test_project):
        """Test updating project without authentication"""
        update_data = {
            "name": "Unauthorized Update"
        }
        
        response = client.patch(f"/projects/{test_project.id}", json=update_data)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestProjectDeletion:
    """Test project deletion functionality"""
    
    def test_delete_project_as_admin(self, client, auth_headers_admin, test_project):
        """Test deleting project as admin"""
        response = client.delete(f"/projects/{test_project.id}", headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert "deleted successfully" in data["message"]
        
        # Verify project is actually deleted
        get_response = client.get(f"/projects/{test_project.id}", headers=auth_headers_admin)
        assert get_response.status_code == status.HTTP_404_NOT_FOUND
    
    
    def test_delete_project_as_creator_annotator(self, client, auth_headers_annotator, annotator_user, test_db_session):
        """Test that project creator can delete their own project"""
        from models import Project
        
        # Create project owned by annotator
        annotator_project = Project(
            id="annotator-deletable-project",
            name="Deletable Project",
            created_by=annotator_user.id,
            class_names=["object"],
            class_definitions=[],
            directory_structure={}
        )
        
        test_db_session.add(annotator_project)
        test_db_session.commit()
        
        response = client.delete(f"/projects/{annotator_project.id}", headers=auth_headers_annotator)
        
        assert response.status_code == status.HTTP_200_OK
    
    
    def test_delete_project_as_non_creator_annotator(self, client, auth_headers_annotator, test_project):
        """Test that non-creator annotators cannot delete projects"""
        response = client.delete(f"/projects/{test_project.id}", headers=auth_headers_annotator)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    
    def test_delete_nonexistent_project(self, client, auth_headers_admin):
        """Test deleting non-existent project"""
        response = client.delete("/projects/nonexistent-project-id", headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    
    def test_delete_project_without_auth(self, client, test_project):
        """Test deleting project without authentication"""
        response = client.delete(f"/projects/{test_project.id}")
        
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestProjectAccessControl:
    """Test project access control and permissions"""
    
    def test_annotator_cannot_see_unassigned_projects(self, client, auth_headers_annotator, test_project):
        """Test that annotators cannot see projects they're not assigned to"""
        # Get all projects
        response = client.get("/projects", headers=auth_headers_annotator)
        assert response.status_code == status.HTTP_200_OK
        
        projects = response.json()
        project_ids = [p["id"] for p in projects]
        
        # Should not see the unassigned test project
        assert test_project.id not in project_ids
    
    
    def test_annotator_can_see_assigned_projects(self, client, auth_headers_annotator, assigned_project):
        """Test that annotators can see projects they're assigned to"""
        response = client.get("/projects", headers=auth_headers_annotator)
        assert response.status_code == status.HTTP_200_OK
        
        projects = response.json()
        project_ids = [p["id"] for p in projects]
        
        # Should see the assigned project
        assert assigned_project.id in project_ids
    
    
    def test_annotator_can_see_own_projects(self, client, auth_headers_annotator, annotator_user, test_db_session):
        """Test that annotators can see projects they created"""
        from models import Project
        
        # Create project owned by annotator
        own_project = Project(
            id="own-project-id",
            name="Own Project",
            created_by=annotator_user.id,
            class_names=["object"],
            class_definitions=[],
            directory_structure={}
        )
        
        test_db_session.add(own_project)
        test_db_session.commit()
        
        response = client.get("/projects", headers=auth_headers_annotator)
        assert response.status_code == status.HTTP_200_OK
        
        projects = response.json()
        project_ids = [p["id"] for p in projects]
        
        # Should see their own project
        assert own_project.id in project_ids
    
    
    def test_admin_can_see_all_projects(self, client, auth_headers_admin, test_project, assigned_project):
        """Test that admins can see all projects"""
        response = client.get("/projects", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        
        projects = response.json()
        project_ids = [p["id"] for p in projects]
        
        # Admin should see all projects
        assert test_project.id in project_ids
        assert assigned_project.id in project_ids


class TestProjectDirectoryStructure:
    """Test project directory structure creation"""
    
    def test_project_directory_structure_creation(self, client, auth_headers_admin):
        """Test that project creation includes proper directory structure"""
        project_data = {
            "name": "Directory Test Project",
            "class_names": ["object"]
        }
        
        response = client.post("/projects", json=project_data, headers=auth_headers_admin)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert "directory_structure" in data
        directory_structure = data["directory_structure"]
        
        # Check that directory structure is properly formed
        assert "images" in directory_structure
        assert "labels" in directory_structure
        assert "classes" in directory_structure
        
        # Check that paths include project ID
        project_id = data["id"]
        assert project_id in directory_structure["images"]
        assert project_id in directory_structure["labels"]