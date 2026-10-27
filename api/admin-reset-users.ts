import { authorizeAdmin, parseBody, getServiceClient } from './_shared';

export const config = {
  runtime: 'nodejs',
};

/**
 * POST /api/admin-reset-users
 * Body: { confirm: "RESET", token?: string }   (token may also be sent as the
 *                                               `x-admin-token` header)
 *
 * Clean-slate reset for the whole account system. Wipes EVERY user so the
 * Super Admin can rebuild the login/registration flow from scratch:
 *
 *   1. Deletes all rows in public.users and every table that references a
 *      user (task_instances, task_assignments, notifications,
 *      personal_bookmarks, uploaded_files, ...). Related rows are cleaned
 *      dynamically by scanning pg_constraint, so tables added later are
 *      covered automatically; FKs declared ON DELETE CASCADE handle
 *      themselves when public.users is emptied.
 *   2. Deletes ALL Supabase Auth users (auth.users) via admin.deleteUser(),
 *      which cascades through auth's own internal tables (sessions,
 *      identities, mfa factors, refresh tokens...). After this the emails
 *      (e.g. calibojunfranz@gmail.com) can be re-registered immediately.
 *   3. RE-CREATES one guaranteed Super Admin directly with the service role
 *      key — email confirmed, no confirmation link, usable right away.
 *      The caller may pass their own replacement credentials
 *      (superAdminEmail/superAdminPassword/superAdminName) or rely on the
 *      defaults below.
 *
 * Security model (see api/_shared.ts authorizeAdmin): same gate as
 * /api/admin-delete-user — shared-secret token + verified admin identity, or
 * the bootstrap path (fully verified SUPER_ADMIN JWT while no secret is
 * configured yet). On top of that, this endpoint additionally requires:
 *   - the caller's verified role to be SUPER_ADMIN (regular admins cannot
 *     nuke the system), and
 *   - an explicit body flag { confirm: "RESET" } to prevent accidents.
 */

// ---- Default replacement Super Admin (change these or pass overrides in the body) ----
const DEFAULT_SUPER_EMAIL = 'calibojunfranz@gmail.com';
const DEFAULT_SUPER_PASSWORD = '@JUNfranz07';
const DEFAULT_SUPER_NAME = 'Junfranz Rock C. Calibo';
const DEFAULT_SUPER_DEPARTMENT = 'Provincial Government';


export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authz = await authorizeAdmin(req);
  if (!authz.ok) {
    return res.status(authz.status).json({ error: authz.error });
  }

  // Extra guard: only a VERIFIED Super Admin may perform a full reset.
  if ((authz.caller.role || '').toUpperCase() !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Only Super Admins can reset all accounts.' });
  }

  const body = parseBody(req);
  const confirm = String(body.confirm || '').toUpperCase();
  if (confirm !== 'RESET') {
    return res.status(400).json({
      error: 'Confirmation required. Send { confirm: "RESET" } in the request body.',
    });
  }

  const superEmail = String(body.superAdminEmail || DEFAULT_SUPER_EMAIL).trim().toLowerCase();
  const superPassword = String(body.superAdminPassword || DEFAULT_SUPER_PASSWORD);
  const superName = String(body.superAdminName || DEFAULT_SUPER_NAME).trim();
  const superDepartment = String(body.superAdminDepartment || DEFAULT_SUPER_DEPARTMENT).trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(superEmail)) {
    return res.status(400).json({ error: 'Invalid Super Admin email' });
  }
  if (superPassword.length < 6) {
    return res.status(400).json({ error: 'Super Admin password must be at least 6 characters' });
  }

  const admin = getServiceClient()!;

  try {
    // ---------- 0. Pre-flight: make sure the role CHECK constraint allows SUPER_ADMIN ----------
    // Older DATABASE_SETUP.sql shipped: CHECK (role IN ('ADMIN','STANDARD')).
    // If it still exists, the Super Admin re-creation below would fail with
    // 23514, so relax it now (idempotent).
    try {
      await admin.rpc('exec_sql', {
        sql: `DO $do$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public' AND rel.relname = 'users'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%role%IN%'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $do$;`.trim(),
      });
    } catch {
      /* exec_sql RPC may not exist — harmless; we verify live below */
    }

    let roleCheckOk = true;
    try {
      const probeId = crypto.randomUUID();
      const { error: probeErr } = await admin
        .from('users')
        .insert({ id: probeId, email: `probe-${Date.now()}@invalid.local`, name: 'probe', role: 'SUPER_ADMIN', department: 'system' });
      if (probeErr) {
        if (probeErr.code === '23514') {
          roleCheckOk = false;
        } else if (probeErr.code !== '23505') {
          console.warn('[admin-reset-users] Role probe unexpected error:', probeErr.message);
        }
      }
      await admin.from('users').delete().eq('id', probeId);
    } catch (e) {
      console.warn('[admin-reset-users] Role probe failed:', e);
    }

    // ---------- 1. Delete every Supabase Auth user ----------
    let deletedAuth = 0;
    const failedAuth: string[] = [];
    for (let page = 1; ; page++) {
      const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 500 });
      if (listErr) {
        console.error('[admin-reset-users] listUsers failed:', listErr.message);
        break;
      }
      const users = listed?.users || [];
      if (users.length === 0) break;
      for (const u of users) {
        const { error } = await admin.auth.admin.deleteUser(u.id);
        if (error) {
          console.warn(`[admin-reset-users] Could not delete auth user ${u.id}:`, error.message);
          failedAuth.push(u.id);
        } else {
          deletedAuth++;
        }
      }
      if (users.length < 500) break;
    }

    // ---------- 2. Clean related tables, then wipe public.users ----------
    // Discover FKs referencing public.users dynamically so newly added tables
    // never break the reset again (the old hard-coded list did).
    const related: Array<{ table: string; column: string }> = [];
    try {
      const { data: fkRows } = await admin.rpc('get_user_foreign_keys');
      if (Array.isArray(fkRows)) {
        for (const r of fkRows) {
          if (r?.table && r?.column) related.push({ table: String(r.table), column: String(r.column) });
        }
      }
    } catch {
      /* RPC not installed (FIX_USER_DELETE_FOREIGN_KEYS.sql not run) — use fallback list */
    }
    if (related.length === 0) {
      related.push(
        { table: 'task_instances', column: 'assigned_to' },
        { table: 'task_assignments', column: 'user_id' },
        { table: 'notifications', column: 'user_id' },
        { table: 'personal_bookmarks', column: 'user_id' },
        { table: 'uploaded_files', column: 'uploaded_by' },
        { table: 'task_templates', column: 'created_by' },
      );
    }

    const cleanedTables: string[] = [];
    const failedTables: string[] = [];
    for (const { table, column } of related) {
      // Remove every row that references a user in this column.
      const del = await admin.from(table).delete().not(column, 'is', null);
      if (del.error) {
        console.warn(`[admin-reset-users] Could not clean ${table}.${column}:`, del.error.message);
        failedTables.push(`${table} (${del.error.message})`);
      } else {
        cleanedTables.push(table);
      }
    }

    // Wipe all remaining profiles (matches every row whose id is not the nil
    // uuid — i.e. everything).
    const { error: usersDelErr } = await admin.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (usersDelErr) {
      console.error('[admin-reset-users] public.users wipe failed:', usersDelErr.message);
      return res.status(500).json({ error: `Could not wipe profiles: ${usersDelErr.message}` });
    }

    // ---------- 3. Re-create the guaranteed Super Admin ----------
    const profileId = crypto.randomUUID();

    // If an auth user somehow survived step 1 with this email, remove it so
    // createUser cannot hit "already registered".
    try {
      const { data: survivors } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const clash = survivors?.users?.find((u: any) => String(u.email || '').toLowerCase() === superEmail);
      if (clash) await admin.auth.admin.deleteUser(clash.id);
    } catch {
      /* best effort */
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      id: profileId,
      email: superEmail,
      password: superPassword,
      email_confirm: true,
      user_metadata: { full_name: superName, department: superDepartment, role: 'SUPER_ADMIN' },
    });

    if (createErr) {
      console.error('[admin-reset-users] Super Admin auth creation failed:', createErr.message);
      return res.status(500).json({
        success: false,
        error: `Accounts were wiped, but the new Super Admin could not be created: ${createErr.message}`,
        warning: roleCheckOk
          ? undefined
          : 'Your public.users table has a legacy CHECK constraint that forbids the SUPER_ADMIN role. Run ADD_SUPER_ADMIN_ROLE.sql (or FIX_USER_DELETE_FOREIGN_KEYS.sql) in the Supabase SQL Editor, then call this reset again.',
      });
    }

    const profileRow: any = {
      id: profileId,
      email: superEmail,
      name: superName,
      department: superDepartment,
      role: 'SUPER_ADMIN',
    };
    if (roleCheckOk) {
      const { error: profErr } = await admin.from('users').insert(profileRow);
      if (profErr) {
        console.error('[admin-reset-users] Profile insert failed:', profErr.message);
        return res.status(500).json({
          success: false,
          error: `Auth account created, but the profile row failed: ${profErr.message}`,
          warning: profErr.code === '23514'
            ? 'Legacy CHECK constraint blocks role=SUPER_ADMIN. Run ADD_SUPER_ADMIN_ROLE.sql in the Supabase SQL Editor, then press Reset again.'
            : undefined,
        });
      }
    } else {
      // Fallback: store as ADMIN so the account works immediately; the SQL
      // script will upgrade it to SUPER_ADMIN once constraints are fixed.
      const { error: profErr2 } = await admin.from('users').insert({ ...profileRow, role: 'ADMIN' });
      if (profErr2) {
        return res.status(500).json({ success: false, error: `Profile insert failed: ${profErr2.message}` });
      }
    }

    return res.status(200).json({
      success: true,
      deletedAuthUsers: deletedAuth,
      cleanedTables,
      failedTables,
      failedAuthDeletes: failedAuth,
      superAdmin: {
        id: profileId,
        email: superEmail,
        name: superName,
        role: roleCheckOk ? 'SUPER_ADMIN' : 'ADMIN (upgrade after running ADD_SUPER_ADMIN_ROLE.sql)',
      },
      note: 'All previous accounts were removed. Sign in with the Super Admin above, then register/rebuild the rest: Admins next, Standard users last.',
    });
  } catch (error) {
    console.error('[admin-reset-users] Exception:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
