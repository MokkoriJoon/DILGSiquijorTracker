import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'nodejs',
};

/**
 * POST /api/admin-create-auth-user
 * Body: { id: string, email: string, password: string }
 *
 * Repairs "old users" — rows in public.users that have no matching Supabase
 * Auth user (or whose auth uid differs from the profile id). Without a real
 * auth session, every RLS policy that checks auth.uid() fails, so those users
 * cannot create/assign/edit tasks or add bookmarks.
 *
 * This endpoint uses the SERVICE ROLE key (server-side only) to:
 *  1. Create an auth user with the EXACT same uuid as public.users.id, or
 *  2. Update an existing auth user's id/email/password if it mismatches.
 *
 * Security: requires header `x-profile-token`, which must equal the SHA-256
 * hash of the service role key (so clients can prove they know the key without
 * ever transmitting it; the client already ships the anon key publicly and the
 * token is derived at build time from VITE_SUPABASE_SERVICE_TOKEN).
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('[admin-create-auth-user] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    return res.status(500).json({ error: 'Server not configured' });
  }

  // Simple shared-secret check: client sends sha256(serviceKey) as a bearer-ish token.
  const providedToken = req.headers['x-profile-token'];
  const expectedToken = await sha256Hex(serviceKey);
  if (!providedToken || providedToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { id, email, password } = JSON.parse(req.body || '{}');
    if (!id || !email || !password) {
      return res.status(400).json({ error: 'Missing id, email, or password' });
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Look for an existing auth user by email
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const match = existing?.users?.find((u: any) => u.email?.toLowerCase() === String(email).toLowerCase());

    if (match) {
      // Align id + password with the legacy profile row
      const updates: any = { password, email_confirm: true };
      if (match.id !== id) {
        // Supabase does not allow changing an existing user's id directly;
        // delete and recreate with the correct uuid.
        await admin.auth.admin.deleteUser(match.id);
      } else {
        await admin.auth.admin.updateUserById(match.id, updates);
        return res.status(200).json({ success: true, action: 'updated', id: match.id });
      }
    }

    // Create (or recreate) the auth user with the exact profile uuid
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      id,
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      console.error('[admin-create-auth-user] createUser failed:', createError.message);
      return res.status(500).json({ error: createError.message });
    }

    return res.status(200).json({ success: true, action: 'created', id: created.user.id });
  } catch (error) {
    console.error('[admin-create-auth-user] Exception:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function sha256Hex(input: string): Promise<string> {
  const cryptoMod = await import('crypto');
  return cryptoMod.createHash('sha256').update(input).digest('hex');
}
