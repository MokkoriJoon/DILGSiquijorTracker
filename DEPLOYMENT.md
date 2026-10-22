# DILG Tracker - Deployment Guide

## Production Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL / NETLIFY                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Frontend (React + Vite)                 │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │  │
│  │  │  Pages   │ │Components│ │ Contexts │ │  Services  │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────────┐
│                          SUPABASE                                │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────┐  │
│  │  PostgreSQL   │ │   Storage    │ │    Edge Functions      │  │
│  │  (Database)   │ │   (Files)    │ │  - Scheduler Cron      │  │
│  │              │ │              │ │  - Email Sender         │  │
│  └──────────────┘ └──────────────┘ │  - Deadline Checker     │  │
│  ┌──────────────┐ ┌──────────────┐ └────────────────────────┘  │
│  │    Auth      │ │  Realtime    │                               │
│  │  (Users/RBAC)│ │ (Live updates│                               │
│  └──────────────┘ └──────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     EXTERNAL SERVICES                            │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────┐  │
│  │   SendGrid   │ │  Vercel Cron │ │    Monitoring          │  │
│  │   (Email)    │ │  (Scheduler) │ │   (Sentry/LogRocket)   │  │
│  └──────────────┘ └──────────────┘ └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Step-by-Step Deployment

### 1. Supabase Setup

```bash
# Create a new Supabase project at https://supabase.com
# Then run the migration:
npx supabase db push

# Or manually run the SQL in supabase/migrations/001_initial_schema.sql
# through the Supabase SQL Editor
```

### 2. Environment Variables

```bash
# Create .env file (never commit this!)
cp .env.example .env

# Fill in your Supabase credentials:
# VITE_SUPABASE_URL=https://xxxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### 3. Update Service Layer for Production

Replace the localStorage implementations in `src/services/` with Supabase calls:

```typescript
// Example: src/services/database.ts (production version)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const UserService = {
  async getAll() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return data;
  },
  
  async authenticate(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password
    });
    if (error) throw error;
    return data.user;
  },
  // ... more methods
};
```

### 4. Supabase Storage Setup

```bash
# Create a storage bucket for task outputs
# In Supabase Dashboard → Storage → New Bucket
# Name: task-outputs
# Public: false
# Max file size: 10MB
# Allowed MIME types: image/*, application/pdf, .doc, .docx, .xls, .xlsx
```

### 5. Edge Functions for Scheduler

Create `supabase/functions/scheduler/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  // Get all recurring templates
  const { data: templates } = await supabase
    .from('task_templates')
    .select('*')
    .eq('is_active', true)
    .neq('recurrence', 'ONCE')
  
  let generated = 0
  
  for (const template of templates || []) {
    // Calculate next due date and create instances
    // ... scheduler logic
  }
  
  // Log the run
  await supabase.from('scheduler_logs').insert({
    generated,
    run_at: new Date().toISOString()
  })
  
  return new Response(JSON.stringify({ generated }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### 6. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Or connect your GitHub repo to Vercel for auto-deploys
```

### 7. Set Up Cron Job

In `vercel.json`:

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

Or use Supabase's built-in cron:

```sql
-- In Supabase SQL Editor
SELECT cron.schedule(
  'run-task-scheduler',
  '0 0 * * *',  -- Daily at midnight
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/scheduler',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

### 8. Email Notifications

Set up a Supabase Edge Function for emails:

```typescript
// supabase/functions/send-email/index.ts
import { Resend } from 'https://esm.sh/resend@2'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

Deno.serve(async (req) => {
  const { to, subject, html } = await req.json()
  
  const { data, error } = await resend.emails.send({
    from: 'DILG Tracker <noreply@dilg-tracker.gov.ph>',
    to: [to],
    subject,
    html,
  })
  
  return new Response(JSON.stringify({ data, error }))
})
```

## Security Checklist

- [ ] Enable RLS on all tables
- [ ] Use parameterized queries (Prisma handles this)
- [ ] Hash passwords with bcrypt (min 10 rounds)
- [ ] Set up rate limiting on auth endpoints
- [ ] Enable 2FA for admin accounts
- [ ] Set up audit logging
- [ ] Configure CORS properly
- [ ] Use HTTPS only
- [ ] Set secure cookie flags
- [ ] Regular security audits

## Performance Optimization

- [ ] Enable Supabase CDN for static assets
- [ ] Use React.lazy() for code splitting
- [ ] Implement pagination for large task lists
- [ ] Add Redis caching for dashboard stats
- [ ] Use Supabase Realtime for live updates
- [ ] Optimize images with WebP format
- [ ] Enable gzip/brotli compression

## Monitoring

```bash
# Add to your project:
npm install @sentry/react @sentry/tracing
```

Configure Sentry in `main.tsx`:

```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  tracesSampleRate: 0.1,
});
```

## Rollback Plan

1. Keep database migrations versioned
2. Use Supabase's point-in-time recovery
3. Vercel auto-rolls back on failed deployments
4. Keep a staging environment for testing
