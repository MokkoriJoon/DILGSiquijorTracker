import { authorizeAdmin, parseBody, getServiceClient } from './_shared';

export const config = {
  runtime: 'nodejs',
  // Deleting a user cascades through several tables + the Supabase Auth
  // admin API. Give the function room to finish so Vercel never kills it
  // mid-cleanup with an opaque HTTP 500.
  maxDuration: 30,
};

/**
 * The users profile row is referenced by foreign keys from many tables, and
 * which of them exist (and under which column name) depends on which SQL
 * scripts were ever run against the project. Rather than trusting ON DELETE
 * CASCADE (which silently does nothing when a constraint was created without
 * it — the classic "delete fails, no rows removed, no useful error" case),
 * enumerate every known reference and delete the child rows first.
 *
 * Each entry lists candidate column names; the first one that exists in this
 * project's schema is used, and missing-table/missing-column errors are
 * ignored (they are expected on deployments created from a different mix of
 * setup scripts).
 */
const KNOWN_REFERENCES: Array<{ table: string; columns: string[] }> = [
  { table: 'task_assignments', columns: ['user_id'] },
  { table: 'notifications', columns: ['user_id'] },
  { table: 'personal_bookmarks', columns: ['user_id'] },
  // assigned_to only exists on deployments created from DATABASE_SETUP.sql;
  // later schemas track assignment through task_assignments instead.
  { table: 'task_instances', columns: ['assigned_to', 'user_id'] },
  // uploaded_by / created_by are ON DELETE SET NULL in most schemas, but we
  // clear them defensively in case a constraint was created without CASCADE.
  { table: 'uploaded_files', columns: ['uploaded_by'] },
  { table: 'task_templates', columns: ['created_by'] },
];

/** True for Postgres errors that mean "this relation/column isn't here",
 *  which is expected for the optional cleanup targets above. */
function isMissingRelationError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === '42P01' || // undefined_table
    code === '42703' || // undefined_column
    code === 'PGRST205' || // postgrest: could not find the table/view
    msg.includes('does not exist') ||
    msg.includes('could not find')
  );
}

/**
 * POST /api/admin-delete-user
 * Body: { id: string, token?: string }   (token may also be sent as the
 *                                         `x-admin-token` header)
 *
 * Permanently deletes a user account. This MUST run server-side with the
 * SERVICE ROLE key because:
 *   - auth.admin.deleteUser() is impossible from the browser with the anon key;
 *   - RLS policies on public.users (and related tables) silently block
 *     DELETEs issued with the anon key, which is why Super Admins could not
 *     delete registered users.
 *
 * Security model (see api/_shared.ts authorizeAdmin):
 *   A. Shared-secret token (sha256 of the service key / site_secrets row) +
 *      verified admin identity (JWT, or provisioned-admin fallback); OR
 *   B. Bootstrap: a fully verified ADMIN/SUPER_ADMIN JWT while no shared
 *      secret has been configured yet — so deletes work immediately after
 *      deploying this function + SUPABASE_SERVICE_ROLE_KEY, even before the
 *      SQL migration is run. Path B closes automatically once the secret
 *      exists.
 *
 * Role rules: regular ADMINs cannot delete SUPER_ADMIN accounts; nobody can
 * delete themselves.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authz = await authorizeAdmin(req);
  if (!authz.ok) {
    return res.status(authz.status).json({ error: authz.error });
  }

  const admin = getServiceClient()!;
  const body = parseBody(req);
  const id: string | undefined = typeof body.id === 'string' ? body.id.trim() : undefined;
  if (!id) return res.status(400).json({ error: 'Missing user id' });

  // A uuid is required: Postgres raises 22P02 ("invalid input syntax for
  // type uuid") on any malformed id, which previously surfaced as a bare
  // HTTP 500. Reject it up front with a clear 400 instead.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) {
    return res.status(400).json({ error: `Invalid user id "${id}" (expected a UUID).` });
  }

  try {
    const callerRole = authz.caller.role;
    const callerId = authz.caller.id;

    if (callerRole !== 'ADMIN' && callerRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only admins can delete users.' });
    }
    if (callerId === id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    // Regular admins may not delete Super Admins.
    const { data: targetRow, error: targetErr } = await admin
      .from('users')
      .select('id, role')
      .eq('id', id)
      .maybeSingle();

    if (targetErr) {
      console.error('[admin-delete-user] Target lookup failed:', targetErr.code, targetErr.message);
      return res.status(500).json({ error: `Could not look up the user in public.users: ${targetErr.message}` });
    }

    if ((targetRow?.role || '').toUpperCase() === 'SUPER_ADMIN' && callerRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Admins cannot delete Super Admin accounts.' });
    }

    // ---------------------------------------------------------------------
    // 1) Remove every row that references this user's profile.
    //    Order matters for FK constraints; the service role bypasses RLS.
    //    Missing tables/columns in this list are expected on some projects
    //    and are skipped silently (they were logged once already anyway).
    // ---------------------------------------------------------------------
    const cleanupWarnings: string[] = [];
    for (const ref of KNOWN_REFERENCES) {
      // A column that this project's schema does not have is expected — try
      // each candidate and keep the first one that exists.
      let columnUsed: string | null = null;
      let lastError: any = null;
      for (const column of ref.columns) {
        const { error } = await admin.from(ref.table).delete().eq(column, id);
        if (!error) { columnUsed = column; lastError = null; break; }
        if (isMissingRelationError(error)) { lastError = error; continue; }
        columnUsed = column; lastError = error; break;
      }
      if (columnUsed && lastError) {
        cleanupWarnings.push(`${ref.table}.${columnUsed}: ${lastError.message}`);
        console.warn(`[admin-delete-user] Could not clean ${ref.table}.${columnUsed}:`, lastError.code, lastError.message);
      } else if (!columnUsed && lastError) {
        console.warn(`[admin-delete-user] Table ${ref.table} has no reference column in this schema; skipping.`);
      }
    }

    // ---------------------------------------------------------------------
    // 2) Delete the profile row. If Postgres refuses because of a foreign
    //    key we did not know about, discover the referencing constraint from
    //    the live catalog and clean that table too, then retry — instead of
    //    returning the raw 500 the UI used to show.
    // ---------------------------------------------------------------------
    let profileError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const del = await admin.from('users').delete().eq('id', id);
      profileError = del.error;
      if (!profileError) break;

      const isFkViolation =
        profileError.code === '23503' ||
        String(profileError.message || '').toLowerCase().includes('foreign key');

      if (!isFkViolation) break; // genuine failure (permissions, etc.) — report it

      const rescued = await cleanUnknownForeignKey(admin, id);
      if (!rescued) break; // nothing more we can safely do
      console.warn('[admin-delete-user] Cleaned an unlisted FK reference; retrying profile delete.');
    }

    if (profileError) {
      console.error('[admin-delete-user] Profile delete failed:', profileError.code, profileError.message);
      return res.status(500).json({
        error:
          `Could not delete the profile row in public.users (${profileError.message}). ` +
          (cleanupWarnings.length ? `Cleanup warnings: ${cleanupWarnings.join('; ')}. ` : '') +
          'If a foreign key blocks it, run FIX_USER_DELETE_PERMISSIONS.sql and make sure every table that references users(id) uses ON DELETE CASCADE.',
      });
    }

    // The anon/service DELETE succeeds with zero rows removed when the id is
    // unknown (e.g. legacy profiles), so verify the row really is gone.
    const { data: stillThere } = await admin
      .from('users')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (stillThere) {
      console.error('[admin-delete-user] Profile row still present after DELETE.');
      return res.status(500).json({
        error:
          'The delete was rejected without an error message — Row Level Security or a trigger kept the row in public.users. ' +
          'Confirm SUPABASE_SERVICE_ROLE_KEY in Vercel matches this Supabase project (an old key authenticates but runs with limited rights), ' +
          'then run FIX_USER_DELETE_PERMISSIONS.sql in the Supabase SQL Editor.',
      });
    }

    // ---------------------------------------------------------------------
    // 3) Free the email address by removing the Supabase Auth account.
    //    Non-fatal: the profile is already gone; the auth row can be cleaned
    //    from the dashboard afterwards.
    // ---------------------------------------------------------------------
    const { error: authError } = await admin.auth.admin.deleteUser(id);
    if (authError) {
      console.warn('[admin-delete-user] Auth user cleanup failed:', authError.message);
    }

    return res.status(200).json({
      success: true,
      bootstrapped: authz.bootstrapped,
      warnings: [...cleanupWarnings, ...(authError ? [`auth account: ${authError.message}`] : [])],
    });
  } catch (error) {
    console.error('[admin-delete-user] Exception:', error);
    return res.status(500).json({
      error: error instanceof Error
        ? `${error.message} (see /api/admin-delete-user logs)`
        : 'Unknown error while deleting the user (see /api/admin-delete-user logs)',
    });
  }
}

/**
 * Best-effort recovery for "23503 foreign_key_violation": ask Postgres which
 * tables still point at public.users.id (admin_find_user_references, created
 * by FIX_USER_DELETE_FOREIGN_KEYS.sql), delete this user's rows there, and
 * report whether anything was actually cleaned so the caller can retry.
 */
async function cleanUnknownForeignKey(admin: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc('admin_find_user_references', { p_user_id: userId });
    if (error) {
      console.warn('[admin-delete-user] FK discovery RPC unavailable:', error.code, error.message);
      return false;
    }
    const refs = (Array.isArray(data) ? data : []) as Array<{
      schema?: string; table_name?: string; column_name?: string;
      // tolerate alternate record shapes in case the RPC is redefined
      table?: string; column?: string;
    }>;
    if (refs.length === 0) return false;

    let cleaned = false;
    for (const ref of refs) {
      const table = ref.table_name || ref.table;
      const column = ref.column_name || ref.column;
      if (!table || !column || !/^[a-z_][a-z0-9_]*$/i.test(table) || !/^[a-z_][a-z0-9_]*$/i.test(column)) {
        continue; // never build a request from unexpected identifiers
      }
      const { error: delErr } = await admin
        .schema(ref.schema && /^[a-z_][a-z0-9_]*$/i.test(ref.schema) ? ref.schema : 'public')
        .from(table)
        .delete()
        .eq(column, userId);
      if (delErr) {
        if (isMissingRelationError(delErr)) continue;
        console.warn(`[admin-delete-user] Could not clean discovered reference ${ref.schema || 'public'}.${table}.${column}:`, delErr.code, delErr.message);
      } else {
        cleaned = true;
      }
    }
    return cleaned;
  } catch (e) {
    console.warn('[admin-delete-user] FK discovery failed:', e);
    return false;
  }
}
