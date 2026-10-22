import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check .env.local file.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Helper function to check if Supabase is configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Type definitions for Supabase responses
export interface SupabaseUser {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
    role?: string;
    department?: string;
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
