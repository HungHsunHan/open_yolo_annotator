"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiClient } from "@/lib/api";

export type UserRole = "admin" | "annotator";

export interface User {
  id: string;
  username: string;
  role: UserRole;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  users: User[];
  createUser: (username: string, password: string, role: UserRole) => Promise<boolean>;
  updateUser: (id: string, updates: Partial<Omit<User, 'id' | 'created_at'>>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load users and check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if we have a token and try to validate it by fetching user data
        const savedToken = localStorage.getItem('auth_token');
        if (savedToken) {
          try {
            // Try to fetch user data to validate token
            apiClient.setToken(savedToken);
            const userData = await apiClient.getCurrentUser();
            setUser(userData);
          } catch (error) {
            // Token is invalid, clear it
            console.log('Invalid token, clearing auth state');
            apiClient.setToken(null);
            localStorage.removeItem('user');
          }
        }

        // Load users list if authenticated as admin
        if (user?.role === 'admin') {
          try {
            const usersData = await apiClient.getUsers();
            setUsers(usersData);
          } catch (error) {
            console.error('Failed to load users:', error);
            setUsers([]);
          }
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await apiClient.login(username, password);
      setUser(response.user);
      localStorage.setItem("user", JSON.stringify(response.user));
      
      // Load users list if admin
      if (response.user.role === 'admin') {
        try {
          const usersData = await apiClient.getUsers();
          setUsers(usersData);
        } catch (error) {
          console.error('Failed to load users after login:', error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const createUser = async (username: string, password: string, role: UserRole): Promise<boolean> => {
    if (!user || user.role !== "admin") {
      return false;
    }
    
    try {
      const newUser = await apiClient.register(username, password, role);
      const updatedUsers = [...users, newUser];
      setUsers(updatedUsers);
      return true;
    } catch (error) {
      console.error('Failed to create user:', error);
      return false;
    }
  };

  const updateUser = async (id: string, updates: Partial<Omit<User, 'id' | 'created_at'>>): Promise<boolean> => {
    if (!user || user.role !== "admin") {
      return false;
    }
    
    try {
      const updatedUser = await apiClient.updateUser(id, updates);
      const updatedUsers = users.map(u => u.id === id ? updatedUser : u);
      setUsers(updatedUsers);
      return true;
    } catch (error) {
      console.error('Failed to update user:', error);
      return false;
    }
  };

  const deleteUser = async (id: string): Promise<boolean> => {
    if (!user || user.role !== "admin") {
      return false;
    }
    
    // Prevent deleting yourself
    if (user.id === id) {
      return false;
    }
    
    try {
      await apiClient.deleteUser(id);
      const updatedUsers = users.filter(u => u.id !== id);
      setUsers(updatedUsers);
      return true;
    } catch (error) {
      console.error('Failed to delete user:', error);
      return false;
    }
  };

  const logout = () => {
    // Clear user session from collaboration system before logout
    if (user) {
      try {
        // Clear all collaboration sessions for this user across all projects
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('collaboration-')) {
            try {
              const collaborationData = JSON.parse(localStorage.getItem(key) || '{}');
              if (collaborationData.activeSessions) {
                // Remove all sessions for the current user
                const cleanedSessions: any = {};
                Object.entries(collaborationData.activeSessions).forEach(([sessionId, session]: [string, any]) => {
                  if (session.username !== user.username) {
                    cleanedSessions[sessionId] = session;
                  }
                });
                
                // Release all assignments for this user
                const cleanedAssignments: any = {};
                Object.entries(collaborationData.assignments || {}).forEach(([imageId, assignment]: [string, any]) => {
                  if (assignment.assignedTo === user.username) {
                    // Release assignment
                    cleanedAssignments[imageId] = {
                      ...assignment,
                      status: 'available',
                      assignedTo: '',
                      lastActivity: new Date().toISOString()
                    };
                  } else {
                    cleanedAssignments[imageId] = assignment;
                  }
                });
                
                // Update localStorage with cleaned data
                const updatedData = {
                  ...collaborationData,
                  activeSessions: cleanedSessions,
                  assignments: cleanedAssignments,
                  lastSync: new Date().toISOString()
                };
                localStorage.setItem(key, JSON.stringify(updatedData));
              }
            } catch (error) {
              console.error('Failed to clean collaboration data for key:', key, error);
            }
          }
        });
      } catch (error) {
        console.error('Failed to clean collaboration sessions during logout:', error);
      }
    }
    
    setUser(null);
    apiClient.setToken(null);
    localStorage.removeItem("user");
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isLoading,
    users, // Users from API don't contain passwords
    createUser,
    updateUser,
    deleteUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};