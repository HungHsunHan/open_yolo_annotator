"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserRole = "admin" | "annotator";

export interface User {
  id: string;
  username: string;
  role: UserRole;
  password: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  users: User[];
  createUser: (username: string, password: string, role: UserRole) => Promise<boolean>;
  updateUser: (id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default users
const DEFAULT_USERS: User[] = [
  {
    id: "admin-1",
    username: "tcci",
    password: "tcc1",
    role: "admin" as UserRole,
    createdAt: new Date().toISOString(),
  },
  {
    id: "annotator-1", 
    username: "tcc",
    password: "tcc",
    role: "annotator" as UserRole,
    createdAt: new Date().toISOString(),
  },
];

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  // Check for existing session and users on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const savedUsers = localStorage.getItem("users");
    
    if (savedUsers) {
      try {
        setUsers(JSON.parse(savedUsers));
      } catch {
        setUsers(DEFAULT_USERS);
        localStorage.setItem("users", JSON.stringify(DEFAULT_USERS));
      }
    } else {
      setUsers(DEFAULT_USERS);
      localStorage.setItem("users", JSON.stringify(DEFAULT_USERS));
    }
    
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        // Remove password from stored user session for security
        const userWithoutPassword = {
          id: parsedUser.id,
          username: parsedUser.username,
          role: parsedUser.role,
          password: '', // Don't store password in session
          createdAt: parsedUser.createdAt,
        };
        setUser(userWithoutPassword);
      } catch {
        localStorage.removeItem("user");
      }
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    const foundUser = users.find(u => u.username === username && u.password === password);
    
    if (foundUser) {
      const userWithoutPassword = {
        id: foundUser.id,
        username: foundUser.username,
        role: foundUser.role,
        password: '', // Don't store password in session
        createdAt: foundUser.createdAt,
      };
      
      setUser(userWithoutPassword);
      localStorage.setItem("user", JSON.stringify(userWithoutPassword));
      return true;
    }
    
    return false;
  };

  const createUser = async (username: string, password: string, role: UserRole): Promise<boolean> => {
    if (!user || user.role !== "admin") {
      return false;
    }
    
    // Check if username already exists
    if (users.some(u => u.username === username)) {
      return false;
    }
    
    const newUser: User = {
      id: `${role}-${Date.now()}`,
      username,
      password,
      role,
      createdAt: new Date().toISOString(),
    };
    
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    localStorage.setItem("users", JSON.stringify(updatedUsers));
    return true;
  };

  const updateUser = async (id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<boolean> => {
    if (!user || user.role !== "admin") {
      return false;
    }
    
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return false;
    }
    
    // Prevent changing username if it already exists (unless it's the same user)
    if (updates.username && users.some(u => u.username === updates.username && u.id !== id)) {
      return false;
    }
    
    const updatedUsers = [...users];
    updatedUsers[userIndex] = { ...updatedUsers[userIndex], ...updates };
    setUsers(updatedUsers);
    localStorage.setItem("users", JSON.stringify(updatedUsers));
    return true;
  };

  const deleteUser = async (id: string): Promise<boolean> => {
    if (!user || user.role !== "admin") {
      return false;
    }
    
    // Prevent deleting yourself
    if (user.id === id) {
      return false;
    }
    
    const updatedUsers = users.filter(u => u.id !== id);
    setUsers(updatedUsers);
    localStorage.setItem("users", JSON.stringify(updatedUsers));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    users: users.map(u => ({ ...u, password: '' })), // Don't expose passwords
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