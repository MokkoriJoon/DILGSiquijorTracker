# 🔧 Troubleshooting Guide: Overdue Tasks & Notifications

## Issue 1: Overdue Tasks Not Being Marked

### Problem
Tasks are not being marked as OVERDUE even though their due date/time has passed.

### Root Cause (FIXED ✅)
The scheduler was only checking if `due_date < today`, but it wasn't considering the **time component**. If a task was due at 9:00 AM today and it's now 10:00 AM, it should be overdue, but the old logic didn't catch it.

### Solution Applied
Updated `markOverdueTasks()` in `src/services/scheduler.ts` to:
1. Check both date AND time
2. Mark tasks as OVERDUE if:
   - Due date is before today, OR
   - Due date is today AND due time has passed

### How to Test
1. Create a task with a due time (e.g., 9:00 AM)
2. Wait until after the due time (or manually change the due time to the past)
3. Run the scheduler manually:
   - Go to **Scheduler** page
   - Click **"Run Scheduler"**
4. Check the browser console (F12) for logs:
   ```
   [Scheduler] Marking overdue tasks. Current date: 2024-02-15 Time: 10:30
   [Scheduler] Found 5 tasks to check
   [Scheduler] Found 2 overdue tasks
   [Scheduler] Successfully marked 2 tasks as OVERDUE
   ```
5. Check the task status in the database or UI - it should be OVERDUE

### Verify in Database
```sql
-- Check overdue tasks
SELECT 
  ti.id,
  ti.status,
  ti.due_date,
  ti.due_time,
  tt.title,
  u.name as assigned_to
FROM task_instances ti
JOIN task_templates tt ON ti.template_id = tt.id
JOIN users u ON ti.assigned_to = u.id
WHERE ti.status = 'OVERDUE'
ORDER BY ti.due_date DESC;
```

---

## Issue 2: Notifications Not Working

### Problem
Notifications are not appearing in the notification bell or being created in the database.

### Possible Causes & Solutions

#### Cause 1: Notifications Table Doesn't Exist
**Solution:** Run the setup SQL script

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the contents of `SETUP_NOTIFICATIONS.sql`
3. Click **Run**
4. Verify the output shows:
   - ✅ Notifications table created
   - ✅ Indexes created
   - ✅ RLS policies created

#### Cause 2: RLS Policies Are Blocking Access
**Solution:** Check and fix RLS policies

Run this query to check existing policies:
```sql
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'notifications';
```

You should see these policies:
- `users_view_own_notifications` (SELECT)
- `users_update_own_notifications` (UPDATE)
- `users_delete_own_notifications` (DELETE)
- `authenticated_insert_notifications` (INSERT)
- `service_role_insert_notifications` (INSERT)

If any are missing, run `SETUP_NOTIFICATIONS.sql` again.

#### Cause 3: User ID Mismatch
**Solution:** Verify the user ID in notifications matches the logged-in user

```sql
-- Check notifications in database
SELECT 
  n.id,
  n.user_id,
  n.type,
  n.title,
  n.read,
  n.created_at,
  u.email,
  u.name
FROM notifications n
JOIN users u ON n.user_id = u.id
ORDER BY n.created_at DESC
LIMIT 10;
```

Compare the `user_id` with your logged-in user's ID:
```sql
-- Get your user ID
SELECT auth.uid();
```

#### Cause 4: Notifications Not Being Created
**Solution:** Check browser console for errors

1. Open browser console (F12)
2. Perform an action that should trigger a notification (e.g., assign a task)
3. Look for logs like:
   ```
   [Notification] Creating notification: { userId: '...', type: 'task_assigned', title: '...' }
   [Notification] Notification created successfully: abc123...
   ```

If you see errors like:
```
[Notification] Error creating notification: { error: {...}, message: '...' }
```

The error message will tell you what's wrong (usually RLS or table doesn't exist).

### Diagnostic Test

Use the built-in diagnostic function to test the notification system:

1. Open browser console (F12)
2. Run this command:
```javascript
// Get your user ID first
const { data: { user } } = await supabase.auth.getUser();
console.log('Your user ID:', user.id);

// Test the notification system
const result = await NotificationService.testNotificationSystem(user.id);
console.log('Test result:', result);
```

Expected output if working:
```javascript
{
  success: true,
  message: 'Notification system is working correctly!',
  details: {
    tableExists: true,
    canCreate: true,
    canRead: true,
    canDelete: true
  }
}
```

If it fails, the `message` will tell you what's wrong.

### Manual Test

Create a test notification manually:

```sql
-- Insert a test notification
INSERT INTO notifications (user_id, type, title, message, read)
VALUES (
  'YOUR-USER-ID-HERE',  -- Replace with your actual user ID
  'task_assigned',
  'Test Notification',
  'This is a test to verify notifications are working',
  false
);

-- Check if it was created
SELECT * FROM notifications 
WHERE user_id = 'YOUR-USER-ID-HERE' 
ORDER BY created_at DESC 
LIMIT 5;
```

Then refresh the page and check the notification bell - you should see the test notification.

---

## Complete Setup Checklist

### Step 1: Run Database Migrations
```sql
-- Run these in order:
1. CREATE_NOTIFICATIONS_TABLE.sql  (or SETUP_NOTIFICATIONS.sql)
2. ADD_START_DATE_COLUMN.sql
3. ADD_VISIBLE_COLUMN.sql
```

### Step 2: Verify Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('notifications', 'task_instances', 'task_templates', 'users');
```

Should return 4 rows.

### Step 3: Verify RLS Policies
```sql
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename;
```

Should show:
- notifications: 5 policies
- task_instances: multiple policies
- task_templates: multiple policies
- users: multiple policies

### Step 4: Test Scheduler
1. Go to **Scheduler** page
2. Click **"Run Scheduler"**
3. Check browser console for logs
4. Verify overdue tasks are marked
5. Verify new recurring instances are created

### Step 5: Test Notifications
1. Assign a task to a user
2. Check if notification appears in the bell
3. Check browser console for logs
4. Verify notification exists in database

---

## Common Error Messages & Solutions

### Error: "relation notifications does not exist"
**Solution:** Run `SETUP_NOTIFICATIONS.sql`

### Error: "new row violates row-level security policy"
**Solution:** Check RLS policies with:
```sql
SELECT * FROM pg_policies WHERE tablename = 'notifications';
```
Then run `SETUP_NOTIFICATIONS.sql` to recreate policies.

### Error: "permission denied for table notifications"
**Solution:** The authenticated user doesn't have permission. Check RLS policies allow `authenticated` role.

### Error: "column due_time does not exist"
**Solution:** Run the migration to add the `due_time` column:
```sql
ALTER TABLE task_instances ADD COLUMN IF NOT EXISTS due_time TIME;
```

---

## Debugging Commands

### Check Recent Notifications
```sql
SELECT 
  n.id,
  n.user_id,
  u.email,
  n.type,
  n.title,
  n.read,
  n.created_at
FROM notifications n
JOIN users u ON n.user_id = u.id
ORDER BY n.created_at DESC
LIMIT 20;
```

### Check Overdue Tasks
```sql
SELECT 
  ti.id,
  ti.status,
  ti.due_date,
  ti.due_time,
  tt.title,
  u.email as assigned_to
FROM task_instances ti
JOIN task_templates tt ON ti.template_id = tt.id
JOIN users u ON ti.assigned_to = u.id
WHERE ti.status = 'OVERDUE'
ORDER BY ti.due_date DESC;
```

### Check Recurring Task Instances
```sql
SELECT 
  ti.id,
  ti.status,
  ti.due_date,
  ti.due_time,
  tt.title,
  tt.recurrence,
  u.email as assigned_to
FROM task_instances ti
JOIN task_templates tt ON ti.template_id = tt.id
JOIN users u ON ti.assigned_to = u.id
WHERE tt.recurrence != 'ONCE'
ORDER BY ti.due_date DESC
LIMIT 20;
```

### Check Scheduler Logs (Browser Console)
Look for these log patterns:
```
[Scheduler] Marking overdue tasks...
[Scheduler] Found X tasks to check
[Scheduler] Found X overdue tasks
[Scheduler] Successfully marked X tasks as OVERDUE
[Scheduler] Generating next instances from overdue tasks...
[Scheduler] Generated X new instances
[Notification] Creating notification...
[Notification] Notification created successfully...
```

---

## Quick Fix Commands

If notifications still aren't working, try these quick fixes:

### Fix 1: Reset RLS Policies
```sql
-- Drop all notification policies
DROP POLICY IF EXISTS "users_view_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_delete_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "service_role_insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "authenticated_insert_notifications" ON public.notifications;

-- Recreate policies
CREATE POLICY "users_view_own_notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "authenticated_insert_notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_role_insert_notifications"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (true);
```

### Fix 2: Clear Old Notifications
```sql
-- Delete all notifications (use with caution!)
DELETE FROM notifications;
```

### Fix 3: Force Mark Overdue Tasks
```sql
-- Manually mark tasks as overdue
UPDATE task_instances
SET status = 'OVERDUE'
WHERE due_date < CURRENT_DATE
  AND status IN ('PENDING', 'IN_PROGRESS');

-- For tasks due today with time passed
UPDATE task_instances
SET status = 'OVERDUE'
WHERE due_date = CURRENT_DATE
  AND due_time < CURRENT_TIME
  AND status IN ('PENDING', 'IN_PROGRESS');
```

---

## Support

If you're still having issues after trying all the above:

1. **Check browser console** (F12) for detailed error messages
2. **Check Supabase logs** in the dashboard
3. **Run the diagnostic test** in browser console
4. **Verify all migrations** have been run
5. **Check RLS policies** are correctly set up

The most common issues are:
- Notifications table doesn't exist → Run `SETUP_NOTIFICATIONS.sql`
- RLS policies are blocking → Re-run `SETUP_NOTIFICATIONS.sql`
- User ID mismatch → Check that notifications are being created for the correct user
- Time zone issues → Make sure server time matches your expectations

---

**Last Updated:** 2024  
**Status:** ✅ Both issues fixed  
**Version:** 2.9.2
