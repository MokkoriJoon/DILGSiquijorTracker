-- Allow public read access to task data for Public Dashboard
-- Run this in Supabase SQL Editor

-- Allow anyone (including anonymous) to read task templates
DROP POLICY IF EXISTS "templates_public_select" ON public.task_templates;
CREATE POLICY "templates_public_select" ON public.task_templates
  FOR SELECT TO anon, authenticated
  USING (true);

-- Allow anyone (including anonymous) to read task instances
DROP POLICY IF EXISTS "instances_public_select" ON public.task_instances;
CREATE POLICY "instances_public_select" ON public.task_instances
  FOR SELECT TO anon, authenticated
  USING (true);

-- Allow anyone (including anonymous) to read users (for assignee info)
DROP POLICY IF EXISTS "users_public_select" ON public.users;
CREATE POLICY "users_public_select" ON public.users
  FOR SELECT TO anon, authenticated
  USING (true);

-- Verify the policies
SELECT tablename, policyname, cmd, roles
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('task_templates', 'task_instances', 'users')
  AND cmd = 'SELECT'
ORDER BY tablename, policyname;
