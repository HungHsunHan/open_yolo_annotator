# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Development server**: `pnpm dev` - Start the Vite development server
- **Build production**: `pnpm build` - Build for production
- **Build development**: `pnpm build:dev` - Build in development mode
- **Lint**: `pnpm lint` - Run ESLint to check code quality
- **Preview**: `pnpm preview` - Preview production build locally

## Tech Stack & Architecture

This is a React TypeScript application for YOLO object detection annotation and management.

### Core Technologies
- **Frontend**: React 18 with TypeScript, Vite build tool
- **Routing**: React Router (routes defined in `src/App.tsx`)
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state, React hooks for local state
- **Authentication**: Azure MSAL (Microsoft Authentication Library)
- **Package Manager**: pnpm

### Project Structure
- **Pages**: Located in `src/pages/` - main application views
- **Components**: Located in `src/components/` with shadcn/ui components in `src/components/ui/`
- **Features**: Domain-specific code organized in `src/features/`:
  - `annotation/` - YOLO annotation editing and export functionality
  - `file/` - File upload and management
  - `project/` - Project creation and class management
- **Layout**: `MainLayout` component provides consistent sidebar/navigation structure

### Key Application Features
- **YOLO Project Management**: Create and manage object detection projects with custom class definitions
- **Image Annotation**: Visual annotation tool for creating bounding boxes on images
- **YOLO Format Support**: Parse and export annotations in YOLO format (normalized coordinates)
- **File Management**: Upload images and annotation files
- **Export Functionality**: Export annotations in various formats

### Important Files
- `src/lib/yolo-parser.ts` - Core YOLO format parsing and conversion utilities
- `src/features/project/types.ts` - Main type definitions for projects and classes
- `src/auth/AuthProvider.tsx` - Azure authentication setup

### Development Guidelines
- Always use TypeScript
- Use shadcn/ui components (already installed, don't reinstall)
- Follow existing patterns for feature organization
- Update `src/pages/Index.tsx` when adding new features to make them visible
- Use Tailwind CSS for all styling
- Icons come from lucide-react package