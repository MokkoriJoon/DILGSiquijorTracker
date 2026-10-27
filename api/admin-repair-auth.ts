import { authorizeAdmin, parseBody, getServiceClient } from './_shared';

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
 * Security model: see api/_shared.ts authorizeAdmin — accepts either the
 * shared-secret token + verified admin identity, or (as a bootstrap path
 * while no secret is configured) a fully verified ADMIN/SUPER_ADMIN JWT.
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
    let callerRole = authz.caller.role;
    if (callerRole !== 'ADMIN' && callerRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only admins can repair user accounts.' });
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
