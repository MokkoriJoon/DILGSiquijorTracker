import { getServiceClient } from './_shared';

export const config = {
  runtime: 'nodejs',
};

/**
 * GET /api/admin-bootstrap-status
 *
 * Tiny, SAFE bootstrap helper for the registration flow. When RLS blocks an
 * anonymous client from counting public.users (the "is this the very first
 * account?" check that decides whether the new user becomes SUPER_ADMIN),
 * the client asks THIS endpoint instead. It runs with the service role key
 * and returns only non-sensitive aggregates:
 *
 *   { userCount: number, hasSuperAdmin: boolean }
 *
 * No emails, names, ids or roles of individual accounts are ever exposed.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = getServiceClient();
  if (!admin) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    const { count } = await admin
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { data: superRows } = await admin
      .from('users')
      .select('id')
      .eq('role', 'SUPER_ADMIN')
      .limit(1);

    return res.status(200).json({
      userCount: count ?? 0,
      hasSuperAdmin: (superRows?.length ?? 0) > 0,
    });
  } catch (error) {
    console.error('[admin-bootstrap-status] Exception:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
