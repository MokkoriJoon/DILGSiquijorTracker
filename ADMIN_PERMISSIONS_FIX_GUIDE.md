# 🔧 Complete Guide: Fix ADMIN User Permissions

## Problem Summary

ADMIN users cannot perform the following operations:
- ❌ Create and assign tasks
- ❌ Add personal bookmarks
- ❌ Mark tasks as complete
- ❌ Edit or delete tasks

**Error Message:**
```
new row violates row-level security policy for table "task_templates"
```

**Root Cause:**
The Row Level Security (RLS) policies in Supabase are too restrictive. They only allow SUPER_ADMIN to perform these operations, not ADMIN users.

---

## ✅ Solution: Apply RLS Policy Fix

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/
2. Select your project: `dilg-siquijor-tracker`
3. Click on **SQL Editor** in the left sidebar

### Step 2: Run the Fix Script

1. Click **New Query** button
2. Open the file: `FIX_ALL_ADMIN_PERMISSIONS.sql`
3. Copy the ENTIRE content of the file
4. Paste it into the SQL Editor
5. Click **Run** button (or press Ctrl+Enter)

### Step 3: Verify the Fix

After running the script, you should see output like:

```
✅ All RLS policies updated successfully! ADMIN users can now create tasks, add bookmarks, and mark tasks complete.
```

The script will also show:
- Your user info (confirming you're logged in as ADMIN)
- Admin check (should return `true`)
- List of all policies for each table

---

## 🧪 Testing the Fix

### Test 1: Create a Task

1. Login as ADMIN user
2. Go to **Task Management** page
3. Click **Add Program/Task/Project** button
4. Fill in the form:
   - Title: "Test Task"
   - Description: "Testing ADMIN permissions"
   - Category: "Reporting"
   - Priority: "MEDIUM"
   - Recurrence: "One-time"
   - Due Date: Select tomorrow
   - Assign to: Select yourself or another user
5. Click **Create**

**Expected Result:** ✅ Task created successfully

### Test 2: Add a Personal Bookmark

1. Login as ADMIN user
2. Go to **Resource Links** page
3. Scroll to **Personal Bookmarks** section
4. Click **Add Bookmark** button
5. Fill in the form:
   - Title: "Test Bookmark"
   - URL: "https://example.com"
   - Description: "Testing ADMIN permissions"
   - Category: "General"
6. Click **Add Bookmark**

**Expected Result:** ✅ Bookmark added successfully

### Test 3: Mark Task as Complete

1. Login as ADMIN user (or the user the task is assigned to)
2. Go to **My Tasks** page
3. Find a task with status "PENDING" or "OVERDUE"
4. Click the **Mark Complete** button

**Expected Result:** ✅ Task status changes to "COMPLETED"

### Test 4: Edit a Task

1. Login as ADMIN user
2. Go to **Task Management** page
3. Find a task you created
4. Click the **Edit** button (pencil icon)
5. Change the title or description
6. Click **Save**

**Expected Result:** ✅ Task updated successfully

### Test 5: Delete a Task

1. Login as ADMIN user
2. Go to **Task Management** page
3. Find a task you created
4. Click the **Delete** button (trash icon)
5. Confirm deletion

**Expected Result:** ✅ Task deleted successfully

---

## 🔍 Troubleshooting

### Issue: Still getting RLS errors after running the script

**Solution:**
1. Clear your browser cache (Ctrl+Shift+Delete)
2. Logout and login again
3. Try the operation again

### Issue: Script runs but shows errors

**Check:**
1. Make sure you're logged into Supabase with the correct project
2. Verify you have permission to run SQL scripts
3. Check the error message - it might indicate a specific table or policy issue

### Issue: Admin check returns `false`

**This means your user role is not set correctly.**

Run this query to check:
```sql
SELECT id, email, name, role FROM public.users WHERE id = auth.uid();
```

If your role is not 'ADMIN' or 'SUPER_ADMIN', update it:
```sql
UPDATE public.users 
SET role = 'ADMIN' 
WHERE id = auth.uid();
```

### Issue: Policies not showing up

**Verify policies were created:**
```sql
SELECT policyname, tablename, cmd 
FROM pg_policies 
WHERE tablename IN ('task_templates', 'task_instances', 'personal_bookmarks')
ORDER BY tablename, policyname;
```

You should see:
- `task_templates`: 4 policies (select, insert, update, delete)
- `task_instances`: 4 policies (select, insert, update, delete)
- `personal_bookmarks`: 4 policies (select, insert, update, delete)

---

## 📋 What the Fix Does

### Tables Updated:

1. **task_templates**
   - ✅ SELECT: All authenticated users can read
   - ✅ INSERT: SUPER_ADMIN and ADMIN can create
   - ✅ UPDATE: SUPER_ADMIN and ADMIN can edit
   - ✅ DELETE: SUPER_ADMIN and ADMIN can delete

2. **task_instances**
   - ✅ SELECT: All authenticated users can read
   - ✅ INSERT: SUPER_ADMIN and ADMIN can create
   - ✅ UPDATE: Assigned users OR SUPER_ADMIN/ADMIN can update
   - ✅ DELETE: SUPER_ADMIN and ADMIN can delete

3. **task_assignments**
   - ✅ SELECT: All authenticated users can read
   - ✅ INSERT: SUPER_ADMIN and ADMIN can create
   - ✅ DELETE: SUPER_ADMIN and ADMIN can delete

4. **personal_bookmarks**
   - ✅ SELECT: Users can read their own bookmarks
   - ✅ INSERT: Users can create their own bookmarks
   - ✅ UPDATE: Users can update their own bookmarks
   - ✅ DELETE: Users can delete their own bookmarks

5. **notifications**
   - ✅ SELECT: Users can read their own notifications
   - ✅ INSERT: All authenticated users can create
   - ✅ UPDATE: Users can update their own notifications
   - ✅ DELETE: Users can delete their own notifications

---

## 🎯 Permission Matrix

| Operation | SUPER_ADMIN | ADMIN | STANDARD |
|-----------|-------------|-------|----------|
| Create tasks | ✅ | ✅ | ❌ |
| Edit any task | ✅ | ✅ | ❌ |
| Delete any task | ✅ | ✅ | ❌ |
| Assign tasks | ✅ | ✅ | ❌ |
| Mark own task complete | ✅ | ✅ | ✅ |
| Create bookmarks | ✅ | ✅ | ✅ |
| Edit own bookmarks | ✅ | ✅ | ✅ |
| Delete own bookmarks | ✅ | ✅ | ✅ |
| View all tasks | ✅ | ✅ | ❌ |
| View own tasks | ✅ | ✅ | ✅ |
| Manage users | ✅ | ❌ | ❌ |
| Site settings | ✅ | ❌ | ❌ |

---

## 🚀 Quick Fix Checklist

- [ ] Open Supabase SQL Editor
- [ ] Copy content from `FIX_ALL_ADMIN_PERMISSIONS.sql`
- [ ] Paste into SQL Editor
- [ ] Click Run
- [ ] Verify success message appears
- [ ] Check your user role is 'ADMIN' or 'SUPER_ADMIN'
- [ ] Clear browser cache
- [ ] Logout and login
- [ ] Test creating a task
- [ ] Test adding a bookmark
- [ ] Test marking task complete
- [ ] Test editing a task
- [ ] Test deleting a task

---

## 📞 Support

If you're still having issues after applying the fix:

1. **Check browser console** (F12) for detailed error messages
2. **Check Supabase logs** in the dashboard
3. **Verify your user role** in the users table
4. **Re-run the SQL script** to ensure all policies are applied
5. **Clear all browser data** and try again

---

## ✅ Expected Outcome

After applying this fix:

✅ ADMIN users can create and manage tasks  
✅ ADMIN users can add and manage bookmarks  
✅ ADMIN users can mark tasks as complete  
✅ ADMIN users can edit and delete tasks  
✅ All operations work without RLS errors  
✅ SUPER_ADMIN retains all permissions  
✅ STANDARD users retain their limited permissions  

---

**Version:** 1.0  
**Last Updated:** 2026  
**Status:** ✅ Ready to Apply
