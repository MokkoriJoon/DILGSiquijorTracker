/**
 * Authentication Service
 * 
 * Handles user registration, login, and session management.
 * Uses localStorage for demo mode, designed to swap to Supabase Auth in production.
 */

import { User, Role } from '../types';
import { UserService } from './database';

// Simple hash function for demo (use bcrypt in production!)
function hashPassword(password: string): string {
  // This is NOT secure for production - just for demo
  // In production, use bcrypt via Supabase Auth
  return btoa(password + '_dilg_salt_2024');
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  department: string;
  role: Role;
}

export interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
}

export interface RegisterResult {
  success: boolean;
  user?: User;
  error?: string;
  isFirstAdmin?: boolean;
}

export const AuthService = {
  /**
   * Register a new user
   * First user to register automatically becomes ADMIN
   */
  register(data: RegisterData): RegisterResult {
    // Validate input
    if (!data.name.trim()) {
      return { success: false, error: 'Name is required' };
    }
    if (!data.email.trim()) {
      return { success: false, error: 'Email is required' };
    }
    if (!this.isValidEmail(data.email)) {
      return { success: false, error: 'Invalid email format' };
    }
    if (!data.password || data.password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }
    if (!data.department) {
      return { success: false, error: 'Department is required' };
    }

    // Check if email already exists
    const existingUser = UserService.getByEmail(data.email);
    if (existingUser) {
      return { success: false, error: 'An account with this email already exists' };
    }

    // First user automatically becomes ADMIN
    const isFirstUser = UserService.getAll().length === 0;
    const assignedRole = isFirstUser ? 'ADMIN' : data.role;

    // Create user with hashed password
    const hashedPassword = hashPassword(data.password);
    
    // Store password hash in a separate storage (simulating database)
    const passwordStore = JSON.parse(localStorage.getItem('dilg_passwords') || '{}');
    passwordStore[data.email] = hashedPassword;
    localStorage.setItem('dilg_passwords', JSON.stringify(passwordStore));

    // Create user in database
    const newUser = UserService.create({
      name: data.name,
      email: data.email,
      role: assignedRole,
      department: data.department,
    });

    return { success: true, user: newUser, isFirstAdmin: isFirstUser };
  },

  /**
   * Authenticate user with email and password
   */
  login(email: string, password: string): LoginResult {
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' };
    }

    // Find user by email
    const user = UserService.getByEmail(email);
    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Verify password
    const passwordStore = JSON.parse(localStorage.getItem('dilg_passwords') || '{}');
    const storedHash = passwordStore[email];

    // If no stored hash (legacy demo user), accept any password for backward compatibility
    if (!storedHash) {
      // Check if this is a seeded demo user
      const demoEmails = ['admin@dilg.gov.ph', 'juan.cruz@dilg.gov.ph', 'ana.reyes@dilg.gov.ph', 
                          'pedro.garcia@dilg.gov.ph', 'lisa.mendoza@dilg.gov.ph', 'carlos.ramos@dilg.gov.ph'];
      if (demoEmails.includes(email)) {
        return { success: true, user };
      }
      return { success: false, error: 'Invalid email or password' };
    }

    if (!verifyPassword(password, storedHash)) {
      return { success: false, error: 'Invalid email or password' };
    }

    return { success: true, user };
  },

  /**
   * Change user password
   */
  changePassword(email: string, oldPassword: string, newPassword: string): { success: boolean; error?: string } {
    const user = UserService.getByEmail(email);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Verify old password
    const passwordStore = JSON.parse(localStorage.getItem('dilg_passwords') || '{}');
    const storedHash = passwordStore[email];

    if (storedHash && !verifyPassword(oldPassword, storedHash)) {
      return { success: false, error: 'Current password is incorrect' };
    }

    if (newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters' };
    }

    // Update password
    passwordStore[email] = hashPassword(newPassword);
    localStorage.setItem('dilg_passwords', JSON.stringify(passwordStore));

    return { success: true };
  },

  /**
   * Check if email is valid format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Get all registered users (for admin)
   */
  getAllUsers(): User[] {
    return UserService.getAll();
  },

  /**
   * Delete user account
   */
  deleteAccount(email: string): boolean {
    const user = UserService.getByEmail(email);
    if (!user) return false;

    // Remove password
    const passwordStore = JSON.parse(localStorage.getItem('dilg_passwords') || '{}');
    delete passwordStore[email];
    localStorage.setItem('dilg_passwords', JSON.stringify(passwordStore));

    // Remove user
    return UserService.delete(user.id);
  },
};
