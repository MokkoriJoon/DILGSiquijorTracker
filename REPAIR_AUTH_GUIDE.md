# Repair Auth — Fix "Old Users" WITHOUT Deleting Their Accounts

## The question
> "The fix for the old user (no auth/logs) was to delete and recreate. Is there no other way —
> maybe a button in the Super Admin panel to refresh/renew that account with the SAME login, so
> those users get proper auth/logs and can add/assign tasks and bookmarks?"

**Yes.** That is exactly what this feature does. No more delete-and-recreate of user accounts.

## What "Repair Auth" does (and doesn't do)

For each legacy user it **creates/fixes only the hidden Supabase Auth record** (`auth.users`):

| Case | Action | User's login afterwards |
|---|---|---|
| No `auth.users` row exists ("No authentication logs available") | Creates one with the **exact same uuid** as `public.users.id` and the **same email + stored password** | Unchanged — same email & password |
| `auth.users` row exists but under a different uuid | Re-keys **only the auth row** to match the profile id (profile, tasks, bookmarks untouched) | Unchanged |
| Everything already matches | Just re-syncs password/email-confirm flags | Unchanged |

Nothing in `public.users`, `task_instances`, `task_assignments`, or `personal_bookmarks` is ever deleted by this action.

After repairing, the user simply **logs out and logs back in once**. From then on they have a real
Supabase JWT session, `auth.uid()` works, RLS policies pass, and adding/assigning tasks and saving
bookmarks succeed. (The app also auto-provisions on login via `/api/admin-create-auth-user`, but the
button lets a Super Admin fix everyone up-front without waiting for each user to log in.)

Edge case: if a profile has **no stored password at all**, a temporary one is generated and shown
in the success message so you can hand it to the user.

## Where the button lives
`User Management` page → each row now has a green 🔧 **Wrench ("Repair Auth")** button before the
Key/Edit/Delete buttons. Legacy users are flagged with a red **"No Auth"** badge next to their name
(via the `get_auth_status` RPC). Permissions mirror deletion: SUPER_ADMIN can repair anyone;
ADMIN cannot repair SUPER_ADMIN accounts.

## Files changed / added
- **`api/admin-repair-auth.ts`** (new) — server endpoint using the service-role key. Secured with
  the same defense-in-depth as `admin-delete-user`: shared-secret token (sha256 of service key) +
  caller JWT role check. If the Super Admin themself is still on a legacy no-JWT session, the
  endpoint falls back to verifying that a provisioned admin auth account exists with sign-ins.
- **`src/services/database.ts`** — `DatabaseService.repairUserAuth(id)` + `UserService.repairAuth(id)`.
- **`src/pages/UserManagement.tsx`** — Repair Auth button, "No Auth" badges, success/error banner.
- **`FIX_OLD_USERS_AUTH_RLS.sql`** — appended `public.get_auth_status(uuid[])` RPC (SECURITY DEFINER,
  gated to ADMIN/SUPER_ADMIN) that powers the badges.

## Deployment checklist
1. Run **`FIX_OLD_USERS_AUTH_RLS.sql`** (whole file, including the new section 6) and
   **`FIX_USER_DELETE_PERMISSIONS.sql`** in the Supabase SQL Editor.
2. Make sure Vercel env vars are set (same ones used for the delete fix):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - either `VITE_SUPABASE_SERVICE_TOKEN` (sha256 of the service key) **or** the
     `site_secrets.admin_token_sha256` row from FIX_USER_DELETE_PERMISSIONS.sql.
3. Redeploy (the new `api/admin-repair-auth.ts` function must be included).
4. In User Management, click the 🔧 button on every "No Auth" user, then ask those users to
   log out and log back in once.

## How to verify it worked
- Supabase Dashboard → Authentication → Users: the legacy user now appears with an entry in
  **Logs** after their next sign-in.
- The user can create/assign a task and add a bookmark without the RLS error
  (`new row violates row-level security policy`).
