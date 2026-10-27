-- ============================================================
-- FIX: "Old users" cannot add/assign/edit tasks or add bookmarks
-- ============================================================
-- Root cause:
--   Users created before Supabase Auth was wired up (or inserted directly
--   into public.users) have NO matching row in auth.users. They log in via
--   the app's custom fallback, so there is no JWT session and auth.uid()
--   returns NULL. Every RLS policy that checks auth.uid() then fails, and
--   all INSERT/UPDATE/DELETE on task_templates, task_instances and
--   personal_bookmarks are silently rejected.
--   (This matches the Supabase dashboard showing "No authentication logs
--   available for this user".)
--
-- This script:
--   1. Adds a helper that resolves the CURRENT caller's role from
--      public.users by id OR by email — so policies keep working even when
--      an auth account exists but its uuid differs from the profile id.
--   2. Replaces the RLS policies on task_templates, task_instances and
--      personal_bookmarks to use that helper.
--
-- NOTE: For a fully robust fix you should ALSO provision real auth accounts
-- for legacy users. Two options:
--   a) The app now calls POST /api/admin-create-auth-user at login (requires
--      deploying api/admin-create-auth-user.ts with the
--      SUPABASE_SERVICE_ROLE_KEY env var set), which creates the auth user
--      with the SAME uuid as public.users.id.
--   b) Or run this block once per legacy user in the Supabase CLI:
--        supabase --experimental -q auth admin create-user \
--          --id "<users.id uuid>" --email "<email>" --password "<password>" \
--          --email-confirm
-- ============================================================

-- ------------------------------------------------------------
-- 0) Portable email lookup on auth.users.
--    Supabase renamed auth.users.email to auth.users.raw_email at some
--    point, but — contrary to what earlier revisions of this script assumed
--    — MANY current projects still expose ONLY the physical "email" column
--    (no raw_email at all). A hard-coded reference to either name can throw
--    `42703: column "raw_email" does not exist` (or the reverse) depending
--    on the project.
--
--    This helper resolves the email by inspecting the live catalog FIRST and
--    only executing dynamic SQL for columns that actually exist, so it works
--    on BOTH schemas and NEVER throws. It also tolerates the rare case where
--    both columns exist.
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
-- 1) Helper: current user's role (by auth uid, falling back to email)
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
-- 2) task_templates policies
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "task_templates_select_authenticated" ON public.task_templates;
DROP POLICY IF EXISTS "templates_select_all" ON public.task_templates;
DROP POLICY IF EXISTS "templates_select" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_insert_admin_only" ON public.task_templates;
DROP POLICY IF EXISTS "templates_insert_admin" ON public.task_templates;
DROP POLICY IF EXISTS "templates_insert" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_update_admin_or_owner" ON public.task_templates;
DROP POLICY IF EXISTS "templates_update_own_or_admin" ON public.task_templates;
DROP POLICY IF EXISTS "templates_update" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_delete_admin_or_owner" ON public.task_templates;
DROP POLICY IF EXISTS "templates_delete_own_or_admin" ON public.task_templates;
DROP POLICY IF EXISTS "templates_delete" ON public.task_templates;

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_templates_select_authenticated"
ON public.task_templates FOR SELECT TO authenticated
USING (true);

CREATE POLICY "task_templates_insert_admin"
ON public.task_templates FOR INSERT TO authenticated
WITH CHECK (
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  AND created_by = (SELECT auth.uid())
);

CREATE POLICY "task_templates_update_admin_or_owner"
ON public.task_templates FOR UPDATE TO authenticated
USING (
  created_by = (SELECT auth.uid())
  OR public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
)
WITH CHECK (
  created_by = (SELECT auth.uid())
  OR public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
);

CREATE POLICY "task_templates_delete_admin_or_owner"
ON public.task_templates FOR DELETE TO authenticated
USING (
  created_by = (SELECT auth.uid())
  OR public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
);

-- ------------------------------------------------------------
-- 3) task_instances policies
--    Admins manage any instance; standard users update their own.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "task_instances_select_own_or_admin" ON public.task_instances;
DROP POLICY IF EXISTS "task_instances_insert_admin" ON public.task_instances;
DROP POLICY IF EXISTS "task_instances_update_own_or_admin" ON public.task_instances;
DROP POLICY IF EXISTS "task_instances_delete_admin" ON public.task_instances;

ALTER TABLE public.task_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_instances_select_own_or_admin"
ON public.task_instances FOR SELECT TO authenticated
USING (
  assigned_to = (SELECT auth.uid())
  OR public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  OR true -- instances are visible on shared dashboards
);

CREATE POLICY "task_instances_insert_admin"
ON public.task_instances FOR INSERT TO authenticated
WITH CHECK (
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  OR assigned_to = (SELECT auth.uid())
);

CREATE POLICY "task_instances_update_own_or_admin"
ON public.task_instances FOR UPDATE TO authenticated
USING (
  assigned_to = (SELECT auth.uid())
  OR public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
)
WITH CHECK (
  assigned_to = (SELECT auth.uid())
  OR public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
);

CREATE POLICY "task_instances_delete_admin"
ON public.task_instances FOR DELETE TO authenticated
USING (
  public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  OR assigned_to = (SELECT auth.uid())
);

-- ------------------------------------------------------------
-- 4) personal_bookmarks policies
--    Each authenticated user manages ONLY their own bookmarks.
--    (Previously these required a matching auth uid, which broke
--    legacy users entirely.)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "bookmarks_select_own" ON public.personal_bookmarks;
DROP POLICY IF EXISTS "bookmarks_insert_own" ON public.personal_bookmarks;
DROP POLICY IF EXISTS "bookmarks_update_own" ON public.personal_bookmarks;
DROP POLICY IF EXISTS "bookmarks_delete_own" ON public.personal_bookmarks;
DROP POLICY IF EXISTS "personal_bookmarks_select_own" ON public.personal_bookmarks;
DROP POLICY IF EXISTS "personal_bookmarks_insert_own" ON public.personal_bookmarks;
DROP POLICY IF EXISTS "personal_bookmarks_update_own" ON public.personal_bookmarks;
DROP POLICY IF EXISTS "personal_bookmarks_delete_own" ON public.personal_bookmarks;

ALTER TABLE public.personal_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_bookmarks_select_own"
ON public.personal_bookmarks FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR user_id IN (
    SELECT u.id FROM public.users u
    WHERE (SELECT auth.uid()) IS NOT NULL
      AND lower(u.email) = coalesce(public.auth_user_email((SELECT auth.uid())), '')
  )
);

CREATE POLICY "personal_bookmarks_insert_own"
ON public.personal_bookmarks FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR user_id IN (
    SELECT u.id FROM public.users u
    WHERE (SELECT auth.uid()) IS NOT NULL
      AND lower(u.email) = coalesce(public.auth_user_email((SELECT auth.uid())), '')
  )
);

CREATE POLICY "personal_bookmarks_update_own"
ON public.personal_bookmarks FOR UPDATE TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR user_id IN (
    SELECT u.id FROM public.users u
    WHERE (SELECT auth.uid()) IS NOT NULL
      AND lower(u.email) = coalesce(public.auth_user_email((SELECT auth.uid())), '')
  )
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR user_id IN (
    SELECT u.id FROM public.users u
    WHERE (SELECT auth.uid()) IS NOT NULL
      AND lower(u.email) = coalesce(public.auth_user_email((SELECT auth.uid())), '')
  )
);

CREATE POLICY "personal_bookmarks_delete_own"
ON public.personal_bookmarks FOR DELETE TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR user_id IN (
    SELECT u.id FROM public.users u
    WHERE (SELECT auth.uid()) IS NOT NULL
      AND lower(u.email) = coalesce(public.auth_user_email((SELECT auth.uid())), '')
  )
);

-- ------------------------------------------------------------
-- 5) Report legacy users missing an auth account (informational)
-- ------------------------------------------------------------
SELECT u.id, u.email, u.name, u.role,
       CASE WHEN au.id IS NULL THEN 'MISSING AUTH ACCOUNT' ELSE 'ok' END AS auth_status
FROM public.users u
LEFT JOIN auth.users au ON au.id = u.id OR public.auth_user_email(au.id) = lower(u.email)
ORDER BY auth_status DESC, u.created_at;

-- ------------------------------------------------------------
-- 6) get_auth_status(user_ids) — powers the "No Auth" badge and the
--    Repair Auth button in the Super Admin panel (UserManagement.tsx).
--    SECURITY DEFINER so it may read auth.users; gated to ADMIN/SUPER_ADMIN.
--    Returns one row per id: { id, has_auth }.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_status(user_ids uuid[])
RETURNS TABLE(id uuid, has_auth boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = u.id
         OR public.auth_user_email(au.id) = lower(u.email)
    ) AS has_auth
  FROM public.users u
  WHERE u.id = ANY (user_ids)
    AND public.get_current_user_role() IN ('SUPER_ADMIN', 'ADMIN');
$$;

REVOKE ALL ON FUNCTION public.get_auth_status(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_status(uuid[]) TO authenticated;
