import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration - read from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Throw error if environment variables are missing
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Create Supabase client immediately (required for production)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Helper function for backward compatibility
export function getSupabase(): SupabaseClient {
  return supabase;
}

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
