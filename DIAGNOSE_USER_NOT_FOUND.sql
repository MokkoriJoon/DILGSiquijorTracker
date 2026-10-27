-- ============================================
-- DIAGNOSTIC & FIX: User Not Found in public.users
-- ============================================

-- STEP 1: Check if you exist in auth.users
SELECT 
  'Auth Users Check' as check_type,
  id,
  email,
  created_at
FROM auth.users
WHERE id = auth.uid();

-- STEP 2: Check if you exist in public.users
SELECT 
  'Public Users Check' as check_type,
  id,
  email,
  name,
  role,
  department
FROM public.users
WHERE id = auth.uid();

-- STEP 3: List ALL users in public.users to see what exists
SELECT 
  'All Public Users' as check_type,
  id,
  email,
  name,
  role,
  department,
  created_at
FROM public.users
ORDER BY created_at DESC;

-- STEP 4: List ALL users in auth.users to see what exists
SELECT 
  'All Auth Users' as check_type,
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

-- ============================================
-- FIX OPTIONS (Run ONE of these based on your situation)
-- ============================================

-- OPTION A: If you exist in auth.users but NOT in public.users
-- This creates your public.users record
/*
INSERT INTO public.users (id, email, name, role, department, created_at)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  COALESCE(raw_user_meta_data->>'role', 'ADMIN'),
  COALESCE(raw_user_meta_data->>'department', 'DILG Siquijor Provincial Office'),
  created_at
FROM auth.users
WHERE id = auth.uid();
*/

-- OPTION B: If your public.users record has wrong ID
-- This updates the ID to match auth.uid()
/*
UPDATE public.users
SET id = auth.uid()
WHERE lower(email) = coalesce(public.auth_user_email(auth.uid()), '');
*/

-- OPTION C: If you want to create a fresh ADMIN user
-- Delete existing and recreate
/*
DELETE FROM public.users WHERE email = 'your-email@example.com';

INSERT INTO public.users (id, email, name, role, department, created_at)
VALUES (
  auth.uid(),
  coalesce(public.auth_user_email(auth.uid()), ''),
  COALESCE(split_part(public.auth_user_email(auth.uid()), '@', 1), 'admin'),
  'SUPER_ADMIN',
  'DILG Siquijor Provincial Office',
  NOW()
);
*/

-- ============================================
-- VERIFICATION (Run after applying fix)
-- ============================================

-- Verify you now exist in public.users with correct role
SELECT 
  'Verification' as check_type,
  id,
  email,
  name,
  role,
  department
FROM public.users
WHERE id = auth.uid();

-- Check if you're recognized as ADMIN
SELECT 
  'Admin Check' as check_type,
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('SUPER_ADMIN', 'ADMIN')
  ) as is_admin;

SELECT '✅ Diagnostic complete! Check results above.' as status;
