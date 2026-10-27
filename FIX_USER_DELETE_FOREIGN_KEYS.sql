-- ============================================================
-- FIX: /api/admin-delete-user returns HTTP 500 when deleting a user
-- ============================================================
-- Symptom in the app:
--   "Failed to delete user: The delete endpoint returned HTTP 500.
--    Check the Vercel function logs for /api/admin-delete-user."
--
-- Root cause (server-side, NOT RLS):
--   Deleting public.users fails with PostgreSQL error 23503
--   (foreign_key_violation) whenever some table still references the
--   user's id through a constraint that was created WITHOUT
--   "ON DELETE CASCADE". Which tables those are depends on which setup
--   scripts were run against this project:
--     * DATABASE_SETUP.sql            -> task_instances.assigned_to,
--                                        task_templates.created_by,
--                                        uploaded_files.uploaded_by
--     * supabase/migrations/001_...   -> users.role is the "Role" ENUM,
--                                        which has no SUPER_ADMIN label
--                                        (error 22P02: invalid input value
--                                        for enum type "Role")
--   Because Postgres refuses the DELETE, the Supabase client returns an
--   error and api/admin-delete-user.ts answered with a bare HTTP 500.
--
-- What this script does (idempotent, safe to re-run):
--   A. Converts public.users.role from the "Role" ENUM to plain TEXT and
--      adds a CHECK constraint allowing SUPER_ADMIN / ADMIN / STANDARD.
--      This removes both the 22P02 enum errors and the missing-SUPER_ADMIN
--      problem, without dropping any data.
--   B. Rebuilds EVERY foreign key that references public.users(id) as
--      ON DELETE CASCADE (discovered from the live catalog, so tables you
--      added later are covered too). Child rows then disappear with the
--      profile automatically.
--   C. Creates public.admin_find_user_references(), the helper the
--      serverless function calls to self-heal if an unknown FK still blocks
--      a delete. It is SECURITY DEFINER but restricted to the service_role
--      and postgres roles, so anon/authenticated callers cannot use it.
--   D. Re-installs the admin RLS policies from FIX_USER_DELETE_PERMISSIONS.sql
--      (only needed if that file was never run; the fallback path uses them).
--
-- Run this FIRST, then redeploy nothing else — the updated
-- api/admin-delete-user.ts handles the rest.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- A) users.role: ENUM "Role" -> TEXT + three-tier CHECK
-- ------------------------------------------------------------
DO $$
DECLARE
  v_typedata oid;
BEGIN
  SELECT atttypid INTO v_typedata
  FROM pg_attribute
  WHERE attrelid = 'public.users'::regclass AND attname = 'role';

  IF v_typedata IS NULL THEN
    RETURN; -- no users.role column in this project: nothing to convert
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE oid = v_typedata AND typtype = 'e') THEN
    ALTER TABLE public.users
      ALTER COLUMN role TYPE TEXT USING role::text;

    ALTER TABLE public.users
      ALTER COLUMN role SET DEFAULT 'STANDARD';
  END IF;
END $$;

-- Make sure the column exists at all (very old projects).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'STANDARD';

-- Normalize casing ('admin' / 'Admin' -> 'ADMIN') so the CHECK below holds.
UPDATE public.users SET role = upper(role::text) WHERE role::text <> upper(role::text);

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'STANDARD'));

-- The legacy "Role" enum is no longer referenced by anything.
DROP TYPE IF EXISTS public."Role";

-- ------------------------------------------------------------
-- B) Force every FK pointing at public.users(id) to ON DELETE CASCADE
-- ------------------------------------------------------------
DO $$
DECLARE
  r         RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS ref_schema,
           rel.relname AS ref_table,
           get.attname AS ref_column,
           con.conname AS conname
    FROM pg_constraint con
    JOIN pg_class        rel  ON rel.oid  = con.conrelid
    JOIN pg_namespace    n    ON n.oid    = rel.relnamespace
    JOIN pg_class        frel ON frel.oid = con.confrelid
    JOIN pg_namespace    fn   ON fn.oid   = frel.relnamespace
    JOIN LATERAL (
      SELECT a.attname
      FROM pg_attribute a
      WHERE a.attrelid = con.conrelid
        AND a.attnum = ANY (con.conkey)
      LIMIT 1
    ) get ON true
    WHERE con.contype = 'f'
      AND fn.nspname = 'public'
      AND frel.relname = 'users'
      AND n.nspname NOT IN ('information_schema', 'pg_catalog')
  LOOP
    -- Already CASCADE? leave it alone.
    IF EXISTS (
      SELECT 1 FROM pg_constraint c2
      WHERE c2.conname = r.conname
        AND c2.conrelid = format('%I.%I', r.ref_schema, r.ref_table)::regclass
        AND c2.confdeltype = 'c'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
                   r.ref_schema, r.ref_table, r.conname);
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users(id) ON DELETE CASCADE',
      r.ref_schema, r.ref_table, r.conname, r.ref_column);

    RAISE NOTICE 'Re-created %.(%) -> users.id as ON DELETE CASCADE',
      r.ref_table, r.ref_column;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- C) Discovery RPC used by api/admin-delete-user.ts
--    Returns every table/column that still references public.users(id),
--    preferring the deepest child tables so the caller can clean them in
--    one pass. The p_user_id argument is only a validity guard: listing
--    constraints does not depend on it, but the function refuses to run
--    without a real uuid.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_find_user_references(p_user_id uuid)
RETURNS TABLE(schema text, table_name text, column_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE refs AS (
    -- direct children of public.users
    SELECT con.conrelid, get.attname, 1 AS depth
    FROM pg_constraint con
    JOIN pg_class frel ON frel.oid = con.confrelid
    JOIN pg_namespace fn ON fn.oid = frel.relnamespace
    JOIN LATERAL (
      SELECT a.attname
      FROM pg_attribute a
      WHERE a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
      LIMIT 1
    ) get ON true
    WHERE con.contype = 'f' AND fn.nspname = 'public' AND frel.relname = 'users'

    UNION ALL

    -- ...and their own children, so nothing is left dangling
    SELECT con.conrelid, get.attname, r.depth + 1
    FROM refs r
    JOIN pg_constraint con ON con.contype = 'f' AND con.confrelid = r.conrelid
    JOIN LATERAL (
      SELECT a.attname
      FROM pg_attribute a
      WHERE a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
      LIMIT 1
    ) get ON true
    WHERE r.depth < 4
  )
  SELECT n.nspname::text, rel.relname::text, x.attname::text
  FROM (SELECT DISTINCT conrelid, attname FROM refs WHERE p_user_id IS NOT NULL) x
  JOIN pg_class     rel ON rel.oid  = x.conrelid
  JOIN pg_namespace n   ON n.oid    = rel.relnamespace
  ORDER BY x.attname, rel.relname;
$$;

REVOKE ALL ON FUNCTION public.admin_find_user_references(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_find_user_references(uuid) TO service_role, postgres;

-- ------------------------------------------------------------
-- D) Admin RLS policies (fallback path only — harmless to re-run).
--    Needs the get_current_user_role() helper, so define it here too.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_user_email(p_uid uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cols  text[];
  v_email text;
BEGIN
  IF p_uid IS NULL THEN RETURN NULL; END IF;
  SELECT array_agg(attname) INTO v_cols
    FROM pg_attribute
   WHERE attrelid = 'auth.users'::regclass
     AND attname IN ('email', 'raw_email')
     AND NOT attisdropped;
  IF v_cols IS NULL THEN RETURN NULL; END IF;
  IF 'raw_email' = ANY (v_cols) THEN
    BEGIN EXECUTE 'SELECT lower(raw_email) FROM auth.users WHERE id = $1' INTO v_email USING p_uid;
    EXCEPTION WHEN undefined_column THEN v_email := NULL; END;
  END IF;
  IF v_email IS NULL AND 'email' = ANY (v_cols) THEN
    BEGIN EXECUTE 'SELECT lower(email) FROM auth.users WHERE id = $1' INTO v_email USING p_uid;
    EXCEPTION WHEN undefined_column THEN v_email := NULL; END;
  END IF;
  RETURN v_email;
END $$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.role::text
  FROM public.users u
  WHERE u.id = (SELECT auth.uid())
     OR (u.email IS NOT NULL
         AND lower(u.email) = coalesce(public.auth_user_email((SELECT auth.uid())), '')
         AND (SELECT auth.uid()) IS NOT NULL)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
CREATE POLICY "users_delete_admin" ON public.users FOR DELETE TO authenticated
USING (
  id <> (SELECT auth.uid())
  AND (
    public.get_current_user_role() = 'SUPER_ADMIN'
    OR (public.get_current_user_role() = 'ADMIN' AND role::text <> 'SUPER_ADMIN')
  )
);

COMMIT;

-- ------------------------------------------------------------
-- Verification: run these and check the output
-- ------------------------------------------------------------
-- 1) role must be 'text' (never the "Role" enum again):
SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS type
FROM pg_attribute a
WHERE a.attrelid = 'public.users'::regclass AND a.attname = 'role';

-- 2) every FK on public.users must show confdeltype = 'c' (CASCADE):
SELECT con.conname, rel.relname AS child_table, confdeltype
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_class f   ON f.oid   = con.confrelid
WHERE con.contype = 'f' AND f.relname = 'users';

-- 3) the discovery RPC is callable by the service role:
SELECT public.admin_find_user_references(gen_random_uuid());
