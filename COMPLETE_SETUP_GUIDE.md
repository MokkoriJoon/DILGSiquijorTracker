# 🚀 DILG Siquijor Task Tracker - Complete Setup Guide

## ✅ What You Have

- **Supabase Project**: `https://rftmcgcjydsyricrjbrr.supabase.co`
- **Anon Key**: Configured in `.env`
- **Code**: Updated to use Supabase (no localStorage)

---

## 📋 Setup Steps

### Step 1: Run Database SQL (REQUIRED)

1. Go to **Supabase Dashboard** → **SQL Editor** → **New Query**
2. Copy and paste the entire contents of `DATABASE_SETUP.sql`
3. Click **Run**
4. Verify tables were created in **Table Editor**

### Step 2: Disable Email Confirmation

1. Go to **Authentication** → **Providers** → **Email**
2. **Uncheck** "Confirm email"
3. Click **Save**

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Start Development Server

```bash
npm run dev
```

### Step 5: Test Registration

1. Open `http://localhost:5173`
2. Click **Register**
3. Fill in the form
4. First user automatically becomes **ADMIN**
5. Check Supabase → **Authentication** → **Users**
6. Check Supabase → **Table Editor** → **users**

---

## 🔧 Current Status

### ✅ Working
- Supabase client configured
- Auth service (register/login/logout)
- Database service (tasks, templates, users)
- AuthContext updated
- Environment variables set

### ⚠️ Needs Updates
The following pages need to be updated to use async/await:
- AdminDashboard
- MyTasks
- TaskManagement
- UserManagement
- PublicDashboard
- Profile
- SchedulerPage

---

## 🎯 Quick Test

To verify Supabase is working, open browser console and run:

```javascript
// Test 1: Check Supabase connection
const { data, error } = await supabase.from('users').select('*');
console.log('Users:', data, 'Error:', error);

// Test 2: Check auth
const {  user } = await supabase.auth.getUser();
console.log('Current user:', user);
```

---

## 📊 Database Schema

```
users
├── id (UUID, PK)
├── email (TEXT, UNIQUE)
├── name (TEXT)
├── role (TEXT: 'ADMIN' | 'STANDARD')
├── department (TEXT)
└── created_at (TIMESTAMP)

task_templates
├── id (UUID, PK)
├── title (TEXT)
├── description (TEXT)
├── recurrence (TEXT)
├── due_day (INTEGER)
├── category (TEXT)
├── priority (TEXT)
├── created_by (UUID, FK → users)
└── created_at (TIMESTAMP)

task_instances
├── id (UUID, PK)
├── template_id (UUID, FK → task_templates)
├── assigned_to (UUID, FK → users)
├── due_date (DATE)
├── status (TEXT)
├── output (TEXT)
├── completed_at (DATE)
└── created_at (TIMESTAMP)

notifications
├── id (UUID, PK)
├── type (TEXT)
├── title (TEXT)
├── message (TEXT)
├── read (BOOLEAN)
├── user_id (UUID, FK → users)
├── link (TEXT)
└── created_at (TIMESTAMP)

uploaded_files
├── id (UUID, PK)
├── name (TEXT)
├── type (TEXT)
├── size (INTEGER)
├── url (TEXT)
├── path (TEXT)
├── task_id (UUID, FK → task_instances)
├── uploaded_by (UUID, FK → users)
└── created_at (TIMESTAMP)
```

---

## 🔐 Security

### RLS Policies Applied
- ✅ Users can read all users (for task assignment)
- ✅ Users can insert themselves (registration)
- ✅ Users can update/delete own profile
- ✅ Authenticated users can manage tasks
- ✅ Authenticated users can manage files

### Authentication Flow
1. User registers → Supabase Auth creates user
2. Profile inserted into `public.users` table
3. First user gets ADMIN role automatically
4. Subsequent users get STANDARD role
5. Session persisted in browser

---

## 🐛 Troubleshooting

### Issue: "infinite recursion detected"
**Solution**: Run the SQL to drop triggers:
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
```

### Issue: "new row violates row-level security policy"
**Solution**: Re-run the RLS policies from `DATABASE_SETUP.sql`

### Issue: "relation does not exist"
**Solution**: Run `DATABASE_SETUP.sql` to create tables

### Issue: Registration creates auth user but no profile
**Solution**: Check RLS policies on `users` table allow INSERT

---

## 🚀 Next Steps

1. ✅ Run `DATABASE_SETUP.sql`
2. ✅ Disable email confirmation
3. ✅ Test registration
4. ⏳ Update remaining pages to async/await
5. ⏳ Deploy to Vercel

---

## 📞 Support

- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Check console logs**: All auth operations log with `[Auth]` prefix

---

**Status**: Core auth working, pages need async updates  
**Priority**: Run DATABASE_SETUP.sql first!
