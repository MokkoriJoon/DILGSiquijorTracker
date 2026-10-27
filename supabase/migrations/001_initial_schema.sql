-- ============================================================
-- DILG Tracker — 001 INITIAL SCHEMA (rebuilt clean)
-- ============================================================
-- This file now MATCHES the live application exactly. The previous
-- version was a Prisma-style schema that the app never used and that
-- actively broke the system:
--   * users.role was the "Role" ENUM with only ADMIN/STANDARD, so
--     SUPER_ADMIN inserts failed (error 22P02);
--   * users.password VARCHAR(255) NOT NULL blocked every profile insert
--     (auth is handled by Supabase Auth; the column is optional legacy);
--   * task_instances had NO assigned_to column, but the app queries
--     users!task_instances_assigned_to_fkey and writes assigned_to;
--   * task_templates / RecurrenceType lacked SEMESTER (used by the UI);
--   * site_settings, personal_bookmarks and site_secrets did not exist;
--   * policies used CREATE POLICY IF NOT EXISTS (invalid syntax before
--     PostgreSQL 15) and role = 'ADMIN' checks that ignored SUPER_ADMIN.
--
-- Design decisions (keep these in mind when editing):
--   * All status/role/priority/recurrence columns are TEXT + CHECK
--     constraints — no Postgres ENUMs. Adding a new label then never
--     requires ALTER TYPE ... unsafe-value gymnastics.
--   * users.id references auth.users(id) ON DELETE CASCADE so deleting an
--     auth user removes the profile automatically.
--   * Every FK into public.users is ON DELETE CASCADE or SET NULL so an
--     admin can always delete a registered user (this was the HTTP 500 on
--     /api/admin-delete-user).
--   * Fully idempotent: safe to run repeatedly from the Supabase SQL
--     Editor, and safe against databases created by the older
--     DATABASE_SETUP.sql / fix scripts (it converts ENUM columns to TEXT
--     instead of failing).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0) Helper functions are installed AFTER the tables exist (see section 3),
--    because get_current_user_role() references public.users at creation
--    time and must not fail on a brand-new database.
-- ------------------------------------------------------------

-- 1.1 users -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'STANDARD',
  department   TEXT NOT NULL DEFAULT '',
  position     TEXT,
  avatar       TEXT,
  password     TEXT, -- OPTIONAL legacy field (custom-login fallback); real auth lives in supabase.auth
  visible      BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Convert legacy ENUM roles to TEXT (never drop data).
DO $$
DECLARE v_typedata oid;
BEGIN
  SELECT atttypid INTO v_typedata
  FROM pg_attribute
  WHERE attrelid = 'public.users'::regclass AND attname = 'role';
  IF v_typedata IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE oid = v_typedata AND typtype = 'e') THEN
    ALTER TABLE public.users ALTER COLUMN role TYPE TEXT USING role::text;
    ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'STANDARD';
  END IF;
END $$;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS position   TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar     TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS visible    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.users ALTER COLUMN department SET DEFAULT '';

UPDATE public.users SET role = upper(role::text) WHERE role::text <> upper(role::text);

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'STANDARD'));

DROP TYPE IF EXISTS public."Role";

-- 1.2 task_templates ----------------------------------------
CREATE TABLE IF NOT EXISTS public.task_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT,
  recurrence        TEXT NOT NULL DEFAULT 'ONCE',
  due_day           INTEGER CHECK (due_day >= 1 AND due_day <= 31),
  template_due_date DATE,               -- chosen date for ONCE tasks
  due_days_of_week  TEXT[],             -- DAILY: which weekdays
  due_time          TEXT,               -- DAILY: HH:MM
  start_date        DATE,               -- DAILY: recurrence start
  category          TEXT NOT NULL DEFAULT 'General',
  priority          TEXT NOT NULL DEFAULT 'MEDIUM',
  resource_link     TEXT,
  visible           BOOLEAN NOT NULL DEFAULT true,
  created_by        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Legacy ENUM conversions -> TEXT (idempotent, keeps data)
DO $$
DECLARE v_typedata oid;
BEGIN
  SELECT atttypid INTO v_typedata
  FROM pg_attribute
  WHERE attrelid = 'public.task_templates'::regclass AND attname = 'recurrence';
  IF v_typedata IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE oid = v_typedata AND typtype = 'e') THEN
    ALTER TABLE public.task_templates ALTER COLUMN recurrence TYPE TEXT USING recurrence::text;
    ALTER TABLE public.task_templates ALTER COLUMN recurrence SET DEFAULT 'ONCE';
  END IF;

  SELECT atttypid INTO v_typedata
  FROM pg_attribute
  WHERE attrelid = 'public.task_templates'::regclass AND attname = 'priority';
  IF v_typedata IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE oid = v_typedata AND typtype = 'e') THEN
    ALTER TABLE public.task_templates ALTER COLUMN priority TYPE TEXT USING priority::text;
    ALTER TABLE public.task_templates ALTER COLUMN priority SET DEFAULT 'MEDIUM';
  END IF;
END $$;

ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS template_due_date DATE;
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS due_days_of_week  TEXT[];
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS due_time          TEXT;
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS start_date        DATE;
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS resource_link     TEXT;
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS visible           BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS is_active         BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.task_templates SET recurrence = upper(recurrence) WHERE recurrence <> upper(recurrence);
UPDATE public.task_templates SET priority   = upper(priority)   WHERE priority   <> upper(priority);

ALTER TABLE public.task_templates DROP CONSTRAINT IF EXISTS task_templates_recurrence_check;
ALTER TABLE public.task_templates
  ADD CONSTRAINT task_templates_recurrence_check
  CHECK (recurrence IN ('ONCE','DAILY','WEEKLY','MONTHLY','QUARTERLY','SEMESTER','YEARLY'));

ALTER TABLE public.task_templates DROP CONSTRAINT IF EXISTS task_templates_priority_check;
ALTER TABLE public.task_templates
  ADD CONSTRAINT task_templates_priority_check
  CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL'));

DROP TYPE IF EXISTS public."RecurrenceType";
DROP TYPE IF EXISTS public."Priority";

-- If an old deployment stored created_by as VARCHAR (not UUID), widen the
-- type mismatch away by re-typing to UUID where possible; if it cannot be
-- cast, leave the column but drop the FK so inserts stop failing.
DO $$
DECLARE v_typename text;
BEGIN
  SELECT format_type(atttypid, NULL) INTO v_typename
  FROM pg_attribute
  WHERE attrelid = 'public.task_templates'::regclass AND attname = 'created_by';
  IF v_typename IS NULL THEN RETURN; END IF;
  IF v_typename <> 'uuid' THEN
    BEGIN
      ALTER TABLE public.task_templates
        ALTER COLUMN created_by TYPE UUID USING NULLIF(created_by::text, '')::uuid;
    EXCEPTION WHEN others THEN
      ALTER TABLE public.task_templates ALTER COLUMN created_by TYPE TEXT;
    END;
  END IF;
END $$;

-- Ensure the FK exists (added idempotently; recreate as SET NULL).
DO $$
DECLARE v_coltype text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.task_templates'::regclass
      AND conname = 'task_templates_created_by_fkey'
  ) THEN
    SELECT format_type(atttypid, NULL) INTO v_coltype
    FROM pg_attribute
    WHERE attrelid = 'public.task_templates'::regclass AND attname = 'created_by';
    IF v_coltype = 'uuid' THEN
      ALTER TABLE public.task_templates
        ADD CONSTRAINT task_templates_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 1.3 task_instances ----------------------------------------
CREATE TABLE IF NOT EXISTS public.task_instances (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  UUID NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  assigned_to  UUID REFERENCES public.users(id) ON DELETE CASCADE,
  due_date     DATE NOT NULL,
  due_time     TEXT,
  status       TEXT NOT NULL DEFAULT 'PENDING',
  output       TEXT,
  completed_at DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE v_typedata oid;
BEGIN
  SELECT atttypid INTO v_typedata
  FROM pg_attribute
  WHERE attrelid = 'public.task_instances'::regclass AND attname = 'status';
  IF v_typedata IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE oid = v_typedata AND typtype = 'e') THEN
    ALTER TABLE public.task_instances ALTER COLUMN status TYPE TEXT USING status::text;
    ALTER TABLE public.task_instances ALTER COLUMN status SET DEFAULT 'PENDING';
  END IF;
END $$;

ALTER TABLE public.task_instances ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.task_instances ADD COLUMN IF NOT EXISTS due_time    TEXT;
ALTER TABLE public.task_instances ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.task_instances SET status = upper(status) WHERE status <> upper(status);

ALTER TABLE public.task_instances DROP CONSTRAINT IF EXISTS task_instances_status_check;
ALTER TABLE public.task_instances
  ADD CONSTRAINT task_instances_status_check
  CHECK (status IN ('PENDING','IN_PROGRESS','SUBMITTED','COMPLETED','OVERDUE'));

DROP TYPE IF EXISTS public."TaskStatus";

-- 1.4 task_assignments --------------------------------------
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  UUID REFERENCES public.task_instances(id) ON DELETE CASCADE,
  template_id  UUID REFERENCES public.task_templates(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.task_assignments ADD COLUMN IF NOT EXISTS template_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.task_assignments'::regclass
      AND conname = 'task_assignments_template_id_fkey'
  ) THEN
    ALTER TABLE public.task_assignments
      ADD CONSTRAINT task_assignments_template_id_fkey
      FOREIGN KEY (template_id) REFERENCES public.task_templates(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 1.5 notifications -----------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL DEFAULT 'info',
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  user_id    UUID REFERENCES public.users(id) ON DELETE CASCADE,
  link       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.6 personal_bookmarks ------------------------------------
CREATE TABLE IF NOT EXISTS public.personal_bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  description TEXT,
  category    TEXT DEFAULT 'General',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.7 uploaded_files ----------------------------------------
CREATE TABLE IF NOT EXISTS public.uploaded_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  size        INTEGER NOT NULL DEFAULT 0,
  url         TEXT NOT NULL,
  path        TEXT NOT NULL,
  task_id     UUID REFERENCES public.task_instances(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.8 scheduler_logs ----------------------------------------
CREATE TABLE IF NOT EXISTS public.scheduler_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated   INTEGER NOT NULL DEFAULT 0,
  skipped     INTEGER NOT NULL DEFAULT 0,
  errors      TEXT[] DEFAULT '{}',
  duration_ms INTEGER NOT NULL DEFAULT 0
);

-- 1.9 email_config ------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled         BOOLEAN NOT NULL DEFAULT false,
  reminder_days   INTEGER NOT NULL DEFAULT 3,
  overdue_alert   BOOLEAN NOT NULL DEFAULT true,
  completion_alert BOOLEAN NOT NULL DEFAULT true,
  daily_digest    BOOLEAN NOT NULL DEFAULT false,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.10 site_settings (single row, Super Admin branding) ------
CREATE TABLE IF NOT EXISTS public.site_settings (
  id               INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_name        TEXT NOT NULL DEFAULT 'D.E.N.N.I.S.',
  site_description TEXT NOT NULL DEFAULT 'Digital Ecosystem for Navigation, Notifications, Information, and Schedules',
  logo_url         TEXT DEFAULT '',
  updated_at       TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.site_settings (id, site_name, site_description, logo_url)
VALUES (1, 'D.E.N.N.I.S.',
        'Digital Ecosystem for Navigation, Notifications, Information, and Schedules', '')
ON CONFLICT (id) DO NOTHING;

-- 1.11 site_secrets (admin shared-secret; service-role only) --
CREATE TABLE IF NOT EXISTS public.site_secrets (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ------------------------------------------------------------
-- 2) HELPER FUNCTIONS (after tables exist)
-- ------------------------------------------------------------
-- Current caller's role, read from public.users. SECURITY INVOKER keeps it
-- honest: callers can only see rows their own SELECT policy allows. Because
-- the users SELECT policy is "USING (true)" there is no recursion risk.
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT upper(coalesce((SELECT u.role::text FROM public.users u WHERE u.id = (SELECT auth.uid())), ''));
$$;

REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN');
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ------------------------------------------------------------
-- 3) INDEXES
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_task_instances_template   ON public.task_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_task_instances_assigned   ON public.task_instances(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_instances_due_date   ON public.task_instances(due_date);
CREATE INDEX IF NOT EXISTS idx_task_instances_status     ON public.task_instances(status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_instance ON public.task_assignments(instance_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user     ON public.task_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user        ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read        ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_task       ON public.uploaded_files(task_id);
CREATE INDEX IF NOT EXISTS idx_personal_bookmarks_user   ON public.personal_bookmarks(user_id);

-- ------------------------------------------------------------
-- 3) KEEP EVERY FK INTO public.users AS ON DELETE CASCADE / SET NULL
--    (prevents the HTTP 500 foreign_key_violation on deletes)
-- ------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS sch, rel.relname AS tbl, con.conname AS cname,
           (SELECT string_agg(a.attname, ', ')
              FROM pg_attribute a
             WHERE a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)) AS cols
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    JOIN pg_class frel ON frel.oid = con.confrelid
    JOIN pg_namespace fn ON fn.oid = frel.relnamespace
    WHERE con.contype = 'f'
      AND fn.nspname = 'public' AND frel.relname = 'users'
      AND n.nspname = 'public'
      AND con.confdeltype NOT IN ('c', 'n')  -- neither CASCADE nor SET NULL
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.sch, r.tbl, r.cname);
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES public.users(id) ON DELETE CASCADE',
      r.sch, r.tbl, r.cname, r.cols
    );
  END LOOP;
END $$;

-- Helper RPC used by api/admin-delete-user.ts to self-heal unknown refs.
CREATE OR REPLACE FUNCTION public.admin_find_user_references(p_user_id uuid)
RETURNS TABLE(table_name text, column_name text, fkey_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.nspname::text, rel.relname::text, get.attname::text
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  JOIN pg_class frel ON frel.oid = con.confrelid
  JOIN pg_namespace fn ON fn.oid = frel.relnamespace
  JOIN LATERAL (SELECT a.attname FROM pg_attribute a
                WHERE a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey) LIMIT 1) get ON true
  WHERE con.contype = 'f' AND fn.nspname = 'public' AND frel.relname = 'users'
    AND n.nspname = 'public';
$$;

REVOKE ALL ON FUNCTION public.admin_find_user_references(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_find_user_references(uuid) TO service_role, postgres;

-- Gated RPC the web app calls to obtain the admin shared-secret token hash.
CREATE OR REPLACE FUNCTION public.get_service_token_hash()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN public.is_admin()
           THEN (SELECT value FROM public.site_secrets WHERE key = 'admin_token_sha256')
         END;
$$;

REVOKE ALL ON FUNCTION public.get_service_token_hash() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_service_token_hash() TO authenticated;

-- Portable email lookup on auth.users (Supabase renamed email -> raw_email
-- in some projects only). Inspects the live catalog so it NEVER throws.
CREATE OR REPLACE FUNCTION public.auth_user_email(p_uid uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cols  text[];
  v_email text;
BEGIN
  IF p_uid IS NULL THEN RETURN NULL; END IF;
  SELECT array_agg(attname::text) INTO v_cols
  FROM pg_attribute
  WHERE attrelid = 'auth.users'::regclass
    AND attnum > 0 AND NOT attisdropped
    AND attname IN ('email', 'raw_email');
  IF v_cols IS NULL THEN RETURN NULL; END IF;
  IF 'email' = ANY (v_cols) THEN
    EXECUTE 'SELECT email FROM auth.users WHERE id = $1' INTO v_email USING p_uid;
  END IF;
  IF v_email IS NULL AND 'raw_email' = ANY (v_cols) THEN
    EXECUTE 'SELECT raw_email FROM auth.users WHERE id = $1' INTO v_email USING p_uid;
  END IF;
  RETURN lower(v_email);
END $$;

REVOKE ALL ON FUNCTION public.auth_user_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_user_email(uuid) TO authenticated, service_role;

-- Powers the "No Auth" badge + Repair Auth button (UserManagement.tsx).
-- Gated to ADMIN/SUPER_ADMIN; SECURITY DEFINER so it may read auth.users.
CREATE OR REPLACE FUNCTION public.get_auth_status(user_ids uuid[])
RETURNS TABLE(id uuid, has_auth boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id,
         EXISTS (
           SELECT 1 FROM auth.users au
           WHERE au.id = u.id OR public.auth_user_email(au.id) = lower(u.email)
         ) AS has_auth
  FROM public.users u
  WHERE u.id = ANY (user_ids)
    AND public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.get_auth_status(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_status(uuid[]) TO authenticated;

-- Used by api/admin-reset-users.ts to discover every FK into public.users.
CREATE OR REPLACE FUNCTION public.get_user_foreign_keys()
RETURNS TABLE(table_name text, column_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rel.relname::text, get.attname::text
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  JOIN pg_class frel ON frel.oid = con.confrelid
  JOIN pg_namespace fn ON fn.oid = frel.relnamespace
  JOIN LATERAL (SELECT a.attname FROM pg_attribute a
                WHERE a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey) LIMIT 1) get ON true
  WHERE con.contype = 'f' AND fn.nspname = 'public' AND frel.relname = 'users'
    AND n.nspname = 'public';
$$;

REVOKE ALL ON FUNCTION public.get_user_foreign_keys() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_foreign_keys() TO service_role, postgres;

-- ------------------------------------------------------------
-- 4) ROW LEVEL SECURITY
-- ------------------------------------------------------------
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_instances   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_files   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduler_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_secrets     ENABLE ROW LEVEL SECURITY;
-- NOTE: no policies on site_secrets on purpose: only the service role
-- (which bypasses RLS) and SECURITY DEFINER functions may read it.

-- users -------------------------------------------------------
DROP POLICY IF EXISTS "users_select_all"     ON public.users;
DROP POLICY IF EXISTS "users_insert_self"    ON public.users;
DROP POLICY IF EXISTS "users_update_self"    ON public.users;
DROP POLICY IF EXISTS "users_admin_delete"   ON public.users;
DROP POLICY IF EXISTS "Users can view all"   ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;

CREATE POLICY "users_select_all" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT TO authenticated WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "users_admin_delete" ON public.users
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- task_templates ----------------------------------------------
DROP POLICY IF EXISTS "templates_select_all" ON public.task_templates;
DROP POLICY IF EXISTS "templates_admin_write" ON public.task_templates;
DROP POLICY IF EXISTS "Anyone can view templates" ON public.task_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON public.task_templates;

CREATE POLICY "templates_select_all" ON public.task_templates
  FOR SELECT USING (true);

CREATE POLICY "templates_admin_write" ON public.task_templates
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- task_instances ----------------------------------------------
DROP POLICY IF EXISTS "instances_select_own_or_admin" ON public.task_instances;
DROP POLICY IF EXISTS "instances_write" ON public.task_instances;
DROP POLICY IF EXISTS "Users see assigned instances" ON public.task_instances;

CREATE POLICY "instances_select_own_or_admin" ON public.task_instances
  FOR SELECT TO authenticated
  USING (
    assigned_to = (SELECT auth.uid())
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.task_assignments ta
               WHERE ta.instance_id = task_instances.id AND ta.user_id = (SELECT auth.uid()))
  );

CREATE POLICY "instances_write" ON public.task_instances
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR assigned_to = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.task_assignments ta
               WHERE ta.instance_id = task_instances.id AND ta.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    public.is_admin()
    OR assigned_to = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.task_assignments ta
               WHERE ta.instance_id = task_instances.id AND ta.user_id = (SELECT auth.uid()))
  );

-- task_assignments --------------------------------------------
DROP POLICY IF EXISTS "assignments_select" ON public.task_assignments;
DROP POLICY IF EXISTS "assignments_write"  ON public.task_assignments;

CREATE POLICY "assignments_select" ON public.task_assignments
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "assignments_write" ON public.task_assignments
  FOR ALL TO authenticated
  USING (public.is_admin() OR user_id = (SELECT auth.uid()))
  WITH CHECK (public.is_admin() OR user_id = (SELECT auth.uid()));

-- notifications -----------------------------------------------
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_write"      ON public.notifications;
DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR user_id IS NULL OR public.is_admin());

CREATE POLICY "notifications_write" ON public.notifications
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

-- personal_bookmarks ------------------------------------------
DROP POLICY IF EXISTS "bookmarks_own" ON public.personal_bookmarks;

CREATE POLICY "bookmarks_own" ON public.personal_bookmarks
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- uploaded_files ----------------------------------------------
DROP POLICY IF EXISTS "files_select" ON public.uploaded_files;
DROP POLICY IF EXISTS "files_write"  ON public.uploaded_files;

CREATE POLICY "files_select" ON public.uploaded_files
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "files_write" ON public.uploaded_files
  FOR ALL TO authenticated
  USING (uploaded_by = (SELECT auth.uid()) OR public.is_admin())
  WITH CHECK (uploaded_by = (SELECT auth.uid()) OR public.is_admin());

-- site_settings ------------------------------------------------
DROP POLICY IF EXISTS "site_settings_read"  ON public.site_settings;
DROP POLICY IF EXISTS "site_settings_super" ON public.site_settings;
DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Only super admins can update site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Only super admins can insert site settings" ON public.site_settings;

CREATE POLICY "site_settings_read" ON public.site_settings
  FOR SELECT USING (true);

CREATE POLICY "site_settings_super" ON public.site_settings
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'SUPER_ADMIN')
  WITH CHECK (public.get_current_user_role() = 'SUPER_ADMIN');

-- scheduler_logs / email_config: service role + admins only ---
DROP POLICY IF EXISTS "logs_admin" ON public.scheduler_logs;
DROP POLICY IF EXISTS "emailcfg_admin" ON public.email_config;

CREATE POLICY "logs_admin" ON public.scheduler_logs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "emailcfg_admin" ON public.email_config
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- 5) GRANTS (anon/authenticated via PostgREST need table access;
--    RLS still decides which rows they actually see)
-- ------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;

COMMIT;

-- ============================================================
-- AFTER RUNNING THIS SCRIPT:
--   1. Run CREATE_SUPERADMIN.sql to seed your SUPER_ADMIN account.
--   2. Then create ADMINs from User Management; STANDARD users register
--      themselves (first-ever registration becomes SUPER_ADMIN — see
--      src/services/auth.ts).
--   3. Redeploy Vercel so SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.
-- ============================================================
