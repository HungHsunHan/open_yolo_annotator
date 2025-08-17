# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a YOLO Object Detection Annotation Tool - a full-stack web application for creating and managing YOLO object detection annotations. The application features role-based authentication, project management, collaborative annotation, and export capabilities.

**Architecture**: Monorepo with React TypeScript frontend and FastAPI Python backend

## Development Commands

### Frontend Development
```bash
# Start development server (port 8080 configured in vite.config.ts)
pnpm dev

# Build for production
pnpm build

# Build for development mode
pnpm build:dev

# Lint code
pnpm lint

# Preview production build
pnpm preview
```

### Testing
```bash
# Run Playwright E2E tests
pnpm test

# Run with UI mode
pnpm test:ui

# Run in headed mode
pnpm test:headed

# Debug mode
pnpm test:debug
```

### Backend Development
```bash
# Install Python dependencies
cd backend
pip install -r requirements.txt

# Run backend server
python start.py

# Run backend tests
pytest

# Run tests with coverage
pytest --cov=. --cov-report=html
```

### Docker Deployment
```bash
# Full stack deployment
docker-compose up -d

# Build and run specific services
docker-compose build backend
docker-compose up backend postgres
```

## Architecture & Code Structure

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript, Vite build tool
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: TanStack Query for server state, React hooks for local state
- **Authentication**: JWT tokens with role-based access control
- **Routing**: React Router (routes defined in App.tsx)

**Key Directories**:
- `src/pages/` - Application pages (AnnotationPage, ProjectPage, DashboardPage, etc.)
- `src/components/` - Reusable components (ui/ contains shadcn/ui components)
- `src/features/` - Feature-specific modules (annotation, project, file, collaboration)
- `src/auth/` - Authentication and role management
- `src/lib/` - Utilities (API client, YOLO parser, IndexedDB)
- `src/services/` - API services and database abstractions

**Important Patterns**:
- Feature-based architecture in `src/features/` with components, hooks, and types
- Custom hooks for data management (useProject, useFileManager, useCollaboration)
- API client (`src/lib/api.ts`) with JWT token management
- Role-based rendering using `useAuth` hook and `ProtectedRoute` component

### Backend (FastAPI + SQLAlchemy)
- **Framework**: FastAPI with Pydantic for request/response validation
- **Database**: SQLAlchemy ORM (supports PostgreSQL/SQLite)
- **Authentication**: JWT tokens with bcrypt password hashing
- **File Storage**: Local filesystem in `storage/` directory

**Key Files**:
- `main.py` - FastAPI application setup and route definitions
- `models.py` - SQLAlchemy database models (User, Project, Image, Annotation)
- `schemas.py` - Pydantic schemas for API request/response validation
- `auth.py` - JWT authentication and authorization logic
- `database.py` - Database connection and initialization
- `services/` - Business logic services (UserService, ProjectService, FileService)

**Database Models**:
- Users with roles (admin/annotator) and project assignments
- Projects with YOLO class definitions and user assignments
- Images with status tracking and file paths
- Annotations with YOLO bounding box data

### Key Integrations

**YOLO Format Support**:
- Parser in `src/lib/yolo-parser.ts` for reading/writing YOLO annotation files
- Export functionality in `src/features/annotation/components/ExportPanel.tsx`
- Backend annotation models store normalized coordinates and class indices

**Collaboration Features**:
- Simple coordination service in `src/features/collaboration/simpleCollaborationService.ts`
- Image status tracking (pending/in-progress/completed)
- User assignment to projects with role-based access

**File Management**:
- Image upload with validation and storage
- IndexedDB caching in `src/lib/indexedDb.ts` for offline capability
- File service in backend handles storage and retrieval

## Development Guidelines

### Frontend Development
- Always use shadcn/ui components from `src/components/ui/`
- Follow feature-based organization in `src/features/`
- Use custom hooks for data management and API calls
- Implement proper loading states and error handling with TanStack Query
- Add new routes to App.tsx and create corresponding pages in `src/pages/`

### Backend Development
- Use service layer pattern - business logic in `services/` directory
- Follow SQLAlchemy patterns established in `models.py`
- Use Pydantic schemas for all API endpoints
- Implement proper error handling and HTTP status codes
- Add tests in `tests/` directory following pytest conventions

### Database Operations
- Use Alembic migrations for schema changes (if configured)
- Follow foreign key relationships defined in models
- Implement proper data validation in both Pydantic schemas and SQLAlchemy models

### Testing
- Frontend: Playwright tests in `tests/` directory for E2E scenarios
- Backend: pytest tests in `backend/tests/` with comprehensive coverage
- Use pytest markers: `@pytest.mark.unit`, `@pytest.mark.integration`
- Run backend tests with coverage: `pytest --cov=. --cov-report=html`

### Authentication & Authorization
- JWT tokens stored in localStorage on frontend
- Role-based access: admins see all projects, annotators see assigned projects only
- Protect routes using `ProtectedRoute` component
- Use `useAuth` hook for user state and role checking

### File Handling
- Images stored in `backend/storage/images/{project_id}/`
- Annotations stored in `backend/storage/annotations/{project_id}/`
- Use FileService for all file operations
- Implement proper file validation and error handling

## Default Credentials (Development)
- **Admin**: username `tcci`, password `tcc1`
- **Annotator**: username `tcc`, password `tcc`

## Important Notes
- Frontend dev server runs on port 8080 (configured in vite.config.ts)
- Backend API runs on port 8000
- Database can be SQLite (development) or PostgreSQL (production)
- Use pnpm as package manager (configured in package.json)
- Follow TypeScript strict mode - all components should be properly typed

## Important Notes for Debug and Testing
- 進行pip install與執行後端程式請使用這個python路徑： /usr/local/Caskroom/miniforge/base/envs/llm/bin/python