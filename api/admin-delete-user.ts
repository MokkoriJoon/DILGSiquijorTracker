import { authorizeAdmin, parseBody, getServiceClient } from './_shared';

export const config = {
  runtime: 'nodejs',
};

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
  const id: string | undefined = body.id;
  if (!id) return res.status(400).json({ error: 'Missing user id' });

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
      console.error('[admin-delete-user] Target lookup failed:', targetErr.message);
      return res.status(500).json({ error: targetErr.message });
    }

    if ((targetRow?.role || '').toUpperCase() === 'SUPER_ADMIN' && callerRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Admins cannot delete Super Admin accounts.' });
    }

    // Delete related rows first (order matters for FK constraints),
    // then the profile, then the auth account. Service role bypasses RLS.
    const cleanups: Array<{ table: string; column: string }> = [
      { table: 'task_instances', column: 'assigned_to' },
      { table: 'task_assignments', column: 'user_id' },
      { table: 'notifications', column: 'user_id' },
      { table: 'personal_bookmarks', column: 'user_id' },
    ];
    for (const { table, column } of cleanups) {
      const { error } = await admin.from(table).delete().eq(column, id);
      if (error) console.warn(`[admin-delete-user] Could not clean ${table}:`, error.message);
    }

    const { error: profileError } = await admin.from('users').delete().eq('id', id);
    if (profileError) {
      console.error('[admin-delete-user] Profile delete failed:', profileError.message);
      return res.status(500).json({ error: profileError.message });
    }

    const { error: authError } = await admin.auth.admin.deleteUser(id);
    if (authError) {
      // Non-fatal: the profile row is gone; the email can still be freed
      // manually from the Supabase dashboard if needed.
      console.warn('[admin-delete-user] Auth user cleanup failed:', authError.message);
    }

    return res.status(200).json({ success: true, bootstrapped: authz.bootstrapped });
  } catch (error) {
    console.error('[admin-delete-user] Exception:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
