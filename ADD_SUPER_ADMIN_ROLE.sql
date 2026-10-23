-- Add SUPER_ADMIN role support
-- Run this in Supabase SQL Editor

-- Update the role check constraint to include SUPER_ADMIN
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'STANDARD'));

-- Update existing ADMIN users to SUPER_ADMIN (first user should be Super Admin)
-- This assumes the first registered user should be Super Admin
UPDATE public.users 
SET role = 'SUPER_ADMIN' 
WHERE id = (
  SELECT id FROM public.users 
  ORDER BY created_at ASC 
  LIMIT 1
);

-- Verify the changes
SELECT id, email, name, role, department 
FROM public.users 
ORDER BY created_at ASC;
