import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration - read from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Helper function to check if Supabase is configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Lazy-initialized Supabase client (only created when needed)
let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }
  
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  
  return supabaseInstance;
}

// For backward compatibility - but prefer using getSupabase()
export const supabase = getSupabase();

// Type definitions for Supabase responses
export interface SupabaseUser {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
    department?: string;
    role?: string;
  };
  created_at: string;
}

export interface DatabaseUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'STANDARD';
  department: string;
  created_at: string;
  updated_at: string;
}
