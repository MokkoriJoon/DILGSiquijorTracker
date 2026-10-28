import { supabase } from '../lib/supabase';
import type { User, Role } from '../types';

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  isFirstAdmin?: boolean;
}

/**
 * Generate a uuid client-side (no dependency on Supabase Auth / Postgres).
 */
function generateId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last-resort fallback (still a valid uuid v4 shape)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Simple session storage key. Sessions live in sessionStorage so a tab refresh
 * keeps you logged in, but closing the browser ends the session.
 */
const SESSION_KEY = 'dilg_current_user';

/**
 * Authentication Service — SIMPLE MODE (hobby/mini project).
 *
 * There is NO Supabase Auth involved anymore: no auth.users rows, no signup
 * emails, no email confirmation, no JWT sessions. Registration and login talk
 * DIRECTLY to the public.users table through PostgREST with the anon key:
 *
 *   - register: checks the email isn't taken, inserts a row with a
 *     client-generated uuid and the password stored in plain text.
 *   - login:    looks the row up by email and compares the password.
 *
 * NOTE: this is intentionally unsecured (plain-text passwords, open RLS).
 * Do not use this pattern for anything that matters. See
 * SIMPLE_AUTH_NO_SIGNUP.sql for the one-time database setup required.
 */
export const AuthService = {
  /**
   * Register a new user directly into public.users.
   * First-ever account becomes SUPER_ADMIN, everyone else is STANDARD.
   */
  async register(
    email: string,
    password: string,
    fullName: string,
    department: string
  ): Promise<AuthResult> {
    try {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      console.log('[Auth] Starting simple registration for:', normalizedEmail);

      if (!this.isValidEmail(normalizedEmail)) {
        return { success: false, error: 'Enter a valid email address.' };
      }
      if (!password || password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters.' };
      }
      if (!String(fullName || '').trim()) {
        return { success: false, error: 'Name is required.' };
      }

      // ---- Reject duplicate emails (with a friendly message) ----
      const { data: existing, error: lookupError } = await supabase
        .from('users')
        .select('id, role')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (lookupError) {
        console.error('[Auth] Error checking existing user:', lookupError);
        return { success: false, error: `Database error: ${lookupError.message}` };
      }
      if (existing) {
        return {
          success: false,
          error: 'An account with this email already exists. Sign in instead.',
        };
      }

      // ---- Determine role: first-ever account becomes SUPER_ADMIN ----
      const { count, error: countError } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true });

      if (countError) {
        console.error('[Auth] Error counting users:', countError);
        return { success: false, error: `Database error: ${countError.message}` };
      }
      const isFirstUser = (count ?? 0) === 0;
      const role: Role = isFirstUser ? 'SUPER_ADMIN' : 'STANDARD';
      console.log('[Auth] Assigning role:', role, '(user count was', count, ')');

      // ---- Insert the row directly (no auth.users, no verification email) ----
      const id = generateId();
      const { data: created, error: insertError } = await supabase
        .from('users')
        .insert({
          id,
          email: normalizedEmail,
          name: String(fullName).trim(),
          department: department || '',
          role,
          password, // plain text on purpose — simple hobby project
          visible: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Auth] Insert error:', insertError);
        let errorMessage = insertError.message || 'Registration failed';
        if (insertError.code === '23505') {
          errorMessage = 'An account with this email already exists. Sign in instead.';
        } else if (insertError.code === '42501' || insertError.code === 'PGRST301') {
          errorMessage =
            'The database blocked the insert (RLS). Run SIMPLE_AUTH_NO_SIGNUP.sql in the Supabase SQL Editor once.';
        } else if (insertError.code === '42P16' || /row-level security/i.test(insertError.message)) {
          errorMessage =
            'Row-level security is blocking new accounts. Run SIMPLE_AUTH_NO_SIGNUP.sql in the Supabase SQL Editor once.';
        }
        return { success: false, error: errorMessage };
      }

      // ---- Log the new user straight in ----
      this.storeSession(created);

      console.log('[Auth] Registration successful (simple mode):', created.id);
      return { success: true, user: this.mapUser(created), isFirstAdmin: isFirstUser };
    } catch (error) {
      console.error('[Auth] Registration exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  },

  /**
   * Login: find the row by email, compare the stored plain-text password.
   */
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      console.log('[Auth] Simple login attempt for:', normalizedEmail);

      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (error) {
        console.error('[Auth] Login query error:', error);
        return { success: false, error: `Database error: ${error.message}` };
      }
      if (!userData) {
        return { success: false, error: 'Invalid email or password' };
      }
      if (String(userData.password ?? '') !== String(password)) {
        console.warn('[Auth] Password mismatch for', normalizedEmail);
        return { success: false, error: 'Invalid email or password' };
      }

      this.storeSession(userData);
      console.log('[Auth] Login successful for user:', userData.id);
      return { success: true, user: this.mapUser(userData) };
    } catch (error) {
      console.error('[Auth] Login exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  },

  /**
   * Logout: clear the local session.
   */
  async logout(): Promise<void> {
    try {
      console.log('[Auth] Logging out...');
      sessionStorage.removeItem(SESSION_KEY);
      // Best-effort: also clear any leftover Supabase Auth session from the
      // old auth flow so stale state cannot confuse anything.
      await supabase.auth.signOut();
      console.log('[Auth] Logout successful');
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    }
  },

  /**
   * Get the currently signed-in user from the local session, refreshed from
   * the database (so role/name edits in User Management take effect).
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (!stored) return null;

      let sessionId = '';
      try {
        const parsed = JSON.parse(stored);
        sessionId = parsed?.id || '';
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      if (!sessionId) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (error || !userData) {
        // Profile deleted or DB unreachable — end the session.
        console.warn('[Auth] Stored session no longer valid:', error?.message);
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }

      // Keep the cached copy fresh.
      this.storeSession(userData);
      return this.mapUser(userData);
    } catch (error) {
      console.error('[Auth] getCurrentUser error:', error);
      return null;
    }
  },

  /**
   * Change own password (updates the users.password column directly).
   */
  async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'New password must be at least 6 characters.' };
      }
      const current = await this.getCurrentUser();
      if (!current) {
        return { success: false, error: 'You are not signed in.' };
      }
      const { error } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('id', current.id);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Password update failed',
      };
    }
  },

  /**
   * "Forgot password" without any email sending: admins can see every stored
   * password in User Management, and standard users can simply re-register
   * (or ask an admin). We just point them at the right place.
   */
  async requestPasswordRecovery(email: string): Promise<{ success: boolean; error?: string }> {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!this.isValidEmail(normalizedEmail)) {
      return { success: false, error: 'Enter a valid email address first.' };
    }
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (!existing) {
      return { success: false, error: 'No account found with that email.' };
    }
    return {
      success: true,
      error: undefined,
    };
  },

  /**
   * Recovery is not needed in simple mode — kept so older UI paths resolve
   * gracefully instead of throwing.
   */
  async completePasswordRecovery(_newPassword: string): Promise<{ success: boolean; error?: string }> {
    return {
      success: false,
      error: 'Password recovery emails are disabled in simple mode. Ask an Admin to view/reset your password in User Management.',
    };
  },

  /**
   * Persist the session copy in sessionStorage.
   */
  storeSession(row: any): void {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(row));
    } catch (e) {
      console.warn('[Auth] Could not persist session:', e);
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
      avatar: row.avatar,
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
