import { supabase } from '../lib/supabase';
import type { User } from '../types';

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
  isFirstAdmin?: boolean;
}

/**
 * Supabase Authentication Service
 * Handles user registration, login, and session management
 */
export const supabaseAuthService = {
  /**
   * Register a new user with Supabase Auth
   * All new users are STANDARD by default
   * First user to register automatically becomes ADMIN
   */
  async register(
    email: string,
    password: string,
    fullName: string,
    department: string
  ): Promise<AuthResponse> {
    try {
      // Check if this is the first user (will become ADMIN)
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      const isFirstUser = count === 0;
      const role = isFirstUser ? 'ADMIN' : 'STANDARD';

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            department,
            role,
          },
        },
      });

      if (authError) {
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'Failed to create user' };
      }

      // Insert user profile into database
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          name: fullName,
          department,
          role,
        })
        .select()
        .single();

      if (profileError) {
        // Clean up auth user if profile creation fails
        await supabase.auth.admin.deleteUser(authData.user.id);
        return { success: false, error: profileError.message };
      }

      return {
        success: true,
        user: {
          id: profileData.id,
          email: profileData.email,
          name: profileData.name,
          department: profileData.department,
          role: profileData.role,
          createdAt: profileData.created_at,
        },
        isFirstAdmin: isFirstUser,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  },

  /**
   * Login user with Supabase Auth
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      // Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        return { success: false, error: 'Invalid email or password' };
      }

      if (!authData.user) {
        return { success: false, error: 'Authentication failed' };
      }

      // Fetch user profile from database
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profileData) {
        return { success: false, error: 'User profile not found' };
      }

      return {
        success: true,
        user: {
          id: profileData.id,
          email: profileData.email,
          name: profileData.name,
          department: profileData.department,
          role: profileData.role,
          createdAt: profileData.created_at,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return null;
      }

      // Fetch user profile from database
      const { data: profileData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error || !profileData) {
        return null;
      }

      return {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        department: profileData.department,
        role: profileData.role,
        createdAt: profileData.created_at,
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  /**
   * Update user password
   */
  async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Password update failed',
      };
    }
  },

  /**
   * Check if user is admin
   */
  async isAdmin(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return false;
      }

      return data.role === 'ADMIN';
    } catch (error) {
      return false;
    }
  },
};
