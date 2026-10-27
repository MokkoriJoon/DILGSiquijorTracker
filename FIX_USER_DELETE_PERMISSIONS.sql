-- ============================================================
-- FIX: Super Admin cannot delete Registered Users
-- ============================================================
-- Root cause:
--   1. The old "Admins can manage users" policy on public.users only allowed
--      role = 'ADMIN' (never SUPER_ADMIN) and required the caller's
--      auth.uid() to exactly match a users.id row. Registered users created
--      through the app often have NO matching Supabase Auth account (or a
--      different uuid), so auth.uid() is NULL/mismatched and every DELETE is
--      silently rejected by RLS ("delete succeeds, user is still there").
--   2. Removing the corresponding auth.users row requires the service-role
--      key, which can never be done from the browser with the anon key.
--
-- This script (run it in the Supabase SQL Editor):
--   A. Ensures get_current_user_role() exists (same helper as
--      FIX_OLD_USERS_AUTH_RLS.sql - resolves the caller by uid OR email).
--   B. Replaces the users-table policies so SUPER_ADMIN can delete anyone
--      (except themselves) and ADMIN can delete non-SUPER_ADMIN users.
--   C. Adds admin-delete policies on the related tables that reference users,
--      so cleanup no longer fails silently.
--   D. Creates public.get_service_token_hash(), the gated RPC the web app
--      calls to obtain the shared-secret token for the server-side endpoint
--      api/admin-delete-user.ts (the reliable path, because it uses the
--      service role and therefore bypasses RLS entirely).
--
-- After running this file:
--   * Deploy the project (api/admin-delete-user.ts must exist on Vercel).
--   * Set these environment variables on Vercel:
--       SUPABASE_URL              = your project URL
--       SUPABASE_SERVICE_ROLE_KEY = your service role secret
--     Then store its SHA-256 hash in the DB once (see step E at the bottom).
-- ============================================================

-- ------------------------------------------------------------
-- A0) Portable email lookup on auth.users.
--     Supabase renamed auth.users.email to auth.users.raw_email at some
--     point, but MANY current projects still expose ONLY the physical
--     "email" column (no raw_email). Hard-coding either name can throw
--     `42703: column "raw_email" does not exist` depending on the project.
--     This helper inspects the live catalog FIRST and only executes dynamic
--     SQL for columns that actually exist, so it works on BOTH schemas and
--     NEVER throws.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_user_email(p_uid uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cols   text[];
  v_email  text;
BEGIN
  IF p_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Which email-ish columns does THIS project's auth.users actually have?
  SELECT array_agg(attname)
    INTO v_cols
  FROM pg_attribute
  WHERE attrelid = 'auth.users'::regclass
    AND attname IN ('email', 'raw_email')
    AND NOT attisdropped;

  IF v_cols IS NULL OR array_length(v_cols, 1) IS NULL THEN
    RETURN NULL;  -- no usable email column on this project
  END IF;

  -- Prefer raw_email when present (it preserves original casing), else email.
  IF 'raw_email' = ANY (v_cols) THEN
    BEGIN
      EXECUTE 'SELECT lower(raw_email) FROM auth.users WHERE id = $1'
        INTO v_email USING p_uid;
    EXCEPTION WHEN undefined_column THEN
      v_email := NULL;  -- defensive: catalog raced, fall through
    END;
  END IF;

  IF v_email IS NULL AND 'email' = ANY (v_cols) THEN
    BEGIN
      EXECUTE 'SELECT lower(email) FROM auth.users WHERE id = $1'
        INTO v_email USING p_uid;
    EXCEPTION WHEN undefined_column THEN
      v_email := NULL;
    END;
  END IF;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_user_email(uuid) TO authenticated;

-- ------------------------------------------------------------
-- A) Helper: current caller's role (by auth uid, falling back to email)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.role
  FROM public.users u
  WHERE u.id = (SELECT auth.uid())
     OR (
       u.email IS NOT NULL
       AND lower(u.email) = coalesce(public.auth_user_email((SELECT auth.uid())), '')
       AND (SELECT auth.uid()) IS NOT NULL
     )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

-- ------------------------------------------------------------
-- B) users table policies: proper three-tier delete permissions
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "users_select_all" ON public.users;
DROP POLICY IF EXISTS "users_insert_all" ON public.users;
DROP POLICY IF EXISTS "users_update_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_all"
ON public.users FOR SELECT TO authenticated
USING (true);

CREATE POLICY "users_insert_admin"
ON public.users FOR INSERT TO authenticated
WITH CHECK (
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
);

CREATE POLICY "users_update_admin"
ON public.users FOR UPDATE TO authenticated
USING (
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  OR id = (SELECT auth.uid())
)
WITH CHECK (
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  OR id = (SELECT auth.uid())
);

-- Delete rules:
--   * nobody deletes their own row
--   * SUPER_ADMIN deletes anyone
--   * ADMIN deletes everyone except SUPER_ADMIN accounts
CREATE POLICY "users_delete_admin"
ON public.users FOR DELETE TO authenticated
USING (
  id <> (SELECT auth.uid())
  AND (
    public.get_current_user_role() = 'SUPER_ADMIN'
    OR (
      public.get_current_user_role() = 'ADMIN'
      AND role <> 'SUPER_ADMIN'
    )
  )
);

-- ------------------------------------------------------------
-- C) Related tables: let admins clean up rows of a deleted user
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "task_instances_delete_admin" ON public.task_instances;
CREATE POLICY "task_instances_delete_admin"
ON public.task_instances FOR DELETE TO authenticated
USING (
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  OR assigned_to = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "task_assignments_delete_admin" ON public.task_assignments;
CREATE POLICY "task_assignments_delete_admin"
ON public.task_assignments FOR DELETE TO authenticated
USING (
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  OR user_id = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "notifications_delete_admin" ON public.notifications;
CREATE POLICY "notifications_delete_admin"
ON public.notifications FOR DELETE TO authenticated
USING (
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  OR user_id = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "personal_bookmarks_delete_admin" ON public.personal_bookmarks;
CREATE POLICY "personal_bookmarks_delete_admin"
ON public.personal_bookmarks FOR DELETE TO authenticated
USING (
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  OR user_id = (SELECT auth.uid())
);

-- ------------------------------------------------------------
-- D) Gated token RPC used by api/admin-delete-user.ts
--    Returns the precomputed sha256(service_role_key) ONLY when the
--    current session belongs to an ADMIN/SUPER_ADMIN. Standard users and
--    anonymous callers get NULL, so they can never call the endpoint.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_secrets (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
ALTER TABLE public.site_secrets ENABLE ROW LEVEL SECURITY;
-- No policies on site_secrets: only the service role (bypassing RLS) and
-- SECURITY DEFINER functions below can read it.

CREATE OR REPLACE FUNCTION public.get_service_token_hash()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.get_current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('SUPER_ADMIN', 'ADMIN') THEN
    RETURN NULL;
  END IF;
  RETURN (SELECT value FROM public.site_secrets WHERE key = 'admin_token_sha256');
END;
$$;

REVOKE ALL ON FUNCTION public.get_service_token_hash() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_service_token_hash() TO authenticated;

-- ------------------------------------------------------------
-- E1) READY-TO-RUN: stores sha256(SUPABASE_SERVICE_ROLE_KEY) for THIS
--     project so api/admin-delete-user.ts, api/admin-repair-auth.ts and
--     api/admin-create-auth-user.ts authorize immediately after deploy —
--     no need to set VITE_SUPABASE_SERVICE_TOKEN or compute the hash by
--     hand. Safe to re-run any time (upserts).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_secrets (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO public.site_secrets (key, value)
VALUES ('admin_token_sha256',
        'c84e803f879cc4dde676453849ad375abf902c0bb635ee1a2f20109e73001af1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ------------------------------------------------------------
-- E2) (Optional/manual alternative) If you ever rotate the service-role
--     key, recompute its SHA-256 hash (terminal:
--     printf '%s' 'your-service-key' | sha256sum) and update the row:
--
--    In Vercel you already set SUPABASE_SERVICE_ROLE_KEY. Compute its
--    SHA-256 hash (e.g. in a terminal:  printf '%s' 'your-service-key' | sha256sum)
--    and insert it:
--
--      INSERT INTO public.site_secrets (key, value)
--      VALUES ('admin_token_sha256', '<sha256-hex-of-service-role-key>')
--      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
--    Alternatively, if you prefer build-time injection, set
--    VITE_SUPABASE_SERVICE_TOKEN=<sha256-hex> in Vercel instead; the app
--    uses that first and only calls this RPC as a fallback.
-- ------------------------------------------------------------
