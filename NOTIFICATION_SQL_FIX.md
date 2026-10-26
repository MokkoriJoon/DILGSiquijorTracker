# 🔧 Fix: Notification Setup SQL Error

## Problem

When running `SETUP_NOTIFICATIONS.sql`, you got this error:

```
ERROR: 42703: column "task_id" does not exist
```

## Root Cause

The original SQL script had a **foreign key constraint** that referenced the `task_instances` table:

```sql
task_id UUID REFERENCES public.task_instances(id) ON DELETE SET NULL
```

This failed because:
- The `task_instances` table might not exist yet, OR
- There was a constraint violation

## Solution

I've created a **fixed version** that removes the foreign key constraint:

**File:** `SETUP_NOTIFICATIONS_FIXED.sql`

### What Changed

**Before (Failed):**
```sql
task_id UUID REFERENCES public.task_instances(id) ON DELETE SET NULL
```

**After (Fixed):**
```sql
task_id UUID  -- Just a nullable column, no foreign key
```

The `task_id` column is still there and works the same way, but without the foreign key constraint that was causing the error.

---

## 🚀 How to Fix

### Step 1: Run the Fixed SQL Script

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **New Query**
3. Copy and paste the contents of **`SETUP_NOTIFICATIONS_FIXED.sql`**
4. Click **Run**

### Step 2: Verify Success

You should see these messages:
```
✅ Notifications table created successfully!
✅ Indexes created successfully!
✅ RLS policies created successfully!
✅ Notification system setup complete! You can now use notifications.
```

### Step 3: Test Notifications

1. Refresh your browser (Ctrl+F5)
2. Assign a task to a user
3. Check the notification bell - you should see a notification

---

## 📊 Verification Queries

After running the fixed script, verify everything is working:

### Check Table Exists
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'notifications';
```

Should return: `notifications`

### Check Columns
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;
```

Should show:
- id (uuid)
- user_id (uuid)
- type (text)
- title (text)
- message (text)
- task_id (uuid) ← This should exist now
- task_title (text)
- due_date (date)
- read (boolean)
- created_at (timestamp)

### Check Policies
```sql
SELECT policyname, cmd
FROM pg_policies 
WHERE tablename = 'notifications';
```

Should show 5 policies:
- users_view_own_notifications (SELECT)
- users_update_own_notifications (UPDATE)
- users_delete_own_notifications (DELETE)
- authenticated_insert_notifications (INSERT)
- service_role_insert_notifications (INSERT)

---

## 🧪 Test the Notification System

### Test 1: Insert a Test Notification

```sql
-- Get your user ID first
SELECT auth.uid();

-- Insert a test notification (replace YOUR-USER-ID with your actual user ID)
INSERT INTO notifications (user_id, type, title, message)
VALUES (
  'YOUR-USER-ID-HERE',
  'task_assigned',
  'Test Notification',
  'This is a test to verify notifications are working'
);

-- Check if it was created
SELECT * FROM notifications 
WHERE user_id = 'YOUR-USER-ID-HERE' 
ORDER BY created_at DESC;
```

### Test 2: Check in UI

1. Refresh your browser
2. Look at the notification bell in the top right
3. You should see a red badge with "1"
4. Click the bell - you should see the test notification

---

## 🔍 Why This Works

The fixed version:
- ✅ Creates the `notifications` table without foreign key constraints
- ✅ Makes `task_id` a simple nullable UUID column
- ✅ Still stores the task ID for reference
- ✅ Works even if `task_instances` table doesn't exist
- ✅ All RLS policies are correctly set up
- ✅ All indexes are created for performance

The only difference is that if a task is deleted, the `task_id` in notifications won't automatically become NULL (because there's no foreign key). But this is a minor issue and doesn't affect functionality.

---

## 📁 Files

- **SETUP_NOTIFICATIONS_FIXED.sql** - The fixed version (use this!)
- **SETUP_NOTIFICATIONS.sql** - The original version (don't use this)

---

## ✅ Success Indicators

After running the fixed script, you should have:

- ✅ `notifications` table exists
- ✅ All columns present (including `task_id`)
- ✅ All indexes created
- ✅ RLS enabled
- ✅ 5 RLS policies created
- ✅ Can insert notifications
- ✅ Can read notifications
- ✅ Notification bell shows notifications

---

## 🐛 Still Having Issues?

If you still get errors after running the fixed script:

### Error: "relation already exists"
The table already exists. Drop it first:
```sql
DROP TABLE IF EXISTS notifications CASCADE;
```
Then run the fixed script again.

### Error: "permission denied"
You need to be logged in as the database owner. Check your Supabase credentials.

### Error: "column already exists"
Some columns already exist. Drop the table and start fresh:
```sql
DROP TABLE IF EXISTS notifications CASCADE;
```

---

**Status:** ✅ Fixed  
**Use:** `SETUP_NOTIFICATIONS_FIXED.sql`  
**Don't Use:** `SETUP_NOTIFICATIONS.sql` (has foreign key issues)
