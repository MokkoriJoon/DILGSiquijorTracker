import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthService } from '../services/auth';
import { UserService, initializeDatabase } from '../services/database';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    fullName: string,
    department: string
  ) => Promise<{ success: boolean; error?: string; isFirstAdmin?: boolean }>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize database and check for existing session on mount
  useEffect(() => {
    initializeDatabase();
    checkUser();
  }, []);

  function checkUser() {
    try {
      // Check sessionStorage for current user
      const savedUserId = sessionStorage.getItem('dilg_current_user');
      if (savedUserId) {
        const foundUser = UserService.getById(savedUserId);
        if (foundUser) {
          setUser(foundUser);
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const result = AuthService.login(email, password);
    if (result.success && result.user) {
      setUser(result.user);
      sessionStorage.setItem('dilg_current_user', result.user.id);
    }
    return { success: result.success, error: result.error };
  }

  async function register(
    email: string,
    password: string,
    fullName: string,
    department: string
  ) {
    // Check if this is the first user (will become ADMIN)
    const isFirstUser = UserService.getAll().length === 0;
    const role = isFirstUser ? 'ADMIN' : 'STANDARD';

    const result = AuthService.register({
      name: fullName,
      email,
      password,
      department,
      role,
    });

    if (result.success && result.user) {
      setUser(result.user);
      sessionStorage.setItem('dilg_current_user', result.user.id);
    }
    return { success: result.success, error: result.error, isFirstAdmin: isFirstUser };
  }

  async function logout() {
    setUser(null);
    sessionStorage.removeItem('dilg_current_user');
  }

  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAdmin,
      }}
    >
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
