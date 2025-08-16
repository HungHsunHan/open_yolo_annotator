import pytest
import tempfile
import shutil
from pathlib import Path
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
import os
import sys

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from main import app
from database import get_db, Base
from models import User, Project, Image, Annotation, UserRole, ImageStatus, project_assignments
from auth import hash_password, create_access_token
from services.file_service import FileService
from services.project_service import ProjectService
from services.user_service import UserService


@pytest.fixture(scope="function")
def test_db_engine():
    """Create a test database engine using SQLite in memory"""
    engine = create_engine(
        "sqlite:///:memory:", 
        echo=False,
        poolclass=StaticPool,
        connect_args={
            "check_same_thread": False,
        },
    )
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture(scope="function")
def test_db_session(test_db_engine):
    """Create a test database session"""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_db_engine)
    session = TestingSessionLocal()
    
    # Clean all tables before each test
    session.query(Annotation).delete()
    session.query(Image).delete()
    session.execute(project_assignments.delete())
    session.query(Project).delete()
    session.query(User).delete()
    session.commit()
    
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def temp_storage_dir():
    """Create a temporary storage directory for file operations"""
    temp_dir = Path(tempfile.mkdtemp())
    (temp_dir / "images").mkdir(exist_ok=True)
    (temp_dir / "annotations").mkdir(exist_ok=True)
    
    try:
        yield temp_dir
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture(scope="function")
def client(test_db_session, temp_storage_dir):
    """Create a test client with dependency overrides"""
    
    # Override database dependency
    def override_get_db():
        try:
            yield test_db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    # Override file service storage directory
    import main
    original_file_service = main.file_service
    original_project_service = main.project_service
    
    # Create new services with temp storage
    main.file_service = FileService(temp_storage_dir)
    main.project_service = ProjectService(temp_storage_dir)
    
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        # Restore original dependencies and services
        app.dependency_overrides.clear()
        main.file_service = original_file_service
        main.project_service = original_project_service


@pytest.fixture
def admin_user(test_db_session):
    """Create a test admin user"""
    user = User(
        id="admin-test-user-id",
        username="admin_test",
        password_hash=hash_password("admin_password"),
        role=UserRole.ADMIN
    )
    test_db_session.add(user)
    test_db_session.commit()
    test_db_session.refresh(user)
    return user


@pytest.fixture
def annotator_user(test_db_session):
    """Create a test annotator user"""
    user = User(
        id="annotator-test-user-id",
        username="annotator_test",
        password_hash=hash_password("annotator_password"),
        role=UserRole.ANNOTATOR
    )
    test_db_session.add(user)
    test_db_session.commit()
    test_db_session.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user):
    """Create a JWT token for admin user"""
    return create_access_token(data={"sub": admin_user.username, "role": admin_user.role.value})


@pytest.fixture
def annotator_token(annotator_user):
    """Create a JWT token for annotator user"""
    return create_access_token(data={"sub": annotator_user.username, "role": annotator_user.role.value})


@pytest.fixture
def auth_headers_admin(admin_token):
    """Create authorization headers for admin user"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def auth_headers_annotator(annotator_token):
    """Create authorization headers for annotator user"""
    return {"Authorization": f"Bearer {annotator_token}"}


@pytest.fixture
def test_project(test_db_session, admin_user):
    """Create a test project"""
    project = Project(
        id="test-project-id",
        name="Test Project",
        created_by=admin_user.id,
        class_names=["person", "car", "bike"],
        class_definitions=[
            {"id": 0, "name": "person", "color": "#ff0000", "key": "1"},
            {"id": 1, "name": "car", "color": "#00ff00", "key": "2"},
            {"id": 2, "name": "bike", "color": "#0000ff", "key": "3"}
        ],
        directory_structure={
            "images": "storage/images/test-project-id",
            "labels": "storage/annotations/test-project-id",
            "classes": "classes.txt"
        }
    )
    test_db_session.add(project)
    test_db_session.commit()
    test_db_session.refresh(project)
    return project


@pytest.fixture
def test_image(test_db_session, test_project, admin_user, temp_storage_dir):
    """Create a test image with file"""
    # Create project directory
    project_dir = temp_storage_dir / "images" / test_project.id
    project_dir.mkdir(parents=True, exist_ok=True)
    
    # Create a simple test image file
    image_path = project_dir / "test-image.jpg"
    
    # Create a minimal JPEG file (just a header for testing)
    jpeg_header = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1f\x1e\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x01\x01\x11\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00\x3f\x00\x00\xff\xd9'
    
    with open(image_path, 'wb') as f:
        f.write(jpeg_header)
    
    image = Image(
        id="test-image-id",
        project_id=test_project.id,
        name="test-image.jpg",
        file_path=f"storage/images/{test_project.id}/test-image.jpg",
        size=len(jpeg_header),
        type="image/jpeg",
        uploaded_by=admin_user.id,
        status=ImageStatus.PENDING,
        width=100,
        height=100
    )
    test_db_session.add(image)
    test_db_session.commit()
    test_db_session.refresh(image)
    return image


@pytest.fixture
def test_annotations(test_db_session, test_image, admin_user):
    """Create test annotations for the test image"""
    annotations = [
        Annotation(
            id="annotation-1",
            image_id=test_image.id,
            class_id=0,
            class_name="person",
            color="#ff0000",
            x=10.0,
            y=20.0,
            width=30.0,
            height=40.0,
            created_by=admin_user.id
        ),
        Annotation(
            id="annotation-2",
            image_id=test_image.id,
            class_id=1,
            class_name="car",
            color="#00ff00",
            x=50.0,
            y=60.0,
            width=25.0,
            height=35.0,
            created_by=admin_user.id
        )
    ]
    
    for annotation in annotations:
        test_db_session.add(annotation)
    
    test_db_session.commit()
    
    for annotation in annotations:
        test_db_session.refresh(annotation)
    
    return annotations


@pytest.fixture
def sample_image_file():
    """Create a sample image file for upload testing"""
    # Create a minimal valid JPEG file
    jpeg_data = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1f\x1e\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x11\x08\x00d\x00d\x01\x01\x11\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00\x3f\x00\x00\xff\xd9'
    return jpeg_data


@pytest.fixture
def assigned_project(test_db_session, test_project, annotator_user):
    """Create a project assignment for the annotator user"""
    # Insert assignment using raw SQL since it's a many-to-many relationship
    test_db_session.execute(
        project_assignments.insert().values(
            project_id=test_project.id,
            user_id=annotator_user.id
        )
    )
    test_db_session.commit()
    return test_project