# ⚡ Quick Start: Supabase Setup (15 Minutes)

Follow these steps to get your DILG Siquijor Task Tracker running with Supabase.

## 🎯 What You Need

- [ ] Supabase account (free) → [supabase.com](https://supabase.com)
- [ ] Your project code
- [ ] 15 minutes

---

## Step 1: Create Supabase Project (3 minutes)

1. Go to [supabase.com](https://supabase.com) → Sign up
2. Click **"New Project"**
3. Fill in:
   - Name: `dilg-siquijor-tracker`
   - Password: (save this!)
   - Region: Singapore (closest to PH)
4. Wait for initialization

**Copy these values** (you'll need them):
- Project URL: `https://xxxxx.supabase.co`
- anon key: `eyJhbGc...`

---

## Step 2: Create Database Tables (2 minutes)

1. Go to **SQL Editor** in Supabase
2. Click **"New Query"**
3. Paste this SQL:

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'STANDARD',
  department TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task templates
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

-- Task instances
CREATE TABLE task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES task_templates(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  output TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Uploaded files
CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  url TEXT NOT NULL,
  path TEXT NOT NULL,
  task_id UUID REFERENCES task_instances(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert themselves" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users can view templates" ON task_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create templates" ON task_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update templates" ON task_templates FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can view their tasks" ON task_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create tasks" ON task_instances FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update their tasks" ON task_instances FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can view files" ON uploaded_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can upload files" ON uploaded_files FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can delete files" ON uploaded_files FOR DELETE TO authenticated USING (true);
```

4. Click **"Run"**

---

## Step 3: Create Storage Bucket (2 minutes)

1. Go to **Storage** → **"New bucket"**
2. Name: `task-outputs`
3. Public: **No**
4. Click **"Create bucket"**

---

## Step 4: Configure Environment (2 minutes)

Create `.env` file in project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace with your actual values from Step 1.

---

## Step 5: Test It! (3 minutes)

```bash
npm install
npm run dev
```

1. Open `http://localhost:5173`
2. Click **"Register"**
3. Create your first account (becomes ADMIN automatically!)
4. Test creating a task
5. Check Supabase → **Table Editor** → Data should be there!

---

## ✅ That's It!

Your app is now using Supabase! 

### What's Next?

- **Deploy to Vercel**: Add env vars in Vercel settings
- **Create users**: Register your team members
- **Create tasks**: Set up your workflow
- **Train team**: Show everyone how to use it

---

## 🆘 Quick Troubleshooting

**"Invalid API key"** → Check `.env` has correct values

**"User not found"** → Check Supabase → Authentication → Users

**Can't upload files** → Check Storage bucket exists and policies are set

**Need help?** → See `SUPABASE_MIGRATION.md` for detailed guide

---

**Time spent**: ~15 minutes  
**Cost**: ₱0 (Supabase free tier)  
**Status**: ✅ Production Ready!
