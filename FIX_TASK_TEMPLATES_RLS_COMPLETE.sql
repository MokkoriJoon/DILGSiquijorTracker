-- ============================================
-- COMPLETE FIX: task_templates RLS Policies
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================

-- STEP 1: Drop ALL existing policies on task_templates
DROP POLICY IF EXISTS "templates_select_all" ON public.task_templates;
DROP POLICY IF EXISTS "templates_select" ON public.task_templates;
DROP POLICY IF EXISTS "templates_insert_admin" ON public.task_templates;
DROP POLICY IF EXISTS "templates_insert" ON public.task_templates;
DROP POLICY IF EXISTS "templates_update_own_or_admin" ON public.task_templates;
DROP POLICY IF EXISTS "templates_update" ON public.task_templates;
DROP POLICY IF EXISTS "templates_delete_own_or_admin" ON public.task_templates;
DROP POLICY IF EXISTS "templates_delete" ON public.task_templates;
DROP POLICY IF EXISTS "templates_all" ON public.task_templates;

-- STEP 2: Create NEW policies with explicit role checks

-- SELECT: All authenticated users can read
CREATE POLICY "task_templates_select_authenticated"
ON public.task_templates
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Only SUPER_ADMIN and ADMIN can create tasks
CREATE POLICY "task_templates_insert_admin_only"
ON public.task_templates
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('SUPER_ADMIN', 'ADMIN')
  )
);

-- UPDATE: Users can update their own tasks, admins can update any
CREATE POLICY "task_templates_update_admin_or_owner"
ON public.task_templates
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('SUPER_ADMIN', 'ADMIN')
  )
)
WITH CHECK (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('SUPER_ADMIN', 'ADMIN')
  )
);

-- DELETE: Users can delete their own tasks, admins can delete any
CREATE POLICY "task_templates_delete_admin_or_owner"
ON public.task_templates
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('SUPER_ADMIN', 'ADMIN')
  )
);

-- STEP 3: Verify policies were created
SELECT 
  policyname,
  cmd,
  roles,
  qual IS NOT NULL as has_using,
  with_check IS NOT NULL as has_check
FROM pg_policies
WHERE tablename = 'task_templates'
ORDER BY policyname;

-- STEP 4: Verify your user has the correct role
SELECT 
  id,
  email,
  name,
  role,
  department
FROM public.users
WHERE id = auth.uid();

-- STEP 5: Test the policy manually
-- This should return your user if you're an admin
SELECT 
  EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('SUPER_ADMIN', 'ADMIN')
  ) as is_admin;

-- STEP 6: If the above returns false, update your role to SUPER_ADMIN
-- (Only run this if you need to fix your own user role)
/*
UPDATE public.users
SET role = 'SUPER_ADMIN'
WHERE id = auth.uid();
*/

SELECT '✅ RLS policies updated successfully!' as status;
