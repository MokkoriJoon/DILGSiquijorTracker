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

        // IMPORTANT: "Old users" (created before Supabase Auth was wired up, or
        // whose auth row is missing / has no logs) have NO valid Supabase session.
        // Without one, every RLS policy that checks auth.uid() fails silently —
        // inserts/updates on task_templates, task_instances and
        // personal_bookmarks are rejected ("new row violates row-level security
        // policy"), which is why these users could not add/assign/edit tasks or
        // bookmarks. To repair them, create (or reset) their Supabase Auth user
        // with the SAME uuid as their public.users.id and sign in with it so a
        // real JWT/session exists.
        try {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError) {
            // No usable auth user for this account yet — provision one keyed to
            // the existing profile id (same uuid as public.users.id) via the
            // server-side repair endpoint, which uses the service role key.
            console.warn('[Auth] No Supabase session for this user; provisioning auth account...', signInError.message);

            let provisioned = false;
            try {
              const res = await fetch('/api/admin-create-auth-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userData.id, email, password }),
              });
              if (res.ok) {
                provisioned = true;
                console.log('[Auth] Auth account provisioned for', email);
              } else {
                console.warn('[Auth] admin-create-auth-user returned status ' + res.status +
                  '. Deploy the endpoint or run FIX_OLD_USERS_AUTH_RLS.sql.');
              }
            } catch (e) {
              console.warn('[Auth] Could not call admin-create-auth-user:', e);
            }

            if (provisioned) {
              // Sign in with the freshly provisioned auth account so a real JWT
              // session exists and auth.uid() works in all RLS policies.
              const retry = await supabase.auth.signInWithPassword({ email, password });
              if (retry.error) {
                console.warn('[Auth] Retry sign-in failed:', retry.error.message);
              }
            }
          } else if (signInData?.user && signInData.user.id !== userData.id) {
            // Auth user exists but its id does not match the profile id — RLS
            // policies comparing auth.uid() to user ids would fail. Repair the
            // mapping once via the server endpoint (delete/recreate auth user
            // with the correct uuid), then re-login.
            console.warn('[Auth] auth uid mismatch:', signInData.user.id, '!=', userData.id, '- repairing...');
            try {
              const res = await fetch('/api/admin-create-auth-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userData.id, email, password }),
              });
              if (res.ok) {
                await supabase.auth.signOut();
                const retry = await supabase.auth.signInWithPassword({ email, password });
                if (retry.error) {
                  console.warn('[Auth] Re-sign-in after repair failed:', retry.error.message);
                }
              }
            } catch (e) {
              console.warn('[Auth] uid repair endpoint unavailable:', e);
            }
          }
        } catch (e) {
          console.warn('[Auth] Session provisioning exception:', e);
        }

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
      position: row.position,
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
