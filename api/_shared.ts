import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared helpers for the server-side admin endpoints:
 *   - api/admin-delete-user.ts
 *   - api/admin-repair-auth.ts
 *   - api/admin-create-auth-user.ts
 *
 * Why this exists: every one of these endpoints needs the same three things —
 * a service-role Supabase client, verification that the caller is a real
 * ADMIN/SUPER_ADMIN, and a way to bootstrap trust when the deployment has no
 * shared secret configured yet (the "chicken-and-egg" state where the gated
 * get_service_token_hash RPC / site_secrets row has not been created, which
 * previously made deletes fall through to the anon key and get silently
 * blocked by RLS).
 */

export function getServiceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  // Serverless functions never use realtime channels. On Node runtimes
  // without a native WebSocket (Node <22, still selectable on Vercel),
  // @supabase/supabase-js throws at createClient() unless we provide one via
  // the realtime `transport` option — pass a no-op stub so admin endpoints
  // work regardless of the runtime's Node version.
  const hasNativeWebSocket = typeof (globalThis as any).WebSocket === 'function';
  class NoopWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = 0;
    onopen: any = null;
    onclose: any = null;
    onmessage: any = null;
    onerror: any = null;
    send() {}
    close() { this.readyState = 3; }
    addEventListener() {}
    removeEventListener() {}
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(hasNativeWebSocket ? {} : { realtime: { transport: NoopWebSocket as any } }),
  });
}

export async function sha256Hex(input: string): Promise<string> {
  const cryptoMod = await import('crypto');
  return cryptoMod.createHash('sha256').update(input).digest('hex');
}

/** The token(s) clients may present: sha256(service role key), plus the
 *  literal VITE_SUPABASE_SERVICE_TOKEN / SUPABASE_SERVICE_TOKEN value when
 *  one is configured. Returns a promise of the accepted list. */
export async function expectedAdminTokens(serviceKey: string): Promise<string[]> {
  const out: string[] = [await sha256Hex(serviceKey)];
  const configured =
    process.env.VITE_SUPABASE_SERVICE_TOKEN || process.env.SUPABASE_SERVICE_TOKEN;
  if (configured) out.push(String(configured));
  return out;
}

export interface CallerIdentity {
  id: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'STANDARD' | '';
}

/** Verify a Supabase JWT against the users table. Returns role '' when the
 *  JWT is missing/invalid or has no matching profile row. */
export async function verifyCallerJwt(
  admin: SupabaseClient,
  jwt?: string,
): Promise<CallerIdentity> {
  if (!jwt) return { id: null, role: '' };
  try {
    const { data } = await admin.auth.getUser(jwt);
    const uid = data?.user?.id ?? null;
    if (!uid) return { id: null, role: '' };
    const { data: row } = await admin
      .from('users')
      .select('id, role')
      .eq('id', uid)
      .maybeSingle();
    const role = (row?.role || '').toUpperCase();
    return { id: uid, role: (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'STANDARD') ? role : '' };
  } catch {
    return { id: null, role: '' };
  }
}

/** True when at least one ADMIN/SUPER_ADMIN profile has a real auth account
 *  with a recorded sign-in — i.e. the deployment genuinely has provisioned
 *  admins logged in. Used as the fallback trust anchor when no Bearer JWT or
 *  stored token hash is available. */
export async function hasProvisionedAdminSession(admin: SupabaseClient): Promise<boolean> {
  const { data: adminRows } = await admin
    .from('users')
    .select('id')
    .in('role', ['SUPER_ADMIN', 'ADMIN']);
  const adminIds = (adminRows || []).map((r: any) => r.id);
  if (adminIds.length === 0) return false;
  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return !!listed?.users?.some((u: any) => adminIds.includes(u.id) && u.last_sign_in_at);
}

/**
 * Authorize an admin action. Accepts (any one of):
 *   A. Correct shared-secret token (sha256 of the service key, or the value
 *      stored in site_secrets.admin_token_sha256) AND either a valid admin
 *      JWT OR a verified provisioned-admin session (legacy-login case).
 *   B. NO token at all, but a valid ADMIN/SUPER_ADMIN Bearer JWT, AND the
 *      deployment has no shared secret configured yet (no
 *      VITE_SUPABASE_SERVICE_TOKEN env var and no site_secrets row). This is
 *      the bootstrap path that fixes the chicken-and-egg failure where the
 *      SQL migration / secrets row was never run: the caller's identity is
 *      fully verified by Supabase itself, so the action is safe. Once a
 *      secret exists, path B closes automatically.
 *
 * Returns the caller identity on success, or an error object to send back.
 */
export async function authorizeAdmin(req: any): Promise<
  | { ok: true; caller: CallerIdentity; bootstrapped: boolean }
  | { ok: false; status: number; error: string }
> {
  const admin = getServiceClient();
  if (!admin) {
    return {
      ok: false,
      status: 500,
      error:
        'Server not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables, then redeploy.',
    };
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
  const token: string | undefined = body.token || req.headers['x-admin-token'];
  const callerJwt: string | undefined =
    typeof req.headers.authorization === 'string'
      ? req.headers.authorization.replace(/^Bearer\s+/i, '')
      : undefined;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const caller = await verifyCallerJwt(admin, callerJwt);
  const isAdminCaller = caller.role === 'ADMIN' || caller.role === 'SUPER_ADMIN';

  // Resolve the acceptable token(s): env-derived hash/literal + DB-stored hash.
  const candidates = new Set<string>(await expectedAdminTokens(serviceKey));
  let storedHash: string | null = null;
  try {
    const { data: stored } = await admin
      .from('site_secrets')
      .select('value')
      .eq('key', 'admin_token_sha256')
      .maybeSingle();
    storedHash = stored?.value ? String(stored.value) : null;
    if (storedHash) candidates.add(storedHash);
  } catch {
    /* site_secrets table may not exist yet (SQL migration not run) */
  }

  const envHasSecret = Boolean(
    process.env.VITE_SUPABASE_SERVICE_TOKEN || process.env.SUPABASE_SERVICE_TOKEN,
  );
  const secretConfigured = envHasSecret || Boolean(storedHash);

  if (token) {
    // Path A: shared secret presented.
    if (!candidates.has(token)) {
      return { ok: false, status: 401, error: 'Unauthorized (bad admin token)' };
    }
    if (isAdminCaller) return { ok: true, caller, bootstrapped: false };
    // Legacy login (no JWT): require a verified provisioned admin session.
    if (await hasProvisionedAdminSession(admin)) {
      return {
        ok: true,
        caller: { id: caller.id, role: 'SUPER_ADMIN' },
        bootstrapped: false,
      };
    }
    return {
      ok: false,
      status: 401,
      error:
        'You must be signed in with a real Supabase session to perform admin actions. ' +
        'Use the "Repair Auth" button on your own account first, then log out and back in.',
    };
  }

  // Path B: bootstrap — no token given. Only allowed while NO shared secret
  // is configured anywhere, and only with a fully verified admin JWT.
  if (!secretConfigured && isAdminCaller) {
    return { ok: true, caller, bootstrapped: true };
  }

  return {
    ok: false,
    status: 401,
    error:
      'Missing admin token. Run FIX_USER_DELETE_PERMISSIONS.sql in the Supabase SQL Editor ' +
      '(it installs the gated get_service_token_hash RPC the app uses to obtain the token), ' +
      'or set VITE_SUPABASE_SERVICE_TOKEN in Vercel.',
  };
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
}

/** Convenience wrapper: parse JSON body safely. */
export function parseBody(req: any): any {
  return typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
}
