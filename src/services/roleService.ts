import { supabase } from '../lib/supabase';
import type { Role } from '../types';

/**
 * Central role policy for the login / registration system.
 *
 * Tiering rules:
 *  - The VERY FIRST account ever registered becomes SUPER_ADMIN.
 *  - Every other self-registered account is STANDARD.
 *  - ADMIN (and additional SUPER_ADMIN) accounts are never self-registered —
 *    only an existing SUPER_ADMIN can assign them from User Management.
 */

export const ASSIGNABLE_ROLES: Role[] = ['STANDARD', 'ADMIN'];

export function isStaffRole(role?: string | null): boolean {
  return String(role || '').toUpperCase() === 'ADMIN' || String(role || '').toUpperCase() === 'SUPER_ADMIN';
}

/**
 * Can `actor` change a target account's role to `newRole`?
 *  - SUPER_ADMIN may assign STANDARD or ADMIN (or grant SUPER_ADMIN).
 *  - Nobody else may change roles at all.
 */
export function canAssignRole(
  actor: { role?: string | null } | null | undefined,
  newRole: string,
  target?: { role?: string | null; id?: string } | null,
): boolean {
  if (!actor) return false;
  if (String(actor.role).toUpperCase() !== 'SUPER_ADMIN') return false;

  const normalized = String(newRole || '').toUpperCase();
  if (!['STANDARD', 'ADMIN', 'SUPER_ADMIN'].includes(normalized)) return false;

  // A Super Admin must not demote the last remaining Super Admin.
  if (target && String(target.role).toUpperCase() === 'SUPER_ADMIN' && normalized !== 'SUPER_ADMIN') {
    return false; // caller should additionally verify "last super admin" via countSuperAdmins()
  }
  return true;
}

/** Count SUPER_ADMIN rows (used to protect against demoting the last one). */
export async function countSuperAdmins(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'SUPER_ADMIN');
    if (error) return 1; // fail closed: assume protected when we cannot tell
    return count ?? 0;
  } catch {
    return 1;
  }
}

/**
 * Is this email/account the first one in the system? (First user → SUPER_ADMIN.)
 * Falls back to the serverless bootstrap-status endpoint when RLS blocks the
 * direct count on the users table.
 */
export async function checkIsFirstUser(): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (!error) return (count ?? 0) === 0;

    console.warn('[Roles] Direct user count blocked by RLS; querying bootstrap status endpoint...');
    const res = await fetch('/api/admin-bootstrap-status');
    if (res.ok) {
      const j = await res.json();
      return Number(j.userCount ?? 0) === 0;
    }
  } catch (e) {
    console.warn('[Roles] checkIsFirstUser failed:', e);
  }
  // Unknown state: be conservative and treat as NOT first (no privilege grants),
  // unless the database itself is missing (fresh install) — signUp/profile insert
  // will still enforce the authoritative decision server-side in AuthService.
  return false;
}
