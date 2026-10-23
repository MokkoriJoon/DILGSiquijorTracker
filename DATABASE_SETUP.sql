-- ============================================
-- DILG SIQUIJOR TASK TRACKER - DATABASE SETUP
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. CREATE USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'STANDARD' CHECK (role IN ('ADMIN', 'STANDARD')),
  department TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREATE TASK TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  recurrence TEXT NOT NULL DEFAULT 'ONCE' CHECK (recurrence IN ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
  due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31),
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CREATE TASK INSTANCES TABLE
CREATE TABLE IF NOT EXISTS public.task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.task_templates(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.users(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'OVERDUE')),
  output TEXT,
  completed_at DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CREATE NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CREATE UPLOADED FILES TABLE
CREATE TABLE IF NOT EXISTS public.uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  url TEXT NOT NULL,
  path TEXT NOT NULL,
  task_id UUID REFERENCES public.task_instances(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE RLS POLICIES
-- ============================================

-- USERS TABLE
DROP POLICY IF EXISTS "users_select_all" ON public.users;
DROP POLICY IF EXISTS "users_insert_all" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_delete_own" ON public.users;

CREATE POLICY "users_select_all" ON public.users
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "users_insert_all" ON public.users
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_delete_own" ON public.users
  FOR DELETE TO authenticated
  USING (auth.uid() = id);

-- TASK TEMPLATES TABLE
DROP POLICY IF EXISTS "templates_all" ON public.task_templates;

CREATE POLICY "templates_all" ON public.task_templates
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- TASK INSTANCES TABLE
DROP POLICY IF EXISTS "instances_all" ON public.task_instances;

CREATE POLICY "instances_all" ON public.task_instances
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- NOTIFICATIONS TABLE
DROP POLICY IF EXISTS "notifications_all" ON public.notifications;

CREATE POLICY "notifications_all" ON public.notifications
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- UPLOADED FILES TABLE
DROP POLICY IF EXISTS "files_all" ON public.uploaded_files;

CREATE POLICY "files_all" ON public.uploaded_files
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_task_instances_assigned_to ON public.task_instances(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_instances_status ON public.task_instances(status);
CREATE INDEX IF NOT EXISTS idx_task_instances_due_date ON public.task_instances(due_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- ============================================
-- DISABLE EMAIL CONFIRMATION (IMPORTANT!)
-- Go to: Authentication → Providers → Email
-- Uncheck "Confirm email"
-- ============================================

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'task_templates', 'task_instances', 'notifications', 'uploaded_files');

-- Check RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname IN ('users', 'task_templates', 'task_instances', 'notifications', 'uploaded_files');

-- Check policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';

-- ============================================
-- SETUP COMPLETE!
-- ============================================
