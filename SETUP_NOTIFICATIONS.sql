-- ============================================================================
-- NOTIFICATION SYSTEM - COMPLETE SETUP
-- Run this in Supabase SQL Editor to set up the notification system
-- ============================================================================

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'reminder_3days',
    'reminder_1day', 
    'overdue',
    'recurrence_generated',
    'task_assigned',
    'task_completed'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  task_id UUID REFERENCES public.task_instances(id) ON DELETE SET NULL,
  task_title TEXT,
  due_date DATE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON public.notifications(task_id);

-- 3. Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies (if any)
DROP POLICY IF EXISTS "users_view_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_delete_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "service_role_insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "authenticated_insert_notifications" ON public.notifications;

-- 5. Create RLS policies
-- Users can view their own notifications
CREATE POLICY "users_view_own_notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "users_update_own_notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "users_delete_own_notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow authenticated users to insert notifications (for task assignment, etc.)
CREATE POLICY "authenticated_insert_notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Service role can insert notifications (for scheduler)
CREATE POLICY "service_role_insert_notifications"
  ON public.notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 6. Verification queries
SELECT '✅ Notifications table created' as status;

SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'notifications';

SELECT '✅ Indexes created' as status;

SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'notifications';

SELECT '✅ RLS policies created' as status;

SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'notifications';

-- 7. Test insert (optional - uncomment to test)
-- INSERT INTO public.notifications (user_id, type, title, message)
-- VALUES (
--   (SELECT id FROM public.users LIMIT 1),
--   'task_assigned',
--   'Test Notification',
--   'This is a test notification to verify the system is working'
-- );

-- 8. Check if test notification was created
-- SELECT * FROM public.notifications ORDER BY created_at DESC LIMIT 5;

SELECT '✅ Notification system setup complete!' as status;
