-- Fix RLS policy to allow admins to update any user
-- Run this in Supabase SQL Editor

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "users_update_own" ON public.users;

-- Create a new policy that allows:
-- 1. Users to update their own profile
-- 2. Admins to update any user's profile
CREATE POLICY "users_update_own_or_admin" ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id 
    OR 
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  )
  WITH CHECK (
    auth.uid() = id 
    OR 
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Also fix delete policy to allow admins to delete users
DROP POLICY IF EXISTS "users_delete_own" ON public.users;

CREATE POLICY "users_delete_own_or_admin" ON public.users
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = id 
    OR 
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Verify the policies were created
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users'
  AND schemaname = 'public'
ORDER BY policyname;
