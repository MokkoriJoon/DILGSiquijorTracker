-- Add position column to users table
-- This allows storing job positions/titles for users

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS position TEXT;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name = 'position';
