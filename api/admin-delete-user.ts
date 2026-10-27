import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'nodejs',
};

/**
 * POST /api/admin-delete-user
 * Body: { id: string, token: string }   (token may also be sent as the
 *                                        `x-admin-token` header)
 *
 * Permanently deletes a user account. This MUST run server-side with the
 * SERVICE ROLE key because:
 *   - auth.admin.deleteUser() is impossible from the browser with the anon key;
 *   - RLS policies on public.users (and related tables) silently block
 *     DELETEs issued with the anon key, which is why Super Admins could not
 *     delete registered users.
 *
 * Security model (defense in depth — never trust the client):
 *   1. The caller must present `token` == sha256(SUPABASE_SERVICE_ROLE_KEY).
 *      Only logged-in app users can compute this because the app fetches the
 *      hash once via a service-role RPC (public.get_service_token_hash(), see
 *      FIX_USER_DELETE_PERMISSIONS.sql) that is itself gated on an ADMIN or
 *      SUPER_ADMIN role row in public.users.
 *   2. The caller's Supabase JWT (Authorization: Bearer <access_token>) is
 *      verified against public.users and must have role ADMIN or SUPER_ADMIN.
 *   3. A regular ADMIN may NOT delete a SUPER_ADMIN account (Super Admins may
 *      delete anyone except themselves).
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('[admin-delete-user] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    return res.status(500).json({ error: 'Server not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.' });
  }

  try {
    const body = JSON.parse(req.body || '{}');
    const id: string | undefined = body.id;
    const token: string | undefined = body.token || req.headers['x-admin-token'];
    const callerJwt: string | undefined =
      typeof req.headers.authorization === 'string'
        ? req.headers.authorization.replace(/^Bearer\s+/i, '')
        : undefined;

    if (!id) return res.status(400).json({ error: 'Missing user id' });
    if (!token) return res.status(400).json({ error: 'Missing admin token' });

    // 1) Shared-secret check: caller must know the service role key
    //    (proven by sending its SHA-256 hash, obtained via the gated RPC).
    const expectedToken = await sha256Hex(serviceKey);
    if (token !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2) Verify the CALLER is really a logged-in ADMIN/SUPER_ADMIN.
    let callerId: string | null = null;
    if (callerJwt) {
      try {
        const { data: userData } = await admin.auth.getUser(callerJwt);
        callerId = userData?.user?.id ?? null;
      } catch {
        /* fall through to role check below */
      }
    }
    if (!callerId) {
      return res.status(401).json({ error: 'You must be signed in to delete users.' });
    }

    const { data: callerRow } = await admin
      .from('users')
      .select('id, role')
      .eq('id', callerId)
      .maybeSingle();

    const callerRole = (callerRow?.role || '').toUpperCase();
    if (callerRole !== 'ADMIN' && callerRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only admins can delete users.' });
    }
    if (callerId === id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    // 3) Regular admins may not delete Super Admins.
    const { data: targetRow } = await admin
      .from('users')
      .select('id, role')
      .eq('id', id)
      .maybeSingle();

    if ((targetRow?.role || '').toUpperCase() === 'SUPER_ADMIN' && callerRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Admins cannot delete Super Admin accounts.' });
    }

    // 4) Delete related rows first (order matters for FK constraints),
    //    then the profile, then the auth account. Service role bypasses RLS.
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

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[admin-delete-user] Exception:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function sha256Hex(input: string): Promise<string> {
  const cryptoMod = await import('crypto');
  return cryptoMod.createHash('sha256').update(input).digest('hex');
}
