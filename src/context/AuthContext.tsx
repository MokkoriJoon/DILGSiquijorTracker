import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthService } from '../services/auth';
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
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  // Session timeout durations (in milliseconds)
  const SESSION_TIMEOUT = {
    SUPER_ADMIN: 10 * 60 * 1000, // 10 minutes
    ADMIN: 5 * 60 * 1000,        // 5 minutes
    STANDARD: 3 * 60 * 1000,     // 3 minutes
  };

  // Check for existing Supabase session on mount
  useEffect(() => {
    checkUser();
  }, []);

  // Session timeout checker
  useEffect(() => {
    if (!user) return;

    const timeoutDuration = SESSION_TIMEOUT[user.role as keyof typeof SESSION_TIMEOUT] || SESSION_TIMEOUT.STANDARD;

    const checkTimeout = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;

      if (timeSinceLastActivity >= timeoutDuration) {
        console.log(`[Session] Timeout reached for ${user.role}. Logging out...`);
        logout();
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkTimeout, 30000);

    return () => clearInterval(interval);
  }, [user, lastActivity]);

  // Track user activity
  useEffect(() => {
    if (!user) return;

    const updateActivity = () => {
      setLastActivity(Date.now());
    };

    // Listen for user interactions
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, updateActivity));

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
    };
  }, [user]);

  async function checkUser() {
    try {
      const currentUser = await AuthService.getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        setLastActivity(Date.now());
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const result = await AuthService.login(email, password);
    if (result.success && result.user) {
      setUser(result.user);
      setLastActivity(Date.now());
    }
    return { success: result.success, error: result.error };
  }

  async function register(
    email: string,
    password: string,
    fullName: string,
    department: string
  ) {
    const result = await AuthService.register(email, password, fullName, department);
    if (result.success && result.user) {
      setUser(result.user);
      setLastActivity(Date.now());
    }
    return { 
      success: result.success, 
      error: result.error,
      isFirstAdmin: result.isFirstAdmin 
    };
  }

  async function logout() {
    await AuthService.logout();
    setUser(null);
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
