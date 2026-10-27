-- ============================================================================
-- CREATE SUPER ADMIN ACCOUNT
--   Name:     Junfranz Rock C. Calibo
--   Email:    calibojunfranz@gmail.com
--   Password: @JUNfranz07
--
-- Run this in the Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Idempotent: if a row for this email already exists it is repaired/reset
-- instead of failing on the unique-email constraint.
--
-- Notes:
--  * encrypted_password below is a real bcrypt ($2b$, cost 10) hash of
--    "@JUNfranz07" that GoTrue verifies natively, so login works immediately.
--  * The auth user and the public.users profile share the SAME uuid, which
--    every RLS policy in this project requires (auth.uid() = users.id).
--  * email_confirmed_at is set, so no confirmation email is needed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 0 (self-healing): if public.users.role is a Postgres enum that lacks
-- the 'SUPER_ADMIN' label, add it NOW, in its own transaction. Postgres
-- forbids using a newly added enum value inside the same transaction that
-- created it, so this must be a separate statement from the inserts below.
-- ----------------------------------------------------------------------------
DO $$
DECLARE v_is_enum boolean;
BEGIN
  SELECT t.typtype = 'e' INTO v_is_enum
    FROM information_schema.columns c
    JOIN pg_namespace n ON n.nspname = c.table_schema
    JOIN pg_class     cl ON cl.relname = c.table_name AND cl.relnamespace = n.oid
    JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attname = c.column_name
    JOIN pg_type      t ON t.oid = a.atttypid
   WHERE c.table_schema='public' AND c.table_name='users' AND c.column_name='role'
   LIMIT 1;

  IF COALESCE(v_is_enum, false) THEN
    ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
  END IF;
END $$;

DO $$
DECLARE
  v_uid      uuid;
  v_existing uuid;
  v_email    text := 'calibojunfranz@gmail.com';
  v_name     text := 'Junfranz Rock C. Calibo';
  v_dept     text := 'DILG Siquijor Provincial Office';
  v_plain_pw text := '@JUNfranz07';
  v_hash     text := '$2b$10$aqLLvcsndkviuMT5BZ3IWOFWJ4HZCyR7thtuThx5iPQkfW/sscuXW';
  v_cols     text[];
  v_cnames   text[];
  v_cvals    text[];
  v_sql      text;
  v_setlist  text;
  v_has_updated boolean;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1. Reuse an existing uuid when possible (auth row first, then stale
  --    profile row), so old task/bookmark references keep pointing at you.
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_existing FROM auth.users WHERE lower(email) = v_email LIMIT 1;
  IF v_existing IS NULL THEN
    BEGIN
      SELECT id INTO v_existing FROM public.users WHERE lower(email) = v_email LIMIT 1;
    EXCEPTION WHEN undefined_table THEN
      v_existing := NULL;
    END;
  END IF;

  IF v_existing IS NOT NULL THEN
    v_uid := v_existing;
    DELETE FROM auth.users WHERE id = v_uid;      -- recreate cleanly below
  ELSE
    v_uid := gen_random_uuid();
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3. Insert the auth user. Column list is built dynamically so this runs on
  --    every GoTrue schema version (older projects lack authentication_methods
  --    / is_sso_user; newer ones have them).
  -- ---------------------------------------------------------------------------
  SELECT array_agg(c.column_name) INTO v_cols
    FROM information_schema.columns c
   WHERE c.table_schema = 'auth' AND c.table_name = 'users';

  -- Assemble the INSERT with parallel arrays of column names + value
  -- expressions so commas are always placed correctly. Every optional
  -- column is added ONLY if it actually exists in this project's auth.users
  -- (GoTrue schema versions differ — e.g. older/newer projects may lack
  -- instance_id, confirmation_token, authentication_methods, ...).
  -- Core columns. Even these are filtered below, because very old / custom
  -- auth schemas may lack e.g. updated_at or raw_app_meta_data.
  v_cnames := ARRAY['id','email','encrypted_password','email_confirmed_at'];
  v_cvals  := ARRAY[
      quote_literal(v_uid::text) || '::uuid',
      quote_literal(v_email),
      quote_literal(v_hash),
      'now()'];

  IF 'aud' = ANY(v_cols) THEN
    v_cnames := v_cnames || ARRAY['aud']; v_cvals := v_cvals || ARRAY['''authenticated'''];
  END IF;
  IF 'role' = ANY(v_cols) THEN
    v_cnames := v_cnames || ARRAY['role']; v_cvals := v_cvals || ARRAY['''authenticated'''];
  END IF;
  IF 'raw_app_meta_data' = ANY(v_cols) THEN
    v_cnames := v_cnames || ARRAY['raw_app_meta_data'];
    v_cvals  := v_cvals  || ARRAY['''{"provider":"email","providers":["email"]}''::jsonb'];
  END IF;
  IF 'raw_user_meta_data' = ANY(v_cols) THEN
    v_cnames := v_cnames || ARRAY['raw_user_meta_data'];
    v_cvals  := v_cvals  || ARRAY[quote_literal((jsonb_build_object('full_name', v_name, 'department', v_dept, 'role', 'SUPER_ADMIN'))::text) || '::jsonb'];
  END IF;
  IF 'created_at' = ANY(v_cols) THEN
    v_cnames := v_cnames || ARRAY['created_at']; v_cvals := v_cvals || ARRAY['now()'];
  END IF;
  IF 'updated_at' = ANY(v_cols) THEN
    v_cnames := v_cnames || ARRAY['updated_at']; v_cvals := v_cvals || ARRAY['now()'];
  END IF;
  IF 'instance_id' = ANY(v_cols) THEN
    v_cnames := v_cnames || ARRAY['instance_id'];
    v_cvals  := v_cvals  || ARRAY['''00000000-0000-0000-0000-000000000000''::uuid'];
  END IF;
  IF 'confirmation_token' = ANY(v_cols) THEN
    v_cnames := v_cnames || ARRAY['confirmation_token']; v_cvals := v_cvals || ARRAY[quote_literal('')];
  END IF;
  IF 'confirmation_sent_at' = ANY(v_cols) THEN
    -- keep GoTrue from ever sending a confirmation email for this account
    v_cnames := v_cnames || ARRAY['confirmation_sent_at']; v_cvals := v_cvals || ARRAY['now()'];
  END IF;
  IF 'recovery_token' = ANY(v_cols) THEN
    v_cnames := v_cnames || ARRAY['recovery_token']; v_cvals := v_cvals || ARRAY[quote_literal('')];
  END IF;
  IF 'email_change' = ANY(v_cols) THEN
    v_cnames := v_cnames || ARRAY['email_change']; v_cvals := v_cvals || ARRAY['NULL'];
  END IF;
  IF 'is_sso_user' = ANY(v_cols) THEN
    v_cnames := v_cnames || ARRAY['is_sso_user']; v_cvals := v_cvals || ARRAY['false'];
  END IF;
  IF 'authentication_methods' = ANY(v_cols) THEN
    v_cnames := v_cnames || ARRAY['authentication_methods'];
    v_cvals  := v_cvals  || ARRAY['''[{"provider":"password","method":"password"}]''::jsonb'];
  END IF;

    v_sql := 'INSERT INTO auth.users (' || array_to_string(v_cnames, ', ') || ') VALUES ('
          || array_to_string(v_cvals, ', ') || ')';
  BEGIN
    EXECUTE v_sql;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Could not insert into auth.users (SQLSTATE %). Details: %', SQLSTATE, SQLERRM;
  END;

  -- ---------------------------------------------------------------------------
  -- 4. Upsert the public.users profile with the SAME uuid (RLS requires this).
  --    The column list is built dynamically from information_schema so this
  --    works whether or not later migrations added optional columns
  --    (updated_at, position, visible, avatar_url, phone, ...).
  -- ---------------------------------------------------------------------------
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='users'
                   AND column_name='updated_at')
    INTO v_has_updated;

  v_cnames := ARRAY['id','email','name','password','role','department','created_at'];
  v_cvals  := ARRAY[
      quote_literal(v_uid::text) || '::uuid',
      quote_literal(v_email),
      quote_literal(v_name),
      quote_literal(v_plain_pw),
      '''SUPER_ADMIN''',
      quote_literal(v_dept),
      'now()'];

  IF v_has_updated THEN
    v_cnames := v_cnames || ARRAY['updated_at'];
    v_cvals  := v_cvals  || ARRAY['now()'];
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='users' AND column_name='position') THEN
    v_cnames := v_cnames || ARRAY['position'];
    v_cvals  := v_cvals  || ARRAY['''Provincial Administrator'''];
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='users' AND column_name='visible') THEN
    v_cnames := v_cnames || ARRAY['visible'];
    v_cvals  := v_cvals  || ARRAY['true'];
  END IF;

  -- ON CONFLICT update list: only touch columns that actually exist.
  v_setlist := 'email = EXCLUDED.email, name = EXCLUDED.name, password = EXCLUDED.password,'
            || ' role = ''SUPER_ADMIN'''
            || CASE WHEN v_has_updated THEN ', updated_at = now()' ELSE '' END;

  v_sql := 'INSERT INTO public.users (' || array_to_string(v_cnames, ', ') || ') VALUES ('
        || array_to_string(v_cvals, ', ') || ')'
        || ' ON CONFLICT (id) DO UPDATE SET ' || v_setlist;

  BEGIN
    EXECUTE v_sql;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Profile insert failed (SQLSTATE %). If the error mentions unsafe use of the new enum value, simply re-run this whole script once more (the SUPER_ADMIN label was just added and becomes usable on the next run). Details: %', SQLSTATE, SQLERRM;
  END;

  RAISE NOTICE 'Super Admin ready - id: %  email: %', v_uid, v_email;
END $$;

-- Verification: should return exactly one row, role SUPER_ADMIN, email_confirmed = true
SELECT u.id, u.email, u.name, u.role,
       (au.email_confirmed_at IS NOT NULL) AS email_confirmed
FROM public.users u
LEFT JOIN auth.users au ON au.id = u.id
WHERE lower(u.email) = 'calibojunfranz@gmail.com';

-- OPTIONAL (only if you WANT the updated_at column): your public.users table
-- currently has no "updated_at" column. The script above already adapts to
-- that and will succeed as-is. If you'd rather add the column for future
-- compatibility, uncomment these two lines and run them BEFORE re-running the
-- script:
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
-- UPDATE public.users SET updated_at = now() WHERE updated_at IS NULL;
