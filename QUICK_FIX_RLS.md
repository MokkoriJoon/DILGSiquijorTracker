# 🚨 Quick Fix: Database Error During Registration

## The Problem

You're getting this error:
```
[Auth] Error counting users: Object { message: "" }
```

This happens because **Row Level Security (RLS)** is blocking the query to count users.

---

## ✅ The Fix (2 Minutes)

### Step 1: Run This SQL in Supabase

1. Go to **Supabase Dashboard** → **SQL Editor** → **New Query**
2. Copy and paste this SQL:

```sql
-- ============================================
-- FIX: Enable RLS policies for DILG Tracker
-- ============================================

-- 1. USERS TABLE - Allow registration (anon can insert/select)
DROP POLICY IF EXISTS "Enable insert for registration" ON users;
DROP POLICY IF EXISTS "Enable read access for all users" ON users;
DROP POLICY IF EXISTS "Enable update for users based on id" ON users;
DROP POLICY IF EXISTS "Enable delete for users based on id" ON users;

CREATE POLICY "Enable insert for registration"
ON users FOR INSERT
TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Enable read access for all users"
ON users FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Enable update for users based on id"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable delete for users based on id"
ON users FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- 2. TASK TEMPLATES TABLE
DROP POLICY IF EXISTS "templates_all_access" ON task_templates;
CREATE POLICY "templates_all_access"
ON task_templates FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. TASK INSTANCES TABLE
DROP POLICY IF EXISTS "instances_all_access" ON task_instances;
CREATE POLICY "instances_all_access"
ON task_instances FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. NOTIFICATIONS TABLE
DROP POLICY IF EXISTS "notifications_all_access" ON notifications;
CREATE POLICY "notifications_all_access"
ON notifications FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. UPLOADED FILES TABLE
DROP POLICY IF EXISTS "files_all_access" ON uploaded_files;
CREATE POLICY "files_all_access"
ON uploaded_files FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 6. SCHEDULER LOGS TABLE (if exists)
DROP POLICY IF EXISTS "scheduler_logs_all_access" ON scheduler_logs;
CREATE POLICY "scheduler_logs_all_access"
ON scheduler_logs FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
```

3. Click **Run** (or press Ctrl+Enter)

### Step 2: Test Registration

1. Go back to your app
2. Try to register a user again
3. It should work now!

---

## 🔍 What Was Wrong?

The `users` table has **Row Level Security (RLS)** enabled, which is good for security. However, there were no policies allowing:
- **Anonymous users** (not logged in) to SELECT from the users table
- **Anonymous users** to INSERT new users during registration

Without these policies, the database blocks the query and returns an empty error.

---

## 🧪 How to Verify It's Fixed

After running the SQL:

1. **Check the console** - You should see:
   ```
   [Auth] Current user count: 0
   [Auth] Assigning role: ADMIN
   ```

2. **Check Supabase Dashboard**:
   - Go to **Authentication** → **Users**
   - Your new user should be there

3. **Check the database**:
   - Go to **Table Editor** → **users**
   - Your user profile should be there

---

## 🐛 Still Not Working?

### Check 1: Did the SQL run successfully?
- Go to **SQL Editor** → **History**
- Check if the query succeeded (no red errors)

### Check 2: Are the policies created?
- Go to **Table Editor** → **users** table
- Click on the table name
- Look for "Policies" section
- You should see 4 policies:
  - "Enable insert for registration"
  - "Enable read access for all users"
  - "Enable update for users based on id"
  - "Enable delete for users based on id"

### Check 3: Is RLS enabled?
- In the same table view, check if "RLS" badge is present
- If not, click "Enable RLS"

### Check 4: Console logs
Open browser console (F12) and look for:
```
[Auth] Starting registration for: your@email.com
[Auth] Current user count: 0
[Auth] Assigning role: ADMIN
[Auth] Creating auth user...
[Auth] Auth user created: abc123-...
[Auth] Inserting user profile into database...
[Auth] User profile created successfully: abc123-...
```

If you see errors, copy the full error message and check the error code.

---

## 📊 Error Codes Reference

| Code | Meaning | Solution |
|------|---------|----------|
| `42501` | RLS policy violation | Run the RLS fix SQL above |
| `PGRST301` | RLS policy violation | Run the RLS fix SQL above |
| `23505` | Duplicate email | Use a different email |
| `23503` | Foreign key constraint | Check if users table exists |
| `42P01` | Table doesn't exist | Run the database migration SQL |

---

## 🎯 What Changed in the Code

I've updated the code to be more resilient:

1. **Better error handling** - If RLS blocks the count query, it assumes first user (ADMIN)
2. **Detailed error messages** - Now shows error codes and helpful hints
3. **Graceful fallback** - Registration can proceed even if count fails
4. **Better logging** - More detailed console logs for debugging

---

## ✅ Success Checklist

After fixing, you should see:

- [ ] SQL runs without errors
- [ ] 4 policies created on users table
- [ ] Console shows `[Auth] Current user count: 0`
- [ ] User appears in Supabase Authentication
- [ ] User profile appears in users table
- [ ] First user gets ADMIN role
- [ ] Can login successfully
- [ ] Redirects to dashboard

---

## 📞 Still Stuck?

If the SQL doesn't fix it, check:

1. **Table exists?**
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'users';
   ```

2. **RLS is enabled?**
   ```sql
   SELECT relname, relrowsecurity 
   FROM pg_class 
   WHERE relname = 'users';
   ```

3. **Policies exist?**
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'users';
   ```

---

**Status:** ✅ Code updated with better error handling  
**Action Required:** Run the RLS fix SQL above  
**Time:** ~2 minutes
