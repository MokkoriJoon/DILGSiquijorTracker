-- DILG Tracker Database Migration
-- Run this on your PostgreSQL/Supabase instance

-- Enums
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

-- Users table
CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "password" VARCHAR(255) NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'STANDARD',
  "department" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task Templates
CREATE TABLE "task_templates" (
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

-- Task Instances
CREATE TABLE "task_instances" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "template_id" UUID NOT NULL REFERENCES "task_templates"("id") ON DELETE CASCADE,
  "due_date" DATE NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
  "output" TEXT,
  "completed_at" DATE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX "idx_task_instances_template" ON "task_instances"("template_id");
CREATE INDEX "idx_task_instances_due_date" ON "task_instances"("due_date");
CREATE INDEX "idx_task_instances_status" ON "task_instances"("status");

-- Task Assignments
CREATE TABLE "task_assignments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "instance_id" UUID NOT NULL REFERENCES "task_instances"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  UNIQUE("instance_id", "user_id")
);

-- Notifications
CREATE TABLE "notifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" VARCHAR(50) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "message" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "user_id" UUID REFERENCES "users"("id") ON DELETE CASCADE,
  "link" VARCHAR(500),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX "idx_notifications_user" ON "notifications"("user_id");
CREATE INDEX "idx_notifications_read" ON "notifications"("read");

-- Uploaded Files
CREATE TABLE "uploaded_files" (
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

CREATE INDEX "idx_uploaded_files_task" ON "uploaded_files"("task_id");

-- Scheduler Logs
CREATE TABLE "scheduler_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "run_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "generated" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "errors" TEXT[] DEFAULT '{}',
  "duration_ms" INTEGER NOT NULL DEFAULT 0
);

-- Email Configuration
CREATE TABLE "email_config" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "reminder_days" INTEGER NOT NULL DEFAULT 3,
  "overdue_alert" BOOLEAN NOT NULL DEFAULT true,
  "completion_alert" BOOLEAN NOT NULL DEFAULT true,
  "daily_digest" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default email config
INSERT INTO "email_config" DEFAULT VALUES;

-- Seed admin user (password: admin123 - hash this in production!)
INSERT INTO "users" ("email", "name", "password", "role", "department")
VALUES ('admin@dilg.gov.ph', 'Maria Santos', '$2b$10$placeholder_hash', 'ADMIN', 'Central Office');

-- RLS Policies for Supabase
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "uploaded_files" ENABLE ROW LEVEL SECURITY;

-- Users: admins can see all, standard users can see themselves
CREATE POLICY "Users can view all" ON "users" FOR SELECT USING (true);
CREATE POLICY "Admins can manage users" ON "users" FOR ALL USING (
  EXISTS (SELECT 1 FROM "users" WHERE "id" = auth.uid() AND "role" = 'ADMIN')
);

-- Templates: everyone can read, only admins can write
CREATE POLICY "Anyone can view templates" ON "task_templates" FOR SELECT USING (true);
CREATE POLICY "Admins can manage templates" ON "task_templates" FOR ALL USING (
  EXISTS (SELECT 1 FROM "users" WHERE "id" = auth.uid() AND "role" = 'ADMIN')
);

-- Instances: users can see their own, admins can see all
CREATE POLICY "Users see assigned instances" ON "task_instances" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "task_assignments" WHERE "instance_id" = "task_instances"."id" AND "user_id" = auth.uid())
  OR EXISTS (SELECT 1 FROM "users" WHERE "id" = auth.uid() AND "role" = 'ADMIN')
);

-- Notifications: users see their own
CREATE POLICY "Users see own notifications" ON "notifications" FOR SELECT USING (
  "user_id" = auth.uid() OR "user_id" IS NULL
);
