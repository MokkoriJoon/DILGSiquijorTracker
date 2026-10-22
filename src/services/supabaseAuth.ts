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
      console.log('[Auth] Starting registration for:', email);
      
      // Check if this is the first user (will become ADMIN)
      // Try to count users - if this fails due to RLS, assume first user
      let isFirstUser = true;
      try {
        const { count, error: countError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true });
        
        if (countError) {
          // Log the full error object for debugging
          console.error('[Auth] Error counting users:', JSON.stringify(countError));
          console.error('[Auth] Error details:', {
            message: countError.message,
            details: countError.details,
            hint: countError.hint,
            code: countError.code,
          });
          
          // If RLS is blocking, assume first user (will be ADMIN)
          // This allows registration to proceed even if SELECT is blocked
          if (countError.code === '42501' || countError.code === 'PGRST301' || !countError.message) {
            console.warn('[Auth] RLS may be blocking SELECT. Assuming first user (ADMIN).');
            console.warn('[Auth] Please run the RLS fix SQL from DEBUGGING_SUPABASE.md');
            isFirstUser = true;
          } else {
            return { success: false, error: `Database error: ${countError.message || 'Unknown error'}` };
          }
        } else {
          console.log('[Auth] Current user count:', count);
          isFirstUser = count === 0;
        }
      } catch (countException) {
        console.error('[Auth] Exception counting users:', countException);
        console.warn('[Auth] Assuming first user due to count error');
        isFirstUser = true;
      }
      
      const role = isFirstUser ? 'ADMIN' : 'STANDARD';
      console.log('[Auth] Assigning role:', role, '| isFirstUser:', isFirstUser);

      // Create user in Supabase Auth
      console.log('[Auth] Creating auth user...');
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
        console.error('[Auth] Auth signup error:', authError);
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        console.error('[Auth] No user data returned from auth signup');
        return { success: false, error: 'Failed to create user' };
      }

      console.log('[Auth] Auth user created:', authData.user.id);

      // Insert user profile into database
      console.log('[Auth] Inserting user profile into database...');
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
        console.error('[Auth] Profile insert error:', JSON.stringify(profileError));
        console.error('[Auth] Profile error details:', {
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          code: profileError.code,
        });
        
        // Try to clean up auth user if profile creation fails
        try {
          await supabase.auth.admin.deleteUser(authData.user.id);
        } catch (cleanupError) {
          console.error('[Auth] Cleanup error:', cleanupError);
        }
        
        // Provide helpful error messages based on error code
        let errorMessage = profileError.message || 'Unknown error';
        if (profileError.code === '42501' || profileError.code === 'PGRST301') {
          errorMessage = 'RLS policy is blocking INSERT. Please run the RLS fix SQL from DEBUGGING_SUPABASE.md';
        } else if (profileError.code === '23505') {
          errorMessage = 'A user with this email already exists';
        } else if (profileError.code === '23503') {
          errorMessage = 'Foreign key constraint failed. Check if users table exists';
        } else if (profileError.code === '42P01') {
          errorMessage = 'Users table does not exist. Please run the database migration SQL';
        }
        
        return { success: false, error: `Profile creation failed: ${errorMessage}` };
      }

      console.log('[Auth] User profile created successfully:', profileData.id);

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
      console.error('[Auth] Registration exception:', error);
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
      console.log('[Auth] Attempting login for:', email);
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('[Auth] Login error:', authError);
        return { success: false, error: 'Invalid email or password' };
      }

      if (!authData.user) {
        console.error('[Auth] No user data returned from login');
        return { success: false, error: 'Authentication failed' };
      }

      console.log('[Auth] Auth login successful, fetching profile...');

      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profileData) {
        console.error('[Auth] Profile fetch error:', profileError);
        return { success: false, error: 'User profile not found in database' };
      }

      console.log('[Auth] Login successful for user:', profileData.id);

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
      console.error('[Auth] Login exception:', error);
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
    try {
      console.log('[Auth] Logging out...');
      await supabase.auth.signOut();
      console.log('[Auth] Logout successful');
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    }
  },

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      console.log('[Auth] Checking current user session...');
      
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('[Auth] Error getting auth user:', error);
        return null;
      }
      
      if (!user) {
        console.log('[Auth] No active session');
        return null;
      }

      console.log('[Auth] Active session found, fetching profile for:', user.id);

      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        console.error('[Auth] Profile fetch error in getCurrentUser:', profileError);
        return null;
      }

      console.log('[Auth] Current user loaded:', profileData.id);

      return {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        department: profileData.department,
        role: profileData.role,
        createdAt: profileData.created_at,
      };
    } catch (error) {
      console.error('[Auth] getCurrentUser exception:', error);
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
};
