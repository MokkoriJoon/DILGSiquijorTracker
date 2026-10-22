import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { initializeDatabase } from '../services/database';
import { AuthService } from '../services/auth';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Initialize database on first load
    initializeDatabase();
    
    // Check for existing session
    const savedUserId = sessionStorage.getItem('dilg_current_user');
    if (savedUserId) {
      const allUsers = AuthService.getAllUsers();
      const foundUser = allUsers.find(u => u.id === savedUserId);
      if (foundUser) setUser(foundUser);
    }
  }, []);

  const login = (email: string, password: string): { success: boolean; error?: string } => {
    const result = AuthService.login(email, password);
    if (result.success && result.user) {
      setUser(result.user);
      sessionStorage.setItem('dilg_current_user', result.user.id);
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('dilg_current_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
