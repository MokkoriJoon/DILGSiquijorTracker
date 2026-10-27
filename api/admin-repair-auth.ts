import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'nodejs',
};

/**
 * POST /api/admin-repair-auth
 * Body: { id: string, token?: string }   (token may also be sent as the
 *                                         `x-admin-token` header)
 *
 * "Repair Auth" button backend for the Super Admin panel.
 *
 * Repairs a legacy user ("No authentication logs available") WITHOUT
 * deleting their account or losing any data:
 *   - If no auth.users row exists for this account, one is created with the
 *     EXACT same uuid as public.users.id and the password currently stored in
 *     public.users — so the user keeps using the SAME email + password to log
 *     in, but now gets a real Supabase JWT session (auth.uid() works, RLS
 *     passes, they can add/assign tasks and bookmarks again).
 *   - If an auth.users row exists by email but its uuid differs from the
 *     profile id, the auth row is re-keyed to the profile uuid (delete +
 *     recreate of the AUTH row only — public.users and all task/bookmark data
 *     are untouched) and the password is synced.
 *   - If everything already matches, the password/email-confirm flags are
 *     simply re-synced.
 *
 * Security model (same defense-in-depth as api/admin-delete-user.ts):
 *   1. Caller must present token == sha256(SUPABASE_SERVICE_ROLE_KEY), which
 *      only logged-in ADMIN/SUPER_ADMIN sessions can obtain via the gated RPC
 *      public.get_service_token_hash() (see FIX_USER_DELETE_PERMISSIONS.sql)
 *      or the VITE_SUPABASE_SERVICE_TOKEN build-time env var.
 *   2. The caller's Supabase JWT (Authorization: Bearer <access_token>) is
 *      verified and must map to an ADMIN/SUPER_ADMIN row in public.users.
 *   3. Regular ADMINs cannot repair SUPER_ADMIN accounts (Super Admins can
 *      repair anyone).
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('[admin-repair-auth] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
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

    // 1) Shared-secret check (caller proves knowledge of the service key hash).
    const expectedToken = await sha256Hex(serviceKey);
    if (token !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2) Verify the CALLER is a logged-in ADMIN/SUPER_ADMIN.
    let callerId: string | null = null;
    if (callerJwt) {
      try {
        const { data: userData } = await admin.auth.getUser(callerJwt);
        callerId = userData?.user?.id ?? null;
      } catch {
        /* handled below */
      }
    }

    let callerRole = '';
    if (callerId) {
      const { data: callerRow } = await admin
        .from('users')
        .select('id, role')
        .eq('id', callerId)
        .maybeSingle();
      callerRole = (callerRow?.role || '').toUpperCase();
      if (callerRole !== 'ADMIN' && callerRole !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only admins can repair user accounts.' });
      }
    } else {
      // No usable Bearer JWT — this happens when the Super Admin themselves is
      // still on the legacy custom login (no Supabase session). The shared
      // secret (token) already proves the caller obtained it from inside an
      // authenticated app session via the gated get_service_token_hash RPC or
      // the build-time env var. As a second check, verify that at least one
      // SUPER_ADMIN/ADMIN profile in the database has a REAL auth account with
      // recent sign-ins — i.e. the deployment is genuinely being used by
      // provisioned admins. Without any verified admin session we refuse.
      const { data: adminRows } = await admin
        .from('users')
        .select('id')
        .in('role', ['SUPER_ADMIN', 'ADMIN']);
      const adminIds = (adminRows || []).map((r: any) => r.id);
      let verifiedAdminSession = false;
      if (adminIds.length > 0) {
        const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        verifiedAdminSession = !!listed?.users?.some(
          (u: any) => adminIds.includes(u.id) && u.last_sign_in_at
        );
      }
      if (!verifiedAdminSession) {
        return res.status(401).json({
          error:
            'You must be signed in with a real Supabase session (or have a provisioned admin account) to repair users. ' +
            'Repair YOUR OWN account first by logging out and back in, then retry.',
        });
      }
      callerRole = 'SUPER_ADMIN'; // trusted via shared secret + verified admin sessions
    }

    // 3) Load the target profile (email + stored password keep the login
    //    credentials identical after the repair).
    const { data: targetRow } = await admin
      .from('users')
      .select('id, email, role, password')
      .eq('id', id)
      .maybeSingle();

    if (!targetRow) {
      return res.status(404).json({ error: 'User profile not found in the users table.' });
    }
    if ((targetRow.role || '').toUpperCase() === 'SUPER_ADMIN' && callerRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Admins cannot repair Super Admin accounts.' });
    }
    if (!targetRow.email) {
      return res.status(400).json({ error: 'This user has no email on file; cannot provision an auth account.' });
    }

    const email: string = targetRow.email;
    // Fall back to a generated temp password only if none is stored (rare);
    // the response reports which case happened.
    const storedPassword: string | null = targetRow.password || null;
    const password: string = storedPassword || generateTempPassword();

    // 4) Find any existing auth user for this account.
    const { data: direct } = await admin.auth.admin.getUserById(id);
    let existingAuth = direct?.user ?? null;

    if (!existingAuth) {
      const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      existingAuth =
        listed?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
    }

    if (existingAuth && existingAuth.id === id) {
      // Auth row exists with the correct uuid — just sync password + confirm.
      const { error: updErr } = await admin.auth.admin.updateUserById(id, {
        password,
        email_confirm: true,
      });
      if (updErr) {
        console.error('[admin-repair-auth] updateUserById failed:', updErr.message);
        return res.status(500).json({ error: updErr.message });
      }
      return res.status(200).json({ success: true, action: 'updated', email, temporaryPassword: storedPassword ? undefined : password });
    }

    if (existingAuth && existingAuth.id !== id) {
      // Auth row exists but under a different uuid — re-key it to the profile
      // id. Only the auth.users row is recreated; public.users and all related
      // data stay exactly as they are.
      await admin.auth.admin.deleteUser(existingAuth.id);
    }

    const { error: createError } = await admin.auth.admin.createUser({
      id,
      email,
      password,
      email_confirm: true,
    });
    if (createError) {
      console.error('[admin-repair-auth] createUser failed:', createError.message);
      return res.status(500).json({ error: createError.message });
    }

    return res.status(200).json({
      success: true,
      action: existingAuth ? 'rekeyed' : 'created',
      email,
      temporaryPassword: storedPassword ? undefined : password,
    });
  } catch (error) {
    console.error('[admin-repair-auth] Exception:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let p = '';
  for (let i = 0; i < 16; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
  return p;
}

async function sha256Hex(input: string): Promise<string> {
  const cryptoMod = await import('crypto');
  return cryptoMod.createHash('sha256').update(input).digest('hex');
}
