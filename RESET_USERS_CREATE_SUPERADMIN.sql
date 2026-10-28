-- ============================================================================
-- RESET USERS + CREATE SUPER_ADMIN — run this in the Supabase SQL Editor.
--
-- What it does:
--   1. DELETES every row from public.users (old/new/hidden accounts alike).
--      All dependent rows (tasks, notifications, files, bookmarks) are removed
--      first so nothing blocks the delete with a foreign-key error.
--   2. Also cleans up any leftover Supabase Auth (auth.users) accounts, since
--      those were what caused "Database error finding user" during signup.
--      (The app no longer uses Supabase Auth — registration/login now write
--      directly to public.users with plain email + password.)
--   3. Creates ONE fresh account:
--         email:    calibojunfranz@gmail.com
--         password: Admin@1234          <-- CHANGE THIS after first login
--         role:     SUPER_ADMIN
--
-- ⚠️  DESTRUCTIVE: this wipes ALL users and task data. Do not run it if you
--     want to keep existing tasks.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1a. Remove dependent data FIRST (children of public.users), then all users.
-- ---------------------------------------------------------------------------
DELETE FROM public.uploaded_files;      -- FK -> task_instances & users
DELETE FROM public.task_assignments;    -- FK -> task_templates & users
DELETE FROM public.task_instances;      -- FK -> task_templates & users
DELETE FROM public.task_templates;      -- FK -> users (created_by)
DELETE FROM public.personal_bookmarks;  -- FK -> users
DELETE FROM public.notifications;       -- user_id references users
DELETE FROM public.users;               -- every registered account (visible or hidden)

-- ---------------------------------------------------------------------------
-- 1b. Clean out leftover Supabase Auth users so auth and public.users can
--     never get out of sync again. (Safe to skip if you want to keep the
--     ability to log into the Supabase Dashboard itself with those accounts —
--     deleting auth.users here only removes APP accounts, dashboard admins
--     created via the Supabase project itself may also appear; that's fine
--     for a hobby project.)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Children of auth.users (Supabase-managed tables). Each is wrapped so a
  -- missing table/column in older Auth versions just gets skipped.
  BEGIN DELETE FROM auth.mfa_challenges;                 EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip mfa_challenges: %', SQLERRM; END;
  BEGIN DELETE FROM auth.mfa_factors;                    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip mfa_factors: %', SQLERRM; END;
  BEGIN DELETE FROM auth.one_time_tokens;                EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip one_time_tokens: %', SQLERRM; END;
  BEGIN DELETE FROM auth.refresh_tokens;                 EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip refresh_tokens: %', SQLERRM; END;
  BEGIN DELETE FROM auth.sessions;                       EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip sessions: %', SQLERRM; END;
  BEGIN DELETE FROM auth.sso_providers;                  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip sso_providers: %', SQLERRM; END;
  BEGIN DELETE FROM auth.saml_providers;                 EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip saml_providers: %', SQLERRM; END;
  BEGIN DELETE FROM auth.saml_relay_states;              EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip saml_relay_states: %', SQLERRM; END;
  BEGIN DELETE FROM auth.oauth_authorizations;           EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip oauth_authorizations: %', SQLERRM; END;
  BEGIN DELETE FROM auth.oauth_consents;                 EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip oauth_consents: %', SQLERRM; END;
  BEGIN DELETE FROM auth.identities;                     EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip identities: %', SQLERRM; END;
  BEGIN DELETE FROM auth.users;                          EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip auth.users: %', SQLERRM; END;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Make sure the FK to auth.users is gone (required for direct inserts).
--    Idempotent — harmless if SIMPLE_AUTH_NO_SIGNUP.sql was already run.
-- ---------------------------------------------------------------------------
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- ---------------------------------------------------------------------------
-- 3. Insert the new SUPER_ADMIN account.
--    Uses ON CONFLICT so re-running the script won't duplicate the email.
-- ---------------------------------------------------------------------------
INSERT INTO public.users (id, email, name, role, department, position, password, visible)
VALUES (
  gen_random_uuid(),
  'calibojunfranz@gmail.com',
  'Caliboj, Jun Franz',
  'SUPER_ADMIN',
  '',
  '',
  'Admin@1234',            -- default password (plain text, min 6 chars) — change it in the app
  true
)
ON CONFLICT (email) DO UPDATE
SET role        = 'SUPER_ADMIN',
    password    = EXCLUDED.password,
    visible     = true,
    updated_at  = now();

COMMIT;

-- ---------------------------------------------------------------------------
-- 4. Verify — should return exactly one row:
--    calibojunfranz@gmail.com | SUPER_ADMIN
-- ---------------------------------------------------------------------------
SELECT id, email, name, role, (password IS NOT NULL) AS has_password, visible
FROM public.users
ORDER BY created_at;
