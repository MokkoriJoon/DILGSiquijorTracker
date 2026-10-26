-- ============================================================================
-- NOTIFICATION SYSTEM - CLEAN SETUP (Removes ALL Existing Objects First)
-- Run this in Supabase SQL Editor
-- ============================================================================

-- STEP 1: Drop ALL existing notification-related objects
-- ============================================================================

-- Drop the table (this will also drop triggers on it)
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Drop any functions that might reference notifications
DROP FUNCTION IF EXISTS public.create_notification() CASCADE;
DROP FUNCTION IF EXISTS public.notify_user() CASCADE;
DROP FUNCTION IF EXISTS public.send_notification() CASCADE;

-- Drop any views that might reference notifications
DROP VIEW IF EXISTS public.user_notifications CASCADE;
DROP VIEW IF EXISTS public.notification_summary CASCADE;

-- Drop any triggers that might reference notifications
DROP TRIGGER IF EXISTS notify_on_task_assignment ON public.task_instances;
DROP TRIGGER IF EXISTS notify_on_task_completion ON public.task_instances;

SELECT '✅ Cleaned up all existing notification objects' as status;

-- STEP 2: Create notifications table (NO foreign keys at all)
-- ============================================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  task_id UUID,
  task_title TEXT,
  due_date DATE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

SELECT '✅ Notifications table created' as status;

-- STEP 3: Create indexes
-- ============================================================================

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON public.notifications(type);

SELECT '✅ Indexes created' as status;

-- STEP 4: Enable RLS
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

SELECT '✅ RLS enabled' as status;

-- STEP 5: Create RLS policies
-- ============================================================================

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

-- Allow authenticated users to insert notifications
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

SELECT '✅ RLS policies created' as status;

-- STEP 6: Verify everything
-- ============================================================================

SELECT '✅ Verification - Table structure:' as status;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

SELECT '✅ Verification - Indexes:' as status;

SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'notifications';

SELECT '✅ Verification - RLS Policies:' as status;

SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'notifications';

SELECT '✅ Verification - RLS Enabled:' as status;

SELECT 
  relname,
  relrowsecurity
FROM pg_class 
WHERE relname = 'notifications';

-- STEP 7: Test insert
-- ============================================================================

SELECT '✅ Testing notification insert...' as status;

-- Insert a test notification (using the first user in the system)
INSERT INTO public.notifications (user_id, type, title, message)
VALUES (
  (SELECT id FROM public.users LIMIT 1),
  'task_assigned',
  'Test Notification',
  'This is a test notification to verify the system is working correctly'
);

SELECT '✅ Test notification inserted successfully!' as status;

-- Show the test notification
SELECT 
  id,
  user_id,
  type,
  title,
  message,
  read,
  created_at
FROM public.notifications
ORDER BY created_at DESC
LIMIT 1;

SELECT '✅ Notification system setup COMPLETE and TESTED!' as status;
SELECT '✅ You can now use notifications in your application!' as status;
