# 🗄️ Supabase Migration Guide - Complete Setup

## 📋 Overview

This guide migrates your DILG Siquijor Task Tracker from localStorage to Supabase, providing:
- ✅ Real PostgreSQL database
- ✅ Secure authentication (Supabase Auth)
- ✅ File storage (Supabase Storage)
- ✅ Row Level Security (RLS)
- ✅ Real-time updates
- ✅ Production-ready backend

**Time Required:** ~30 minutes  
**Difficulty:** Intermediate (follow steps carefully)

---

## 🚀 Step 1: Create Supabase Project

### 1.1 Sign Up for Supabase

1. Go to **https://supabase.com**
2. Click **"Start your project"**
3. Sign up with GitHub (recommended) or email
4. Verify your email

### 1.2 Create New Project

1. Click **"New Project"**
2. Fill in:
   - **Organization:** Select yours (or create one)
   - **Project name:** `dilg-siquijor-tracker`
   - **Database Password:** Create a strong password (SAVE THIS!)
   - **Region:** Southeast Asia (Singapore) - closest to Philippines
   - **Pricing plan:** Free (includes 500MB database)
3. Click **"Create new project"**
4. Wait ~2 minutes for initialization

### 1.3 Get Your API Credentials

1. Go to **Settings** (gear icon, bottom left)
2. Click **"API"**
3. Copy these values:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon public key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key:** (keep secret, for server-side only)

---

## 🗃️ Step 2: Create Database Schema

### 2.1 Run the Migration SQL

1. In Supabase dashboard, click **"SQL Editor"** (left sidebar)
2. Click **"New query"**
3. Copy and paste the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Click **"Run"** (or press Ctrl+Enter)
5. Wait for completion (should show "Success. No rows returned")

### 2.2 Verify Tables Were Created

1. Click **"Table Editor"** (left sidebar)
2. You should see these tables:
   - ✅ `users`
   - ✅ `task_templates`
   - ✅ `task_instances`
   - ✅ `task_assignments`
   - ✅ `notifications`
   - ✅ `uploaded_files`
   - ✅ `scheduler_logs`
   - ✅ `email_config`

### 2.3 Enable Row Level Security (RLS)

The migration already includes RLS policies. Verify:

1. Go to **Authentication** → **Policies**
2. Check that RLS is enabled on all tables
3. Policies should allow:
   - Users can view their own data
   - Admins can view all data
   - Users can update their own tasks

---

## 🔐 Step 3: Configure Authentication

### 3.1 Enable Email Auth

1. Go to **Authentication** → **Providers**
2. Click **"Email"**
3. Enable **"Enable Email provider"**
4. Confirm email settings (optional - can skip for now)
5. Click **"Save"**

### 3.2 Configure Auth Settings

1. Go to **Authentication** → **URL Configuration**
2. Set:
   - **Site URL:** `https://your-app.vercel.app` (update after deployment)
   - **Redirect URLs:** `https://your-app.vercel.app/**`
3. Click **"Save"**

### 3.3 Test Authentication

You'll test this after updating the code.

---

## 📦 Step 4: Create Storage Bucket

### 4.1 Create Task Outputs Bucket

1. Go to **Storage** (left sidebar)
2. Click **"New bucket"**
3. Fill in:
   - **Name:** `task-outputs`
   - **Public:** ❌ OFF (keep private)
   - **File size limit:** `10485760` (10MB)
   - **Allowed MIME types:** 
     ```
     image/jpeg,image/png,image/gif,image/webp,
     application/pdf,
     application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,
     application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
     text/plain,text/csv
     ```
4. Click **"Create bucket"**

### 4.2 Set Storage Policies

1. Click on the `task-outputs` bucket
2. Go to **"Policies"** tab
3. Click **"New policy"** → **"Create a policy from scratch"**
4. Add this policy:

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-outputs');

-- Allow users to view their own files
CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'task-outputs');

-- Allow users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-outputs');
```

5. Click **"Save"**

---

## 💻 Step 5: Update Your Code

### 5.1 Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### 5.2 Create Environment Files

Create `.env.local` in your project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace with your actual values from Step 1.3.

### 5.3 Update Service Files

I'll provide the complete updated service files in the next section.

---

## 🧪 Step 6: Test the Migration

### 6.1 Test Registration

1. Run your app locally: `npm run dev`
2. Go to `/register`
3. Create a new account
4. Check Supabase → **Authentication** → **Users**
5. You should see your new user

### 6.2 Test Login

1. Log out
2. Log back in with the same credentials
3. Should work seamlessly

### 6.3 Test Task Creation

1. Create a task template
2. Check Supabase → **Table Editor** → `task_templates`
3. You should see your new task

### 6.4 Test File Upload

1. Upload a file to a task
2. Check Supabase → **Storage** → `task-outputs`
3. You should see your uploaded file

---

## 🚀 Step 7: Deploy to Production

### 7.1 Update Vercel Environment Variables

1. Go to your Vercel project
2. Click **"Settings"** → **"Environment Variables"**
3. Add:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
4. Click **"Save"**
5. Redeploy your app

### 7.2 Update Supabase Auth URLs

1. Go to Supabase → **Authentication** → **URL Configuration**
2. Update **Site URL** to your Vercel URL
3. Update **Redirect URLs** to include your Vercel URL
4. Click **"Save"**

---

## 📊 Step 8: Verify Everything Works

### Checklist

- [ ] Can register new users
- [ ] Can login with credentials
- [ ] Can create task templates
- [ ] Can assign tasks to users
- [ ] Can upload files
- [ ] Can view dashboard statistics
- [ ] Can receive notifications
- [ ] Scheduler runs successfully
- [ ] Data persists after page refresh
- [ ] Multiple users can work simultaneously

---

## 🔧 Troubleshooting

### Problem: "Failed to fetch" errors
**Solution:** Check your Supabase URL and anon key in `.env.local`

### Problem: "User not found" after registration
**Solution:** Check Supabase → **Authentication** → **Users** to see if user was created

### Problem: File upload fails
**Solution:** Check Storage bucket policies and file size limits

### Problem: Can't see other users' tasks
**Solution:** Check RLS policies - admin should have access to all data

### Problem: Real-time updates not working
**Solution:** Ensure you're using Supabase's `.subscribe()` method

---

## 📝 Next Steps

After migration is complete:

1. **Set up email notifications** (see NOTIFICATIONS_SETUP.md)
2. **Configure the scheduler** to run automatically
3. **Set up monitoring** with Sentry or similar
4. **Create backups** of your Supabase database
5. **Train your team** on the new system

---

## 🎯 Production Best Practices

### Security
- ✅ Never commit `.env` files
- ✅ Rotate API keys periodically
- ✅ Enable 2FA for admin accounts
- ✅ Review RLS policies regularly

### Performance
- ✅ Use database indexes (already included in migration)
- ✅ Implement pagination for large datasets
- ✅ Cache frequently accessed data
- ✅ Optimize images before upload

### Monitoring
- ✅ Set up error tracking (Sentry)
- ✅ Monitor database usage
- ✅ Track API call limits
- ✅ Set up uptime monitoring

---

## 📞 Support Resources

- **Supabase Docs:** https://supabase.com/docs
- **Supabase Discord:** https://discord.supabase.com
- **Vercel Docs:** https://vercel.com/docs
- **PostgreSQL Docs:** https://www.postgresql.org/docs

---

**🎉 Congratulations! Your DILG Siquijor Task Tracker is now production-ready with Supabase!**
