-- Add password column to users table for admin visibility
-- This stores the plain text password so admins can view it for forgot password scenarios
-- Run this in Supabase SQL Editor

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS password TEXT;

-- Update existing users to have a placeholder password
-- (In production, you'd want to handle this differently)
UPDATE public.users 
SET password = 'Password not stored' 
WHERE password IS NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name = 'password';
