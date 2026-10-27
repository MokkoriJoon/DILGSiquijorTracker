-- Fix RLS policies for task_templates to allow ADMIN users to create tasks
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "templates_select" ON public.task_templates;
DROP POLICY IF EXISTS "templates_insert" ON public.task_templates;
DROP POLICY IF EXISTS "templates_update" ON public.task_templates;
DROP POLICY IF EXISTS "templates_delete" ON public.task_templates;
DROP POLICY IF EXISTS "templates_all" ON public.task_templates;

-- Create new policies that allow both SUPER_ADMIN and ADMIN to manage tasks
CREATE POLICY "templates_select_all" ON public.task_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "templates_insert_admin" ON public.task_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('SUPER_ADMIN', 'ADMIN')
    )
  );

CREATE POLICY "templates_update_own_or_admin" ON public.task_templates
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('SUPER_ADMIN', 'ADMIN')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('SUPER_ADMIN', 'ADMIN')
    )
  );

CREATE POLICY "templates_delete_own_or_admin" ON public.task_templates
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('SUPER_ADMIN', 'ADMIN')
    )
  );

-- Verify policies
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'task_templates'
ORDER BY policyname;
