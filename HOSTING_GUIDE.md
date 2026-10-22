# 🚀 DILG Tracker - Complete Hosting Guide (Step-by-Step)

> **Total Time:** ~45 minutes  
> **Cost:** FREE (all services have generous free tiers)  
> **Difficulty:** Beginner-friendly (just follow the steps)

---

## 📋 What You'll Need Before Starting

| Item | Where to Get | Cost |
|------|-------------|------|
| GitHub Account | github.com | Free |
| Supabase Account | supabase.com | Free |
| Vercel Account | vercel.com | Free |
| Node.js (v18+) | nodejs.org | Free |
| Git | git-scm.com | Free |
| A Domain (optional) | namecheap.com / freenom.com | ~₱500/year or free |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    YOUR USERS                        │
│         (Access via dilg-tracker.vercel.app)         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              VERCEL (Frontend Hosting)               │
│    • Hosts your React app                           │
│    • Free SSL certificate (HTTPS)                   │
│    • Global CDN (fast worldwide)                    │
│    • Auto-deploys from GitHub                       │
└──────────────────────┬──────────────────────────────┘
                       │ API Calls
                       ▼
┌─────────────────────────────────────────────────────┐
│              SUPABASE (Backend)                      │
│    • PostgreSQL Database                            │
│    • Authentication (Login/Signup)                  │
│    • File Storage (Task attachments)                │
│    • Real-time updates                              │
│    • Edge Functions (Cron scheduler)                │
└─────────────────────────────────────────────────────┘
```

---

# STEP 1: Prepare Your Code for Deployment

## 1.1 Create a Production-Ready Service Layer

First, update the database service to work with Supabase in production:

```bash
# Install Supabase client
npm install @supabase/supabase-js
```

Create the file `src/services/supabaseClient.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);
```

## 1.2 Create Environment Files

Create `.env.production` in your project root:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> ⚠️ **IMPORTANT:** Never commit `.env` files to GitHub!  
> Add `.env` and `.env.production` to your `.gitignore`

## 1.3 Update `.gitignore`

```gitignore
# Dependencies
node_modules/

# Build output
dist/

# Environment (NEVER commit secrets)
.env
.env.local
.env.production

# IDE
.vscode/
.idea/

# OS files
.DS_Store
Thumbs.db

# Logs
*.log
```

---

# STEP 2: Push Code to GitHub

## 2.1 Initialize Git Repository

```bash
# In your project folder
git init
git add .
git commit -m "Initial commit: DILG Tracker application"
```

## 2.2 Create GitHub Repository

1. Go to **https://github.com/new**
2. Fill in:
   - **Repository name:** `dilg-tracker`
   - **Description:** `Department of the Interior and Local Government - Task Tracker`
   - **Visibility:** Private (recommended for government projects)
   - ❌ Do NOT check "Add a README"
3. Click **Create repository**

## 2.3 Push Your Code

```bash
# Connect to GitHub (replace YOUR-USERNAME)
git remote add origin https://github.com/YOUR-USERNAME/dilg-tracker.git
git branch -M main
git push -u origin main
```

✅ **Your code is now on GitHub!**

---

# STEP 3: Set Up Supabase (Database + Backend)

## 3.1 Create Supabase Project

1. Go to **https://supabase.com** → Sign up (use GitHub)
2. Click **"New Project"**
3. Fill in:
   - **Organization:** Select yours
   - **Project name:** `dilg-tracker`
   - **Database password:** (save this somewhere safe!)
   - **Region:** Southeast Asia (Singapore) — closest to Philippines
   - **Pricing plan:** Free
4. Click **"Create new project"**
5. Wait ~2 minutes for it to initialize

## 3.2 Get Your API Keys

1. Go to **Settings** (gear icon) → **API**
2. Copy these values:
   - **Project URL** → `https://xxxxx.supabase.co`
   - **anon public key** → `eyJhbGciOi...`

## 3.3 Run the Database Migration

1. Go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Click **"Run"** (or press Ctrl+Enter)

You should see: ✅ "Success. No rows returned"

## 3.4 Verify Tables Were Created

1. Go to **Table Editor** (left sidebar)
2. You should see these tables:
   - ✅ `users`
   - ✅ `task_templates`
   - ✅ `task_instances`
   - ✅ `task_assignments`
   - ✅ `notifications`
   - ✅ `uploaded_files`
   - ✅ `scheduler_logs`
   - ✅ `email_config`

## 3.5 Seed Initial Data

Run this SQL in the SQL Editor:

```sql
-- Insert admin user (password will be set via Supabase Auth)
INSERT INTO "users" ("id", "email", "name", "password", "role", "department")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@dilg.gov.ph',
  'Maria Santos',
  'admin123',
  'ADMIN',
  'Central Office'
);

-- Insert sample standard users
INSERT INTO "users" ("id", "email", "name", "password", "role", "department")
VALUES 
  ('00000000-0000-0000-0000-000000000002', 'juan.cruz@dilg.gov.ph', 'Juan Cruz', 'user123', 'STANDARD', 'Regional Office - NCR'),
  ('00000000-0000-0000-0000-000000000003', 'ana.reyes@dilg.gov.ph', 'Ana Reyes', 'user123', 'STANDARD', 'Regional Office - Region III'),
  ('00000000-0000-0000-0000-000000000004', 'pedro.garcia@dilg.gov.ph', 'Pedro Garcia', 'user123', 'STANDARD', 'Regional Office - Region VII');

-- Insert sample task templates
INSERT INTO "task_templates" ("id", "title", "description", "recurrence", "due_day", "category", "priority", "created_by")
VALUES
  ('t1', 'Submit Monthly Accomplishment Report', 'Monthly report detailing accomplishments', 'MONTHLY', 25, 'Reporting', 'HIGH', '00000000-0000-0000-0000-000000000001'),
  ('t2', 'Quarterly Performance Review', 'Quarterly review of KPIs', 'QUARTERLY', 15, 'Performance', 'CRITICAL', '00000000-0000-0000-0000-000000000001'),
  ('t3', 'Update LGU Compliance Dashboard', 'Weekly compliance tracking update', 'WEEKLY', 5, 'Monitoring', 'MEDIUM', '00000000-0000-0000-0000-000000000001');
```

## 3.6 Create Storage Bucket

1. Go to **Storage** (left sidebar)
2. Click **"New bucket"**
3. Fill in:
   - **Name:** `task-outputs`
   - **Public:** ❌ OFF (keep private)
   - **File size limit:** `10485760` (10MB)
   - **Allowed MIME types:** `image/jpeg,image/png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document`
4. Click **"Create bucket"**

## 3.7 Set Up Supabase Auth (Optional but Recommended)

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. In **Authentication** → **URL Configuration**:
   - Site URL: `https://your-app.vercel.app` (you'll update this later)
   - Redirect URLs: `https://your-app.vercel.app/**`

---

# STEP 4: Deploy Frontend to Vercel

## 4.1 Connect GitHub to Vercel

1. Go to **https://vercel.com** → Sign up (use GitHub)
2. Click **"Add New..."** → **"Project"**
3. Find your `dilg-tracker` repository → Click **"Import"**

## 4.2 Configure Build Settings

Vercel will auto-detect Vite. Verify these settings:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |
| **Node Version** | 18.x |

## 4.3 Add Environment Variables

In the Vercel deployment settings, add these environment variables:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` (your anon key) |

> 💡 **How to add:** Click "Environment Variables" → Add each one

## 4.4 Deploy!

1. Click **"Deploy"**
2. Wait ~2-3 minutes
3. You'll get a URL like: `https://dilg-tracker-xxxx.vercel.app`

✅ **Your app is now LIVE on the internet!**

## 4.5 Verify It Works

1. Open your Vercel URL
2. You should see the **Public Dashboard**
3. Click "Staff Login"
4. Login with `admin@dilg.gov.ph` / `admin123`
5. You should see the Admin Dashboard

---

# STEP 5: Set Up Custom Domain (Optional)

## Option A: Free Subdomain (Vercel provides this)

Your app is already live at: `https://dilg-tracker-xxxx.vercel.app`

## Option B: Custom Domain (e.g., dilg-tracker.gov.ph)

### 5.1 Buy a Domain

- **Recommended:** Namecheap, GoDaddy, or .gov.ph domain from dot.gov.ph
- **Cost:** ~₱500-1500/year for .ph domains

### 5.2 Add Domain to Vercel

1. Go to your Vercel project → **Settings** → **Domains**
2. Enter your domain: `dilg-tracker.gov.ph`
3. Vercel will show DNS records to add

### 5.3 Configure DNS

In your domain registrar's DNS settings, add:

| Type | Name | Value |
|------|------|-------|
| **A** | `@` | `76.76.21.21` |
| **CNAME** | `www` | `cname.vercel-dns.com` |

### 5.4 Wait for DNS Propagation

- Takes 5 minutes to 48 hours
- Check status: `https://dnschecker.org`
- Vercel will auto-provision SSL certificate

---

# STEP 6: Set Up Automated Scheduler (Cron Job)

## 6.1 Create Vercel Cron Configuration

Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/scheduler",
      "schedule": "0 0 * * *"
    }
  ]
}
```

## 6.2 Create the API Route

Create `api/scheduler.ts` (or use Supabase Edge Functions):

```typescript
// For Vercel serverless functions
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Import and run your scheduler logic
  // This would call your Supabase database
  
  res.status(200).json({ 
    success: true, 
    message: 'Scheduler executed',
    timestamp: new Date().toISOString()
  });
}
```

## Alternative: Use Supabase Cron (Recommended)

1. Go to Supabase → **Database** → **Extensions**
2. Enable `pg_cron` extension
3. Run in SQL Editor:

```sql
-- Run scheduler every day at midnight
SELECT cron.schedule(
  'daily-task-scheduler',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.scheduler_url'),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

---

# STEP 7: Set Up Email Notifications

## 7.1 Using Resend (Recommended - Free tier: 3000 emails/month)

1. Sign up at **https://resend.com**
2. Get your API key
3. Add to Vercel environment variables: `RESEND_API_KEY`

## 7.2 Using SendGrid (Alternative)

1. Sign up at **https://sendgrid.com**
2. Create API key
3. Add to Vercel: `SENDGRID_API_KEY`

---

# STEP 8: Post-Deployment Checklist

## ✅ Security
- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Change default admin password
- [ ] Set up 2FA for admin accounts
- [ ] Review Supabase API keys (rotate if exposed)
- [ ] Enable Vercel's DDoS protection (automatic)

## ✅ Performance
- [ ] Enable Vercel Analytics
- [ ] Set up Supabase CDN
- [ ] Add image optimization
- [ ] Enable gzip compression (Vercel does this automatically)

## ✅ Monitoring
- [ ] Set up Vercel Analytics (free)
- [ ] Add Sentry for error tracking
- [ ] Set up Supabase logs monitoring
- [ ] Create uptime monitoring (use UptimeRobot - free)

## ✅ Backup
- [ ] Enable Supabase daily backups (free tier includes 7 days)
- [ ] Set up GitHub branch protection
- [ ] Document recovery procedures

---

# 🆘 Troubleshooting

## Problem: "Module not found" after deployment
```bash
# Solution: Make sure all dependencies are in package.json (not devDependencies)
npm install @supabase/supabase-js
```

## Problem: Environment variables not working
```bash
# Solution: In Vercel, you need to REDEPLOY after adding env vars
# Go to Deployments → Latest → Redeploy
```

## Problem: Database connection errors
```bash
# Solution: Check your Supabase URL and key are correct
# Go to Supabase → Settings → API → Copy Project URL and anon key
```

## Problem: CORS errors
```bash
# Solution: In Supabase → Authentication → URL Configuration
# Add your Vercel URL to "Redirect URLs"
```

## Problem: File uploads failing
```bash
# Solution: Check Storage bucket permissions
# Go to Supabase → Storage → task-outputs → Policies
# Make sure INSERT policy allows authenticated users
```

## Problem: Page shows blank after login
```bash
# Solution: Check browser console for errors
# Most likely: missing environment variable or wrong API key
```

---

# 📊 Cost Breakdown (Free Tier)

| Service | Free Tier Limits | Your Usage |
|---------|-----------------|------------|
| **Vercel** | 100GB bandwidth/month | ✅ More than enough |
| **Supabase** | 500MB database | ✅ Plenty for text data |
| **Supabase Storage** | 1GB files | ✅ Good for documents |
| **Supabase Auth** | 50,000 MAU | ✅ Way more than needed |
| **Supabase Edge Functions** | 500K invocations/month | ✅ More than enough |
| **Domain** | Free (.vercel.app) or ~₱500/yr | Optional |

**Total Monthly Cost: ₱0** (with free tiers)

---

# 🔄 How to Update Your Live Site

Every time you push to GitHub, Vercel auto-deploys:

```bash
# Make your changes locally
git add .
git commit -m "Update: fixed dashboard charts"
git push

# Vercel automatically:
# 1. Detects the push
# 2. Runs npm install
# 3. Runs npm run build
# 4. Deploys to production
# 5. Your live site is updated!
```

---

# 📞 Support Resources

| Resource | Link |
|----------|------|
| Vercel Docs | https://vercel.com/docs |
| Supabase Docs | https://supabase.com/docs |
| Vite Docs | https://vitejs.dev |
| React Docs | https://react.dev |
| Philippine Gov Tech | https://ict.gov.ph |

---

**🎉 Congratulations! Your DILG Tracker is now live and serving the public!**
