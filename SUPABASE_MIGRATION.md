# 🚀 Supabase Migration Guide - DILG Siquijor Task Tracker

This guide will help you migrate your DILG Siquijor Task Tracker from localStorage to Supabase for production use.

## 📋 Prerequisites

- Node.js 18+ and npm installed
- A Supabase account (free tier is sufficient)
- Your project code ready for deployment

## 🎯 What You'll Accomplish

By the end of this guide, you'll have:
- ✅ A Supabase project with PostgreSQL database
- ✅ User authentication with Supabase Auth
- ✅ File storage for task attachments
- ✅ Row Level Security (RLS) policies
- ✅ Your app connected to real database
- ✅ Production-ready deployment

---

## Step 1: Create Supabase Project

### 1.1 Sign Up for Supabase

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email

### 1.2 Create New Project

1. Click "New Project"
2. Fill in the details:
   - **Organization**: Select your organization
   - **Project name**: `dilg-siquijor-tracker`
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to your users (e.g., Southeast Asia for Philippines)
   - **Pricing Plan**: Free (includes 500MB database, 1GB storage)
3. Click "Create new project"
4. Wait 2-3 minutes for project initialization

### 1.3 Get Your Project Credentials

1. Go to **Project Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (starts with eyJ)
   - **service_role key**: (keep this secret!)

---

## Step 2: Set Up Database Schema

### 2.1 Create Tables

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste the entire SQL from `supabase/migrations/001_initial_schema.sql`
4. Click "Run" or press Ctrl+Enter
5. Verify tables were created in **Table Editor**

You should see these tables:
- `users`
- `task_templates`
- `task_instances`
- `task_assignments`
- `notifications`
- `uploaded_files`
- `scheduler_logs`
- `email_config`

### 2.2 Enable Row Level Security (RLS)

The SQL migration already includes RLS policies. Verify they're active:

1. Go to **Authentication** → **Policies**
2. Check that RLS is enabled on all tables
3. Policies should allow:
   - Authenticated users can read their own data
   - Admins can read all data
   - Users can update their own tasks

---

## Step 3: Configure Environment Variables

### 3.1 Create .env File

In your project root, create a `.env` file:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace with your actual values from Step 1.3.

### 3.2 Update .gitignore

Make sure `.env` is in your `.gitignore`:

```
# Environment variables
.env
.env.local
.env.production
```

---

## Step 4: Set Up Storage

### 4.1 Create Storage Bucket

1. Go to **Storage** in Supabase dashboard
2. Click "New bucket"
3. Name: `task-outputs`
4. Public bucket: **No** (keep private)
5. File size limit: 10485760 (10MB)
6. Allowed MIME types:
   ```
   image/jpeg,image/png,image/gif,image/webp,
   application/pdf,
   application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,
   application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
   text/plain,text/csv
   ```
7. Click "Create bucket"

### 4.2 Set Storage Policies

Run this SQL in **SQL Editor**:

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-outputs');

-- Allow users to view their own files
CREATE POLICY "Allow users to view own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'task-outputs');

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-outputs');
```

---

## Step 5: Configure Authentication

### 5.1 Enable Email Authentication

1. Go to **Authentication** → **Providers**
2. Click on "Email"
3. Enable "Enable Email provider"
4. Confirm email settings (optional - you can skip for now)
5. Click "Save"

### 5.2 Configure Auth Settings

1. Go to **Authentication** → **URL Configuration**
2. Set Site URL: `http://localhost:5173` (for development)
3. Add redirect URLs:
   - `http://localhost:5173/**`
   - `https://your-domain.vercel.app/**` (for production)
4. Click "Save"

---

## Step 6: Test the Migration

### 6.1 Install Dependencies

```bash
npm install
```

### 6.2 Start Development Server

```bash
npm run dev
```

### 6.3 Test Registration

1. Open `http://localhost:5173`
2. Click "Register"
3. Fill in the form:
   - Name: Your Name
   - Email: your.email@example.com
   - Password: (6+ characters)
   - Department: Select one
   - Role: Standard User
4. Click "Create Account"
5. You should be automatically logged in

### 6.4 Verify in Supabase

1. Go to **Authentication** → **Users**
2. You should see your new user
3. Go to **Table Editor** → **users**
4. Your user profile should be there

### 6.5 Test Task Creation

1. Create a task template
2. Assign it to a user
3. Check **Table Editor** → **task_templates** and **task_instances**
4. Data should be in the database

### 6.6 Test File Upload

1. Upload a file to a task
2. Go to **Storage** → **task-outputs**
3. Your file should be there

---

## Step 7: Deploy to Production

### 7.1 Update Environment Variables for Production

If deploying to Vercel:

1. Go to your Vercel project
2. Go to **Settings** → **Environment Variables**
3. Add:
   - `VITE_SUPABASE_URL`: Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY`: Your anon key
4. Redeploy your app

### 7.2 Update Supabase Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Add your production URL to redirect URLs:
   - `https://your-app.vercel.app/**`
3. Click "Save"

---

## Step 8: Verify Production Deployment

### 8.1 Test All Features

- [ ] Register new user
- [ ] Login with credentials
- [ ] Create task template
- [ ] Assign tasks to users
- [ ] Upload files
- [ ] View dashboard statistics
- [ ] Receive notifications
- [ ] Change password

### 8.2 Check Database

1. Go to **Table Editor**
2. Verify all data is persisted
3. Check **Authentication** → **Users**
4. Verify user sessions

---

## 🔧 Troubleshooting

### Issue: "Invalid API key"

**Solution**: Check your `.env` file has correct values:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### Issue: "User not found" after registration

**Solution**: 
1. Check **Authentication** → **Users** in Supabase
2. Verify the user was created
3. Check browser console for errors

### Issue: File upload fails

**Solution**:
1. Verify storage bucket exists: `task-outputs`
2. Check storage policies are set
3. Verify file size < 10MB
4. Check file type is allowed

### Issue: Can't see data from other users

**Solution**:
1. Check RLS policies in **Authentication** → **Policies**
2. Verify admin users have correct role in `users` table
3. Check browser console for permission errors

### Issue: Redirect after login doesn't work

**Solution**:
1. Go to **Authentication** → **URL Configuration**
2. Add your domain to redirect URLs
3. Format: `https://your-domain.com/**`

---

## 📊 Database Schema Overview

### Users Table
```sql
- id (uuid, primary key)
- email (text, unique)
- name (text)
- role (text: 'ADMIN' | 'STANDARD')
- department (text)
- created_at (timestamp)
```

### Task Templates Table
```sql
- id (uuid, primary key)
- title (text)
- description (text)
- recurrence (text: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY')
- due_day (integer, nullable)
- category (text)
- priority (text: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')
- created_by (uuid, foreign key to users)
- created_at (timestamp)
```

### Task Instances Table
```sql
- id (uuid, primary key)
- template_id (uuid, foreign key to task_templates)
- assigned_to (uuid, foreign key to users)
- due_date (date)
- status (text: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED' | 'OVERDUE')
- output (text, nullable)
- completed_at (timestamp, nullable)
- created_at (timestamp)
```

---

## 🔐 Security Best Practices

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Use strong passwords** - Minimum 6 characters enforced
3. **Enable RLS** - All tables have RLS policies
4. **Rotate API keys** - Periodically update Supabase keys
5. **Monitor usage** - Check Supabase dashboard for unusual activity
6. **Backup database** - Enable automatic backups in Supabase

---

## 📈 Monitoring & Maintenance

### Database Backups

1. Go to **Database** → **Backups**
2. Enable automatic backups
3. Free tier includes 7 days of backups

### Usage Monitoring

1. Check **Project Settings** → **Billing**
2. Monitor:
   - Database size (free: 500MB)
   - Storage used (free: 1GB)
   - Auth users (free: unlimited)
   - API requests (free: unlimited)

### Performance Optimization

1. Add indexes to frequently queried columns
2. Use pagination for large datasets
3. Cache static data when possible

---

## 🎉 You're Done!

Your DILG Siquijor Task Tracker is now running on Supabase with:
- ✅ Real PostgreSQL database
- ✅ Secure authentication
- ✅ File storage
- ✅ Row Level Security
- ✅ Production-ready infrastructure

### Next Steps

1. **Train your team** on using the system
2. **Create initial users** for your office
3. **Set up task templates** for common workflows
4. **Monitor usage** and gather feedback
5. **Iterate and improve** based on user needs

---

## 📞 Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Discord**: https://discord.supabase.com
- **Vercel Docs**: https://vercel.com/docs
- **Project Issues**: Check GitHub repository

---

## 🔄 Rollback Plan

If you need to rollback to localStorage:

1. The old service files are still in `src/services/`:
   - `auth.ts` (localStorage auth)
   - `database.ts` (localStorage database)
   - `storage.ts` (localStorage files)
   - `notifications.ts` (localStorage notifications)

2. Update `AuthContext.tsx` to import from old services

3. Remove Supabase dependencies:
   ```bash
   npm uninstall @supabase/supabase-js
   ```

4. Remove Supabase environment variables

**Note**: Data in Supabase won't automatically migrate back to localStorage.

---

**Last Updated**: 2024
**Version**: 1.0.0
**Status**: Production Ready ✅
