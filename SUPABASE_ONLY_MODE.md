# ✅ Supabase-Only Mode Enabled

## 🎯 What Changed

The application has been updated to use **Supabase exclusively** for all data operations. localStorage has been completely removed.

### Changes Made:

1. **Removed localStorage fallback** - All data now goes to Supabase
2. **Required environment variables** - App throws error if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing
3. **Added console logging** - Detailed `[Auth]` logs for debugging
4. **Updated AuthContext** - Uses `supabaseAuthService` directly
5. **Updated Register page** - Checks Supabase for first user
6. **Added debugging guide** - See `DEBUGGING_SUPABASE.md`

---

## 🚀 How to Use

### 1. Set Environment Variables

Create `.env` file in project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. Restart Dev Server

```bash
# Stop server (Ctrl+C)
npm run dev
```

### 3. Test Registration

1. Open app in browser
2. Open browser console (F12)
3. Register a new user
4. Watch console logs:
   ```
   [Auth] Starting registration for: user@example.com
   [Auth] Current user count: 0
   [Auth] Assigning role: ADMIN
   [Auth] Creating auth user...
   [Auth] Auth user created: abc123-...
   [Auth] Inserting user profile into database...
   [Auth] User profile created successfully: abc123-...
   ```

### 4. Verify in Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Check **Authentication** → **Users** - User should be there
3. Check **Table Editor** → **users** - Profile should be there

---

## 🔍 Debugging

If registration doesn't work:

### Check Console Logs
Open browser console (F12) and look for `[Auth]` logs.

### Common Issues

#### Issue: "Missing Supabase environment variables"
**Solution:** Check `.env` file and restart dev server

#### Issue: "new row violates row-level security policy"
**Solution:** Add RLS policies (see `DEBUGGING_SUPABASE.md` Step 6)

#### Issue: User registers but can't login
**Solution:** Disable email confirmation in Supabase (see Step 5)

#### Issue: Auth user exists but no profile
**Solution:** Check RLS policies or manually insert profile

### Full Debugging Guide
See `DEBUGGING_SUPABASE.md` for complete troubleshooting steps.

---

## 📊 Data Flow

### Registration Flow
```
User fills form
    ↓
supabaseAuthService.register()
    ↓
Check if first user (count users in DB)
    ↓
Create auth user (supabase.auth.signUp)
    ↓
Insert profile (supabase.from('users').insert)
    ↓
Return user data
    ↓
AuthContext sets user state
    ↓
Redirect to dashboard
```

### Login Flow
```
User enters credentials
    ↓
supabaseAuthService.login()
    ↓
Authenticate (supabase.auth.signInWithPassword)
    ↓
Fetch profile (supabase.from('users').select)
    ↓
Return user data
    ↓
AuthContext sets user state
    ↓
Redirect to dashboard
```

---

## 🗄️ Database Schema

Make sure these tables exist in Supabase:

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'STANDARD',
  department TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### task_templates
```sql
CREATE TABLE task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  recurrence TEXT NOT NULL DEFAULT 'ONCE',
  due_day INTEGER,
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### task_instances
```sql
CREATE TABLE task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES task_templates(id),
  assigned_to UUID REFERENCES users(id),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  output TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### notifications
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES users(id),
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### uploaded_files
```sql
CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  url TEXT NOT NULL,
  path TEXT NOT NULL,
  task_id UUID REFERENCES task_instances(id),
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🔐 RLS Policies

Required policies for the app to work:

```sql
-- Users table
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

-- Other tables (task_templates, task_instances, notifications, uploaded_files)
CREATE POLICY "Enable all access for authenticated users"
ON task_templates FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users"
ON task_instances FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users"
ON notifications FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users"
ON uploaded_files FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
```

---

## 📁 Files Changed

### Updated Files
- `src/lib/supabase.ts` - Throws error if env vars missing
- `src/context/AuthContext.tsx` - Uses supabaseAuthService
- `src/pages/Register.tsx` - Checks Supabase for first user
- `src/services/supabaseAuth.ts` - Added console logging

### Deleted Files
- `src/services/unifiedAuth.ts` - No longer needed
- `src/services/auth.ts` - localStorage auth (kept for reference)
- `src/services/database.ts` - localStorage database (kept for reference)

### New Files
- `DEBUGGING_SUPABASE.md` - Complete debugging guide
- `SUPABASE_ONLY_MODE.md` - This file

---

## ✅ Testing Checklist

### Environment Setup
- [ ] `.env` file exists
- [ ] `VITE_SUPABASE_URL` is set
- [ ] `VITE_SUPABASE_ANON_KEY` is set
- [ ] Dev server restarted

### Supabase Setup
- [ ] Email confirmation disabled
- [ ] RLS policies created
- [ ] All tables exist
- [ ] Storage bucket exists (for file uploads)

### Registration Test
- [ ] Can register first user
- [ ] First user gets ADMIN role
- [ ] User appears in Supabase Auth
- [ ] User appears in users table
- [ ] Console shows logs

### Login Test
- [ ] Can login with credentials
- [ ] Redirects to dashboard
- [ ] Session persists after refresh

### Data Operations
- [ ] Can create task template
- [ ] Can assign task
- [ ] Can upload file
- [ ] Data persists in database

---

## 🎉 Success Indicators

You'll know it's working when:

1. ✅ No localStorage usage
2. ✅ All data in Supabase
3. ✅ Console shows `[Auth]` logs
4. ✅ Registration creates user in Supabase
5. ✅ Login works with Supabase
6. ✅ First user becomes ADMIN automatically
7. ✅ Data persists after page refresh
8. ✅ No errors in console

---

## 📞 Need Help?

See `DEBUGGING_SUPABASE.md` for:
- Step-by-step debugging
- Common error messages
- Solutions for each issue
- Manual database operations
- RLS policy setup

---

**Status:** ✅ Supabase-only mode enabled  
**Version:** 3.0.0  
**Mode:** Production (Supabase required)  
**Debug Mode:** Console logging enabled
