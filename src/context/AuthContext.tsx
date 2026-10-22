import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { UserService, initializeDatabase } from '../services/database';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
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
      const foundUser = UserService.getById(savedUserId);
      if (foundUser) setUser(foundUser);
    }
  }, []);

  const login = (email: string, _password: string): boolean => {
    const foundUser = UserService.authenticate(email, _password);
    if (foundUser) {
      setUser(foundUser);
      sessionStorage.setItem('dilg_current_user', foundUser.id);
      return true;
    }
    return false;
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
