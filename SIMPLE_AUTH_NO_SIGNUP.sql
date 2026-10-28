-- ============================================================================
-- SIMPLE AUTH (no Supabase Auth / no email verification) — run this ONCE in
-- the Supabase SQL Editor.
--
-- The app now registers/logs in by writing DIRECTLY to public.users with the
-- anon key (plain email + password, no auth.users rows, no confirmation
-- emails). For that to work through PostgREST we need:
--   1. The FK from public.users.id -> auth.users removed (new registrations
--      generate their own uuids; they no longer come from auth.users).
--   2. Open RLS policies on public.users (anon allowed to read/write).
--   3. Public access to the other tables (same "no security" spirit as the
--      rest of the app's existing policies).
--   4. A small helper so User Management can show/copy stored passwords.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop the users.id -> auth.users foreign key (it is what caused
--    "Database error finding user" style failures when auth and public got out
--    of sync, and it blocks plain-uuid inserts now).
-- ---------------------------------------------------------------------------
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- ---------------------------------------------------------------------------
-- 2. Full open access on public.users for anon + authenticated.
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simple_users_select" ON public.users;
CREATE POLICY "simple_users_select" ON public.users
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "simple_users_insert" ON public.users;
CREATE POLICY "simple_users_insert" ON public.users
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "simple_users_update" ON public.users;
CREATE POLICY "simple_users_update" ON public.users
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "simple_users_delete" ON public.users;
CREATE POLICY "simple_users_delete" ON public.users
  FOR DELETE TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 3. Public access for the rest of the app tables (hobby project, no security).
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'task_templates','task_instances','task_assignments','uploaded_files',
    'notifications','personal_bookmarks','site_settings','site_secrets',
    'scheduler_logs','email_config'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "public_all_%1$s" ON public.%1$I;', t);
    EXECUTE format(
      'CREATE POLICY "public_all_%1$s" ON public.%1$I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
      t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Helper: list users WITH their stored (plaintext) passwords so the
--    "Show Password" feature in User Management keeps working. This RPC is
--    callable with the anon key and bypasses column-level restrictions.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_users_with_passwords()
RETURNS TABLE (id uuid, password text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, u.password FROM public.users u;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_users_with_passwords() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Sanity check — should return one row per user with a non-null id.
-- ---------------------------------------------------------------------------
SELECT id, email, role, (password IS NOT NULL) AS has_password FROM public.users ORDER BY created_at;
