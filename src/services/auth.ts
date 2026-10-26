import { supabase } from '../lib/supabase';
import type { User, Role } from '../types';

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  isFirstAdmin?: boolean;
}

/**
 * Supabase Authentication Service
 * Handles all auth operations with Supabase
 */
export const AuthService = {
  /**
   * Register a new user
   * First user automatically becomes ADMIN
   */
  async register(
    email: string,
    password: string,
    fullName: string,
    department: string
  ): Promise<AuthResult> {
    try {
      console.log('[Auth] Starting registration for:', email);

      // Check if this is the first user
      const { count, error: countError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      let isFirstUser = false;
      
      if (countError) {
        console.error('[Auth] Error counting users:', countError);
        // If RLS blocks, assume first user
        if (countError.code === '42501' || countError.message?.includes('permission denied')) {
          console.warn('[Auth] RLS blocking count. Assuming first user.');
          isFirstUser = true;
        } else {
          return { success: false, error: `Database error: ${countError.message}` };
        }
      } else {
        isFirstUser = count === 0;
      }

      const role: Role = isFirstUser ? 'SUPER_ADMIN' : 'STANDARD';
      console.log('[Auth] Assigning role:', role);

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
        console.error('[Auth] Signup error:', authError);
        return { success: false, error: authError.message };
      }

      if (!authData?.user) {
        return { success: false, error: 'Failed to create user' };
      }

      console.log('[Auth] Auth user created:', authData.user.id);

      // Insert user profile into database with password for custom auth fallback
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .upsert(
          {
            id: authData.user.id,
            email,
            name: fullName,
            department,
            role,
            password, // Store password for custom authentication fallback
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (profileError) {
        console.error('[Auth] Profile insert error:', profileError);
        
        // Check if recursion error - try to fetch existing profile
        if (profileError.message?.includes('infinite recursion')) {
          console.warn('[Auth] Recursion detected. Trying to fetch existing profile...');
          const { data: existing } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();
          
          if (existing) {
            console.log('[Auth] Found existing profile');
            return {
              success: true,
              user: this.mapUser(existing),
              isFirstAdmin: isFirstUser,
            };
          }
        }
        
        return { 
          success: false, 
          error: `Profile creation failed: ${profileError.message}` 
        };
      }

      console.log('[Auth] Registration successful');

      return {
        success: true,
        user: this.mapUser(profileData),
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
   * Login user
   * Tries Supabase Auth first, falls back to custom authentication
   */
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      console.log('[Auth] Login attempt for:', email);

      // First, try Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!authError && authData?.user) {
        console.log('[Auth] Supabase Auth successful, fetching profile...');

        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (!profileError && profileData) {
          console.log('[Auth] Login successful via Supabase Auth');
          return {
            success: true,
            user: this.mapUser(profileData),
          };
        }
      }

      // Fallback: Custom authentication using users table password
      console.log('[Auth] Trying custom authentication...');
      
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        console.error('[Auth] User not found:', userError);
        return { success: false, error: 'Invalid email or password' };
      }

      // Check password from users table
      if (userData.password === password) {
        console.log('[Auth] Custom authentication successful');
        
        // Store user info in sessionStorage for session management
        sessionStorage.setItem('dilg_current_user', JSON.stringify(userData));
        
        return {
          success: true,
          user: this.mapUser(userData),
        };
      }

      console.error('[Auth] Password mismatch');
      return { success: false, error: 'Invalid email or password' };
    } catch (error) {
      console.error('[Auth] Login exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      console.log('[Auth] Logging out...');
      await supabase.auth.signOut();
      sessionStorage.removeItem('dilg_current_user');
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
      // First check sessionStorage for custom auth session
      const storedUser = sessionStorage.getItem('dilg_current_user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          console.log('[Auth] Found user in sessionStorage');
          return this.mapUser(userData);
        } catch (e) {
          console.error('[Auth] Error parsing stored user:', e);
          sessionStorage.removeItem('dilg_current_user');
        }
      }

      // Then check Supabase Auth
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        return null;
      }

      // Fetch profile
      const { data: profileData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error || !profileData) {
        return null;
      }

      return this.mapUser(profileData);
    } catch (error) {
      console.error('[Auth] getCurrentUser error:', error);
      return null;
    }
  },

  /**
   * Update password
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
   * Map database row to User type
   */
  mapUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as Role,
      department: row.department,
      createdAt: row.created_at,
    };
  },

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
};
