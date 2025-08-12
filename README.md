# YOLO Object Detection Annotator

A modern web application for creating and managing YOLO object detection annotations. Built with React, TypeScript, and Azure authentication for seamless image annotation workflows.

![React](https://img.shields.io/badge/React-18.3.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-blue)
![Vite](https://img.shields.io/badge/Vite-6.3.4-green)
![License](https://img.shields.io/badge/License-Private-red)

## ✨ Features

- **🎯 YOLO Annotation Tool**: Visual annotation interface for creating bounding boxes on images
- **📁 Project Management**: Create and manage object detection projects with custom class definitions
- **📤 Multiple Export Formats**: Export annotations in YOLO format and other standard formats
- **📂 File Management**: Upload and organize images and annotation files
- **🔐 Azure Authentication**: Secure login with Microsoft Azure MSAL
- **👥 User Management**: Admin controls for creating and managing annotator accounts
- **🛡️ Role-Based Access Control**: Admin and annotator roles with permission-based features
- **🎯 Project Assignment**: Assign specific annotators to projects for controlled access
- **🎨 Modern UI**: Built with shadcn/ui components and Tailwind CSS
- **📱 Responsive Design**: Works seamlessly across desktop and mobile devices

## 🛠️ Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Authentication**: Azure MSAL (Microsoft Authentication Library)
- **State Management**: TanStack Query + React hooks
- **Routing**: React Router
- **Package Manager**: pnpm

## 🚀 Quick Start

### Prerequisites

- Node.js (version 18 or higher)
- pnpm package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/HungHsunHan/open_yolo_annotator.git
cd open_yolo_annotator
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your Azure configuration
```

4. Start the development server:
```bash
pnpm dev
```

The application will be available at `http://localhost:5173`

## 📜 Available Scripts

- `pnpm dev` - Start the development server
- `pnpm build` - Build for production
- `pnpm build:dev` - Build in development mode
- `pnpm lint` - Run ESLint code quality checks
- `pnpm preview` - Preview production build locally

## 📁 Project Structure

```
src/
├── auth/                 # Azure authentication setup
├── components/           # Reusable UI components
│   └── ui/              # shadcn/ui components
├── features/            # Feature-specific modules
│   ├── annotation/      # YOLO annotation functionality
│   ├── file/           # File upload and management
│   └── project/        # Project and class management
├── auth/               # Authentication and role management
├── lib/                # Utility libraries
│   └── yolo-parser.ts  # YOLO format parsing utilities
└── pages/              # Application pages
    ├── AnnotationPage.tsx
    ├── DashboardPage.tsx
    ├── ImagesPage.tsx
    ├── ProjectPage.tsx
    ├── UserManagementPage.tsx
    ├── SettingsPage.tsx
    └── ...
```

## 🎯 Usage

### Creating a New Project

1. Navigate to the Dashboard
2. Click "Create New Project"
3. Define your object detection classes
4. Upload images for annotation

### Annotating Images

1. Select a project and navigate to the Annotation page
2. Use the visual editor to draw bounding boxes around objects
3. Assign classes to each bounding box
4. Save annotations in YOLO format

### Exporting Annotations

1. Go to the Export panel
2. Choose your desired export format
3. Download the complete annotation dataset

### Admin Features

#### User Management (Admin Only)
1. Navigate to User Management from the sidebar
2. Create new annotator accounts with username and password
3. Assign roles (Admin or Annotator) to users
4. Edit existing user details and roles
5. Delete user accounts (except your own)

#### Project Assignment (Admin Only)
1. Open any project settings
2. Use the Project Assignments panel to:
   - Assign specific annotators to projects
   - Remove annotator access from projects
   - View all users assigned to a project
   - See project creators (cannot be removed)

## 🔧 Configuration

### Azure Authentication

Set up your Azure App Registration and configure the following environment variables:

```env
VITE_AZURE_CLIENT_ID=your_client_id
VITE_AZURE_TENANT_ID=your_tenant_id
VITE_AZURE_REDIRECT_URI=http://localhost:5173
```

### User Roles & Permissions

The application supports two user roles:

- **Admin**: Full access to all features including:
  - User management (create, edit, delete users)
  - Project assignment (assign annotators to specific projects)
  - All standard annotation features
  
- **Annotator**: Limited access to assigned projects:
  - Can only view and annotate projects they're assigned to
  - Cannot manage users or assign projects
  - Full annotation capabilities within their assigned projects

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is private and proprietary. All rights reserved.

## 🐛 Issues & Support

If you encounter any issues or have questions, please [open an issue](https://github.com/HungHsunHan/open_yolo_annotator/issues) on GitHub.

## 🔗 Related

- [YOLO Documentation](https://docs.ultralytics.com/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Azure MSAL Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-overview)
