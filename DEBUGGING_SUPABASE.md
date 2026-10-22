# 🔧 Supabase Debugging Guide

## ✅ Changes Made

The application has been updated to use **Supabase exclusively** (no localStorage fallback). All authentication and data operations now go directly to Supabase.

### Key Changes:
1. ✅ Removed localStorage fallback
2. ✅ Supabase client is required (throws error if env vars missing)
3. ✅ Added detailed console logging for debugging
4. ✅ All auth operations use Supabase directly
5. ✅ Register page checks Supabase for first user

---

## 🧪 How to Debug

### Step 1: Check Environment Variables

Make sure your `.env` file has:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**To verify:**
```bash
# In your terminal
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
```

Or check in browser console:
```javascript
console.log(import.meta.env.VITE_SUPABASE_URL)
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY)
```

---

### Step 2: Open Browser Console

1. Open your app in the browser
2. Press `F12` or `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
3. Go to the **Console** tab
4. Clear the console (🚫 icon)
5. Try to register a new user

**You should see logs like:**
```
[Auth] Starting registration for: user@example.com
[Auth] Current user count: 0
[Auth] Assigning role: ADMIN
[Auth] Creating auth user...
[Auth] Auth user created: abc123-def456-...
[Auth] Inserting user profile into database...
[Auth] User profile created successfully: abc123-def456-...
```

---

### Step 3: Check Supabase Dashboard

#### 3.1 Check Authentication
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **Users**
4. You should see the registered user there

**If user is NOT there:**
- Check browser console for errors
- Check if email confirmation is required (see Step 5)

#### 3.2 Check Database
1. Go to **Table Editor** (left sidebar)
2. Click on **users** table
3. You should see the user profile there

**If user is NOT there:**
- Check browser console for "Profile insert error"
- Check RLS policies (see Step 6)

---

### Step 4: Common Error Messages

#### Error: "Missing Supabase environment variables"
**Cause:** `.env` file is missing or not loaded  
**Solution:**
```bash
# Make sure .env file exists in project root
# Restart your dev server after adding .env
npm run dev
```

#### Error: "Database error: new row violates row-level security policy"
**Cause:** RLS policies are blocking inserts  
**Solution:** See Step 6 below

#### Error: "Invalid email or password"
**Cause:** User doesn't exist in Supabase Auth  
**Solution:**
1. Check Supabase → Authentication → Users
2. If user exists, try resetting password
3. If user doesn't exist, register again

#### Error: "User profile not found in database"
**Cause:** Auth user exists but profile wasn't created  
**Solution:**
1. Check browser console for "Profile insert error"
2. Check RLS policies on `users` table
3. Manually insert user profile (see Step 7)

---

### Step 5: Disable Email Confirmation (Important!)

By default, Supabase requires email confirmation. For development, disable it:

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Click on **Email**
3. **Uncheck** "Confirm email"
4. Click **Save**

Now users can register and login immediately without confirming email.

---

### Step 6: Check RLS Policies

RLS (Row Level Security) must allow inserts and selects.

#### 6.1 Check if RLS is Enabled
1. Go to **Table Editor** → **users** table
2. Click on the table name
3. Look for "RLS" badge - it should be enabled

#### 6.2 Required Policies

Run this SQL in **SQL Editor**:

```sql
-- Allow anyone to insert users (for registration)
CREATE POLICY "Enable insert for authentication"
ON users FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Allow users to read all users (needed for task assignment)
CREATE POLICY "Enable read access for all users"
ON users FOR SELECT
TO authenticated, anon
USING (true);

-- Allow users to update their own profile
CREATE POLICY "Enable update for users based on id"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow users to delete their own profile
CREATE POLICY "Enable delete for users based on id"
ON users FOR DELETE
TO authenticated
USING (auth.uid() = id);
```

#### 6.3 Apply Policies to Other Tables

Run this for each table:

```sql
-- Task Templates
CREATE POLICY "Enable all access for authenticated users"
ON task_templates FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Task Instances
CREATE POLICY "Enable all access for authenticated users"
ON task_instances FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Notifications
CREATE POLICY "Enable all access for authenticated users"
ON notifications FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Uploaded Files
CREATE POLICY "Enable all access for authenticated users"
ON uploaded_files FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
```

---

### Step 7: Manual Database Insert (If Registration Fails)

If registration creates auth user but not profile, manually insert:

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Copy the user's UUID
3. Go to **Table Editor** → **users** table
4. Click **Insert** → **New Row**
5. Fill in:
   - `id`: (paste the UUID from step 2)
   - `email`: user's email
   - `name`: user's full name
   - `department`: department name
   - `role`: 'ADMIN' or 'STANDARD'
6. Click **Save**

---

### Step 8: Test Registration Flow

#### Test 1: First User (Should be ADMIN)
1. Clear all data in Supabase (or use fresh project)
2. Register a new user
3. Check console logs - should see "Assigning role: ADMIN"
4. Check Supabase → Authentication → Users
5. Check Supabase → Table Editor → users
6. User should have `role = 'ADMIN'`

#### Test 2: Second User (Should be STANDARD)
1. Logout
2. Register another user
3. Check console logs - should see "Assigning role: STANDARD"
4. Check database - user should have `role = 'STANDARD'`

#### Test 3: Login
1. Logout
2. Login with the credentials
3. Check console logs - should see "Login successful"
4. Should redirect to dashboard

---

### Step 9: Check Supabase Logs

1. Go to **Supabase Dashboard** → **Logs**
2. Check **API logs** for failed requests
3. Check **Postgres logs** for database errors
4. Look for errors related to:
   - `users` table inserts
   - RLS policy violations
   - Authentication errors

---

### Step 10: Reset and Start Fresh

If everything is broken, start fresh:

#### 10.1 Clear Supabase Data
```sql
-- Run in SQL Editor
DELETE FROM uploaded_files;
DELETE FROM notifications;
DELETE FROM task_instances;
DELETE FROM task_templates;
DELETE FROM users;
```

#### 10.2 Clear Auth Users
1. Go to **Authentication** → **Users**
2. Select all users
3. Click **Delete**

#### 10.3 Clear Browser Storage
1. Open DevTools (F12)
2. Go to **Application** tab
3. Clear:
   - Local Storage
   - Session Storage
   - Cookies

#### 10.4 Restart App
```bash
# Stop dev server (Ctrl+C)
# Clear node_modules cache
rm -rf node_modules/.vite
# Restart
npm run dev
```

---

## 📊 Debugging Checklist

Use this checklist to verify everything is working:

### Environment Setup
- [ ] `.env` file exists with correct values
- [ ] `VITE_SUPABASE_URL` is set
- [ ] `VITE_SUPABASE_ANON_KEY` is set
- [ ] Dev server restarted after adding `.env`

### Supabase Configuration
- [ ] Email confirmation disabled
- [ ] RLS policies created for all tables
- [ ] Storage bucket `task-outputs` exists
- [ ] Storage policies configured

### Registration Test
- [ ] Can register first user
- [ ] First user gets ADMIN role
- [ ] User appears in Authentication → Users
- [ ] User appears in Table Editor → users
- [ ] Console shows successful registration logs

### Login Test
- [ ] Can login with registered user
- [ ] Redirects to dashboard
- [ ] Console shows successful login logs
- [ ] User session persists after refresh

### Database Test
- [ ] Can create task template
- [ ] Can assign task to user
- [ ] Can upload file
- [ ] Data persists in database

---

## 🐛 Common Issues and Solutions

### Issue 1: "supabaseUrl is required"
**Solution:** Environment variables not loaded
```bash
# Check .env file exists
cat .env

# Restart dev server
npm run dev
```

### Issue 2: User registers but can't login
**Solution:** Email confirmation required
1. Disable email confirmation (Step 5)
2. Or manually confirm email in Supabase

### Issue 3: "new row violates row-level security policy"
**Solution:** RLS policies missing
1. Run SQL from Step 6.2
2. Verify policies in Table Editor

### Issue 4: Auth user exists but no profile
**Solution:** Profile insert failed
1. Check console for "Profile insert error"
2. Check RLS policies on `users` table
3. Manually insert profile (Step 7)

### Issue 5: Can't see other users' tasks
**Solution:** RLS policies too restrictive
1. Update policies to allow SELECT for authenticated users
2. Or use service_role key (not recommended for client-side)

---

## 📞 Getting Help

If you're still stuck:

1. **Check browser console** - Copy all `[Auth]` logs
2. **Check Supabase logs** - Go to Logs → API/Postgres
3. **Check network tab** - Look for failed requests
4. **Share screenshots** of:
   - Browser console errors
   - Supabase Authentication → Users
   - Supabase Table Editor → users table
   - Network tab failed requests

---

## ✅ Success Indicators

You'll know it's working when:

1. ✅ Registration creates user in Supabase Auth
2. ✅ Registration creates profile in `users` table
3. ✅ First user gets ADMIN role automatically
4. ✅ Subsequent users get STANDARD role
5. ✅ Login works and redirects to dashboard
6. ✅ Console shows detailed logs
7. ✅ Data persists in Supabase database
8. ✅ No localStorage usage

---

**Last Updated:** 2024  
**Status:** Supabase-only mode enabled  
**Debug Mode:** Console logging enabled
