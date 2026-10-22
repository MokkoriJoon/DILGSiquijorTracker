# 🚨 Fix: Infinite Recursion Detected in Policy

## The Problem

You're getting this error:
```
Profile creation failed: infinite recursion detected in policy for relation "users"
```

This happens when there's a **trigger on the `users` table** that creates an infinite loop.

---

## 🔍 What Causes Infinite Recursion?

Infinite recursion occurs when:

1. **A trigger on `auth.users`** automatically inserts into `public.users`
2. **That insert triggers another operation** on the `users` table
3. **Which triggers the same trigger again** → infinite loop

Common causes:
- Auto-profile creation trigger (most common)
- RLS policies that reference the same table
- Circular foreign key constraints

---

## ✅ The Fix (3 Minutes)

### Step 1: Disable Problematic Triggers

Run this SQL in **Supabase SQL Editor**:

```sql
-- ============================================
-- FIX: Disable triggers causing infinite recursion
-- ============================================

-- 1. Drop triggers on auth.users that auto-create profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop triggers on public.users
DROP TRIGGER IF EXISTS users_insert_trigger ON public.users;
DROP TRICYER IF EXISTS users_auto_profile ON public.users;
DROP TRIGGER IF EXISTS auto_create_profile ON public.users;

-- 3. Drop the trigger functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.auto_create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS public.on_auth_user_created() CASCADE;

-- 4. Verify triggers are removed
SELECT 
  trigger_name,
  event_object_table,
  event_object_schema
FROM information_schema.triggers
WHERE event_object_table = 'users'
   OR event_object_schema = 'auth';
```

Click **Run**.

### Step 2: Test Registration

1. Go back to your app
2. Try to register a user again
3. It should work now!

---

## 🔧 Alternative: Create a Safe Trigger

If you **want** auto-profile creation, use this **safe** version:

```sql
-- ============================================
-- SAFE: Auto-create profile without recursion
-- ============================================

-- Drop existing problematic function
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create a SECURITY DEFINER function (bypasses RLS)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into public.users
  -- ON CONFLICT prevents duplicate inserts
  INSERT INTO public.users (id, email, name, department, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'department', 'DILG Siquijor Provincial Office'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'STANDARD')
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Verify it was created
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

---

## 🧪 How to Verify It's Fixed

After running the SQL:

1. **Check console logs** - Should see:
   ```
   [Auth] Starting registration for: user@example.com
   [Auth] Current user count: 0
   [Auth] Assigning role: ADMIN
   [Auth] Creating auth user...
   [Auth] Auth user created: abc123-...
   [Auth] Inserting user profile into database...
   [Auth] User profile created successfully: abc123-...
   ```

2. **Check Supabase Dashboard**:
   - Go to **Authentication** → **Users**
   - Your user should be there

3. **Check Table Editor**:
   - Go to **Table Editor** → **users**
   - User profile should be there

---

## 🐛 Still Getting Recursion Error?

### Check 1: Are there any remaining triggers?

```sql
-- List all triggers on users tables
SELECT 
  trigger_name,
  event_object_table,
  event_object_schema,
  action_statement
FROM information_schema.triggers
WHERE event_object_table LIKE '%user%';
```

If you see any triggers, drop them:
```sql
DROP TRIGGER IF EXISTS trigger_name ON table_name;
```

### Check 2: Are there any functions referencing users?

```sql
-- Find functions that might cause recursion
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_definition LIKE '%users%'
  AND routine_schema = 'public';
```

### Check 3: Check for circular RLS policies

```sql
-- List all policies on users table
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users';
```

If you see policies that reference `users` in their `qual` or `with_check`, they might cause recursion.

---

## 📊 What Changed in the Code

I've updated the code to handle recursion errors gracefully:

1. **Detects recursion errors** - Checks for "infinite recursion" in error message
2. **Tries to fetch existing profile** - If recursion happened, the profile might already exist
3. **Uses upsert instead of insert** - Prevents duplicate key errors
4. **Better error messages** - Tells you exactly what's wrong

---

## 🎯 Two Approaches

### Approach A: No Auto-Profile (Recommended)
- **Disable all triggers** on `auth.users`
- **Manually insert profiles** during registration
- **Pros**: Simple, no recursion risk
- **Cons**: Need to handle profile creation in code

### Approach B: Safe Auto-Profile
- **Use SECURITY DEFINER function** (bypasses RLS)
- **Use ON CONFLICT DO NOTHING** (prevents duplicates)
- **Pros**: Automatic profile creation
- **Cons**: More complex, need to test thoroughly

**I recommend Approach A** for simplicity.

---

## ✅ Success Checklist

After fixing, you should see:

- [ ] SQL runs without errors
- [ ] No triggers on `auth.users` (or safe trigger only)
- [ ] Console shows successful registration logs
- [ ] User appears in Supabase Authentication
- [ ] User profile appears in users table
- [ ] First user gets ADMIN role
- [ ] Can login successfully
- [ ] Redirects to dashboard

---

## 🔍 Diagnostic Queries

Use these to troubleshoot:

```sql
-- 1. Check for triggers
SELECT * FROM information_schema.triggers 
WHERE event_object_table = 'users';

-- 2. Check for functions
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_definition LIKE '%users%';

-- 3. Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'users';

-- 4. Check if RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'users';

-- 5. Count users (should work now)
SELECT COUNT(*) FROM users;
```

---

## 📞 Common Scenarios

### Scenario 1: You had auto-profile creation before
**Solution**: Use the "Safe Trigger" SQL above

### Scenario 2: You never set up auto-profile
**Solution**: Use the "Disable Triggers" SQL above

### Scenario 3: You're not sure what's causing it
**Solution**: 
1. Run diagnostic queries
2. Disable all triggers
3. Test registration
4. If it works, you found the culprit

---

## 🎉 Result

After applying the fix:
- ✅ No more infinite recursion errors
- ✅ Registration works smoothly
- ✅ User profiles are created correctly
- ✅ First user becomes ADMIN automatically
- ✅ All data saves to Supabase

---

**Status:** ✅ Code updated to handle recursion gracefully  
**Action Required:** Run the SQL fix above  
**Time:** ~3 minutes
