# Fix: Super Admin Cannot Change User Roles

## Problem

When a Super Admin tries to change another user's role, the save appears to work but the role doesn't actually change in the database.

## Root Cause

This is caused by **Row Level Security (RLS) policies** in Supabase that are too restrictive. The update policy doesn't properly allow Super Admins to update other users' roles.

## Solution

I've created a comprehensive SQL fix that:

1. ✅ Ensures the role constraint includes all three roles (SUPER_ADMIN, ADMIN, STANDARD)
2. ✅ Creates a comprehensive update policy that allows Super Admins to update ANY user
3. ✅ Improved error handling in the code to show actual error messages
4. ✅ Added validation to check if rows were actually updated

## Required Action

**Run this SQL in Supabase SQL Editor:**

```sql
-- Fix role update permissions for Super Admin
-- Run this in Supabase SQL Editor

-- 1. Ensure the role constraint includes all three roles
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'STANDARD'));

-- 2. Drop existing update policies
DROP POLICY IF EXISTS "users_update_own_or_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;

-- 3. Create comprehensive update policy that allows Super Admin to update ANY user
CREATE POLICY "users_update_comprehensive" ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    -- Allow if updating own profile
    auth.uid() = id
    OR
    -- Allow if user is Super Admin
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    -- Same conditions for the updated row
    auth.uid() = id
    OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'SUPER_ADMIN'
    )
  );

-- 4. Verify the policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users'
  AND schemaname = 'public'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- 5. Verify all users and their roles
SELECT 
  id,
  email,
  name,
  role,
  department,
  created_at
FROM public.users 
ORDER BY created_at ASC;
```

Or run the provided `FIX_ROLE_UPDATE.sql` file.

## Code Changes

I've also improved the error handling in the code:

1. **src/services/database.ts**
   - Updated `updateUser` to return `{ success: boolean; error?: string }` instead of just `boolean`
   - Added validation to check if rows were actually updated
   - Better error messages

2. **src/pages/UserManagement.tsx**
   - Updated to handle the new return type
   - Shows actual error messages from the database

## How to Test

### Step 1: Run the SQL Migration
1. Go to Supabase Dashboard → SQL Editor
2. Run the SQL from `FIX_ROLE_UPDATE.sql`
3. Verify the policy was created successfully

### Step 2: Test Role Change
1. Login as **Super Admin**
2. Go to **User Management**
3. Click **Edit** on a Standard User
4. Change their role to **Admin**
5. Click **Save Changes**
6. **Refresh the page** (Ctrl+F5)
7. Verify the user's role actually changed

### Step 3: Check Browser Console
Open browser console (F12) and look for:
```
[DB] Updating user: <user-id> with data: { role: 'ADMIN' }
[DB] User updated successfully: [...]
```

If you see an error, it will now show the actual error message.

## Expected Behavior

### Before Fix:
- ❌ Super Admin changes role → Save appears to work
- ❌ Refresh page → Role is unchanged
- ❌ No error message shown

### After Fix:
- ✅ Super Admin changes role → Save works
- ✅ Refresh page → Role is changed
- ✅ If there's an error, actual error message is shown

## Troubleshooting

### Issue: Still can't change roles after running SQL

**Check 1: Verify the policy exists**
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users'
  AND schemaname = 'public'
  AND cmd = 'UPDATE';
```

You should see `users_update_comprehensive` in the results.

**Check 2: Verify your role is SUPER_ADMIN**
```sql
SELECT id, email, name, role 
FROM public.users 
WHERE id = auth.uid();
```

Your role should be `SUPER_ADMIN`.

**Check 3: Check browser console**
Open F12 → Console tab → Try to change a role → Look for error messages

**Check 4: Check Supabase logs**
Go to Supabase Dashboard → Logs → API logs → Look for failed UPDATE queries

### Issue: Error message says "No rows were updated"

This means the RLS policy is blocking the update. Run the SQL migration again and verify the policy was created.

### Issue: Error message says "new row violates row-level security policy"

This means the WITH CHECK clause is failing. The policy should allow Super Admins to update any user.

## Files Changed

1. **src/services/database.ts**
   - `updateUser` now returns `{ success: boolean; error?: string }`
   - Added validation to check if rows were updated
   - Better error messages

2. **src/pages/UserManagement.tsx**
   - Updated to handle new return type
   - Shows actual error messages

3. **FIX_ROLE_UPDATE.sql** (NEW)
   - Comprehensive SQL fix for RLS policies
   - Includes verification queries

## Build Status

✅ **Build Successful** - No errors

## Summary

The issue was caused by restrictive RLS policies that didn't properly allow Super Admins to update other users. The fix includes:

1. ✅ Comprehensive RLS policy that allows Super Admins to update ANY user
2. ✅ Role constraint that includes all three roles
3. ✅ Better error handling in the code
4. ✅ Actual error messages shown to users
5. ✅ Validation to ensure updates actually succeeded

After running the SQL migration, Super Admins will be able to change user roles successfully.
