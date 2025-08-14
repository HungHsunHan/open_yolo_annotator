# YOLO Annotation API Backend

FastAPI backend server for the YOLO annotation application, designed for LAN deployment with multi-user collaboration.

## Quick Start

1. **Install Dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Set up Database**
   ```bash
   # For PostgreSQL (recommended for production)
   export DATABASE_URL="postgresql://user:password@localhost:5432/yolo_annotation"
   
   # For SQLite (development)
   export DATABASE_URL="sqlite:///./yolo_annotation.db"
   ```

3. **Start Server**
   ```bash
   python start.py
   ```

The server will start on `http://localhost:8000` with:
- **Default Admin**: username `tcci`, password `tcc1`
- **Default Annotator**: username `tcc`, password `tcc`

## API Documentation

Once running, visit `http://localhost:8000/docs` for interactive API documentation.

## Key Features

- **JWT Authentication** with role-based access (admin/annotator)
- **Project Management** with user assignment capabilities
- **Image Upload/Download** with LAN file storage
- **YOLO Annotation** parsing and export
- **Multi-user Coordination** with assignment tracking

## Architecture

- **Database**: PostgreSQL/SQLite for metadata storage
- **File Storage**: Local filesystem for images and annotations
- **Authentication**: JWT tokens with bcrypt password hashing
- **API**: RESTful endpoints matching frontend hook interfaces

## LAN Deployment

Use the provided `docker-compose.yml` for complete LAN deployment:
```bash
docker-compose up -d
```

This provides:
- Backend API server
- PostgreSQL database
- React frontend
- Nginx reverse proxy
- Persistent file storage