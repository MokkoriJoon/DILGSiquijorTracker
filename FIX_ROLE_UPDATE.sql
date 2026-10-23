-- Fix role update permissions for Super Admin
-- Run this in Supabase SQL Editor

-- 1. Ensure the role constraint includes all three roles
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'STANDARD'));

-- 2. Drop existing update policies
DROP POLICY IF EXISTS "users_update_own_or_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;

-- 3. Create comprehensive update policy that allows Super Admin to update ANY user
CREATE POLICY "users_update_comprehensive" ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    -- Allow if updating own profile
    auth.uid() = id
    OR
    -- Allow if user is Super Admin
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    -- Same conditions for the updated row
    auth.uid() = id
    OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'SUPER_ADMIN'
    )
  );

-- 4. Verify the policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users'
  AND schemaname = 'public'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- 5. Test the update (optional - uncomment to test)
-- UPDATE public.users 
-- SET role = 'ADMIN' 
-- WHERE email = 'test@example.com';

-- 6. Verify all users and their roles
SELECT 
  id,
  email,
  name,
  role,
  department,
  created_at
FROM public.users 
ORDER BY created_at ASC;
