-- DILG Tracker Database Migration
-- Made fully idempotent (safe to run multiple times)

-- ==========================================
-- 1. ENUMS (Safe to run multiple times)
-- ==========================================
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('ADMIN', 'STANDARD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'OVERDUE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RecurrenceType" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- 2. TABLES (Added IF NOT EXISTS)
-- ==========================================
CREATE TABLE IF NOT EXISTS "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "password" VARCHAR(255) NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'STANDARD',
  "department" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "task_templates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" VARCHAR(500) NOT NULL,
  "description" TEXT,
  "recurrence" "RecurrenceType" NOT NULL DEFAULT 'ONCE',
  "due_day" INTEGER CHECK (due_day >= 1 AND due_day <= 31),
  "category" VARCHAR(100) NOT NULL,
  "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
  "created_by" VARCHAR(255) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "task_instances" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "template_id" UUID NOT NULL REFERENCES "task_templates"("id") ON DELETE CASCADE,
  "due_date" DATE NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
  "output" TEXT,
  "completed_at" DATE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "task_assignments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "instance_id" UUID NOT NULL REFERENCES "task_instances"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  UNIQUE("instance_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" VARCHAR(50) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "message" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "user_id" UUID REFERENCES "users"("id") ON DELETE CASCADE,
  "link" VARCHAR(500),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "uploaded_files" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(500) NOT NULL,
  "type" VARCHAR(100) NOT NULL,
  "size" INTEGER NOT NULL,
  "url" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "task_id" UUID REFERENCES "task_instances"("id") ON DELETE SET NULL,
  "uploaded_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "scheduler_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "run_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "generated" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "errors" TEXT[] DEFAULT '{}',
  "duration_ms" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "email_config" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "reminder_days" INTEGER NOT NULL DEFAULT 3,
  "overdue_alert" BOOLEAN NOT NULL DEFAULT true,
  "completion_alert" BOOLEAN NOT NULL DEFAULT true,
  "daily_digest" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. INDEXES (Added IF NOT EXISTS)
-- ==========================================
CREATE INDEX IF NOT EXISTS "idx_task_instances_template" ON "task_instances"("template_id");
CREATE INDEX IF NOT EXISTS "idx_task_instances_due_date" ON "task_instances"("due_date");
CREATE INDEX IF NOT EXISTS "idx_task_instances_status" ON "task_instances"("status");
CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications"("user_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_read" ON "notifications"("read");
CREATE INDEX IF NOT EXISTS "idx_uploaded_files_task" ON "uploaded_files"("task_id");

-- ==========================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "uploaded_files" ENABLE ROW LEVEL SECURITY;

-- Policies (Added IF NOT EXISTS for PostgreSQL 15+)
CREATE POLICY IF NOT EXISTS "Users can view all" ON "users" FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Admins can manage users" ON "users" FOR ALL USING (
  EXISTS (SELECT 1 FROM "users" WHERE "id" = auth.uid() AND "role" = 'ADMIN')
);

CREATE POLICY IF NOT EXISTS "Anyone can view templates" ON "task_templates" FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Admins can manage templates" ON "task_templates" FOR ALL USING (
  EXISTS (SELECT 1 FROM "users" WHERE "id" = auth.uid() AND "role" = 'ADMIN')
);

CREATE POLICY IF NOT EXISTS "Users see assigned instances" ON "task_instances" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "task_assignments" WHERE "instance_id" = "task_instances"."id" AND "user_id" = auth.uid())
  OR EXISTS (SELECT 1 FROM "users" WHERE "id" = auth.uid() AND "role" = 'ADMIN')
);

CREATE POLICY IF NOT EXISTS "Users see own notifications" ON "notifications" FOR SELECT USING (
  "user_id" = auth.uid() OR "user_id" IS NULL
);
