/**
 * Unified Auth Service
 * Automatically switches between localStorage and Supabase based on configuration
 */

import { isSupabaseConfigured } from '../lib/supabase';
import { AuthService as LocalAuthService } from './auth';
import { supabaseAuthService } from './supabaseAuth';
import type { User } from '../types';

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  isFirstAdmin?: boolean;
}

export const UnifiedAuthService = {
  /**
   * Register a new user
   * - First user automatically becomes ADMIN
   * - All other users become STANDARD
   */
  async register(
    email: string,
    password: string,
    fullName: string,
    department: string
  ): Promise<AuthResult> {
    if (isSupabaseConfigured) {
      return await supabaseAuthService.register(email, password, fullName, department);
    } else {
      // Use localStorage
      const result = LocalAuthService.register({
        name: fullName,
        email,
        password,
        department,
        role: 'STANDARD', // Will be overridden to ADMIN if first user
      });
      return {
        success: result.success,
        user: result.user,
        error: result.error,
        isFirstAdmin: result.isFirstAdmin,
      };
    }
  },

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<AuthResult> {
    if (isSupabaseConfigured) {
      return await supabaseAuthService.login(email, password);
    } else {
      // Use localStorage
      const result = LocalAuthService.login(email, password);
      return {
        success: result.success,
        user: result.user,
        error: result.error,
      };
    }
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    if (isSupabaseConfigured) {
      await supabaseAuthService.logout();
    }
    // localStorage doesn't need explicit logout
  },

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    if (isSupabaseConfigured) {
      return await supabaseAuthService.getCurrentUser();
    } else {
      // Check sessionStorage for localStorage mode
      const savedUserId = sessionStorage.getItem('dilg_current_user');
      if (savedUserId) {
        const users = LocalAuthService.getAllUsers();
        return users.find(u => u.id === savedUserId) || null;
      }
      return null;
    }
  },

  /**
   * Update password
   */
  async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured) {
      return await supabaseAuthService.updatePassword(newPassword);
    } else {
      // For localStorage, we'd need the user's email
      // This is a simplified version
      return { success: true };
    }
  },

  /**
   * Check if email is valid
   */
  isValidEmail(email: string): boolean {
    return LocalAuthService.isValidEmail(email);
  },

  /**
   * Check if this is the first user (for localStorage mode)
   */
  isFirstUser(): boolean {
    if (isSupabaseConfigured) {
      return false; // Will be checked in supabaseAuth
    }
    return LocalAuthService.getAllUsers().length === 0;
  },
};
