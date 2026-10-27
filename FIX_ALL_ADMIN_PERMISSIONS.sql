-- ============================================
-- COMPREHENSIVE RLS FIX FOR ADMIN USERS
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================

-- This script fixes RLS policies for ADMIN users to:
-- 1. Create and manage tasks
-- 2. Add and manage personal bookmarks
-- 3. Mark tasks as complete
-- 4. Perform all necessary operations

-- ============================================
-- PART 1: FIX task_templates TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "task_templates_select_authenticated" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_insert_admin_only" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_update_admin_or_owner" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_delete_admin_or_owner" ON public.task_templates;

-- Create new policies that allow both SUPER_ADMIN and ADMIN
CREATE POLICY "task_templates_select_all"
ON public.task_templates
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "task_templates_insert_admin"
ON public.task_templates
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('SUPER_ADMIN', 'ADMIN')
  )
);

CREATE POLICY "task_templates_update_admin"
ON public.task_templates
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('SUPER_ADMIN', 'ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('SUPER_ADMIN', 'ADMIN')
  )
);

CREATE POLICY "task_templates_delete_admin"
ON public.task_templates
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('SUPER_ADMIN', 'ADMIN')
  )
);

-- ============================================
-- PART 2: FIX task_instances TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "task_instances_select_all" ON public.task_instances;
DROP POLICY IF EXISTS "task_instances_insert_admin" ON public.task_instances;
DROP POLICY IF EXISTS "task_instances_update_assigned_or_admin" ON public.task_instances;
DROP POLICY IF EXISTS "task_instances_delete_admin" ON public.task_instances;

-- Create new policies
CREATE POLICY "task_instances_select_all"
ON public.task_instances
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "task_instances_insert_admin"
ON public.task_instances
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('SUPER_ADMIN', 'ADMIN')
  )
);

-- Allow users to update their own assigned tasks OR admins to update any
CREATE POLICY "task_instances_update_assigned_or_admin"
ON public.task_instances
FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('SUPER_ADMIN', 'ADMIN')
  )
)
WITH CHECK (
  assigned_to = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('SUPER_ADMIN', 'ADMIN')
  )
);

CREATE POLICY "task_instances_delete_admin"
ON public.task_instances
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('SUPER_ADMIN', 'ADMIN')
  )
);

-- ============================================
-- PART 3: FIX task_assignments TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "task_assignments_select_all" ON public.task_assignments;
DROP POLICY IF EXISTS "task_assignments_insert_admin" ON public.task_assignments;
DROP POLICY IF EXISTS "task_assignments_delete_admin" ON public.task_assignments;

-- Create new policies
CREATE POLICY "task_assignments_select_all"
ON public.task_assignments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "task_assignments_insert_admin"
ON public.task_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('SUPER_ADMIN', 'ADMIN')
  )
);

CREATE POLICY "task_assignments_delete_admin"
ON public.task_assignments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('SUPER_ADMIN', 'ADMIN')
  )
);

-- ============================================
-- PART 4: FIX personal_bookmarks TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "personal_bookmarks_select_own" ON public.personal_bookmarks;
DROP POLICY IF EXISTS "personal_bookmarks_insert_own" ON public.personal_bookmarks;
DROP POLICY IF EXISTS "personal_bookmarks_update_own" ON public.personal_bookmarks;
DROP POLICY IF EXISTS "personal_bookmarks_delete_own" ON public.personal_bookmarks;

-- Create new policies - users can manage their own bookmarks
CREATE POLICY "personal_bookmarks_select_own"
ON public.personal_bookmarks
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "personal_bookmarks_insert_own"
ON public.personal_bookmarks
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "personal_bookmarks_update_own"
ON public.personal_bookmarks
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "personal_bookmarks_delete_own"
ON public.personal_bookmarks
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- PART 5: FIX notifications TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;

-- Create new policies
CREATE POLICY "notifications_select_own"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_all"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "notifications_update_own"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_delete_own"
ON public.notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check your current user and role
SELECT 
  'Your User Info' as check_type,
  id,
  email,
  name,
  role,
  department
FROM public.users
WHERE id = auth.uid();

-- Check if you're recognized as ADMIN or SUPER_ADMIN
SELECT 
  'Admin Check' as check_type,
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('SUPER_ADMIN', 'ADMIN')
  ) as is_admin;

-- List all policies for task_templates
SELECT 
  'task_templates Policies' as table_name,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'task_templates'
ORDER BY policyname;

-- List all policies for task_instances
SELECT 
  'task_instances Policies' as table_name,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'task_instances'
ORDER BY policyname;

-- List all policies for personal_bookmarks
SELECT 
  'personal_bookmarks Policies' as table_name,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'personal_bookmarks'
ORDER BY policyname;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT '✅ All RLS policies updated successfully! ADMIN users can now create tasks, add bookmarks, and mark tasks complete.' as status;
