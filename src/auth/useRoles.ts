import { useAuth } from "./AuthProvider";

export const useRoles = () => {
  const { user, isAuthenticated, isAdmin } = useAuth();

  const canCreateProject = isAdmin;
  const canDeleteProject = isAdmin;
  const canDeleteImages = isAdmin;
  const canAnnotate = isAuthenticated;
  const canViewProjects = isAuthenticated;
  const canExportAnnotations = isAuthenticated;

  return {
    user,
    isAuthenticated,
    isAdmin,
    canCreateProject,
    canDeleteProject,
    canDeleteImages,
    canAnnotate,
    canViewProjects,
    canExportAnnotations,
  };
};