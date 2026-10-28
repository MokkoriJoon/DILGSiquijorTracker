import { supabase } from '../lib/supabase';
import type { TaskTemplate, TaskInstance, TaskStatus, RecurrenceType } from '../types';
import { AuthService } from './auth';

/**
 * Turn a raw Supabase/Postgres error message into an actionable, user-friendly
 * explanation. RLS failures for "old users" (no matching Supabase Auth account)
 * otherwise surface as the cryptic "new row violates row-level security policy".
 */
export function explainDbError(message: string | undefined, code?: string): string {
  const m = message || 'Unknown error';

  if (m.includes('row-level security') || m.includes('permission denied') || code === '42501' || code === 'PGRST301') {
    return (
      'You do not have permission to save this (database security blocked it). ' +
      'This usually means your account was created before Supabase Authentication was enabled, ' +
      'so you have no real login session. Please log out and log in again (the app will repair ' +
      'your account automatically), or ask a Super Admin to re-create your account in User Management.'
    );
  }

  if (m.includes('invalid input syntax for type integer')) {
    return 'Invalid date value was sent to the database. Please check the due date/day fields and try again.';
  }

  if (m.includes('duplicate key')) {
    return 'This record already exists. Please try again.';
  }

  if (m.includes('violates foreign key constraint')) {
    return 'The selected user or task no longer exists. Refresh the page and try again.';
  }

  return m;
}

// ============ HELPER FUNCTIONS ============

/**
 * Normalize any date representation coming from the app or the database into a
 * plain "YYYY-MM-DD" calendar-day string suitable for a Postgres DATE column.
 * Accepts "YYYY-MM-DD", full ISO timestamps like "2026-10-30T00:00:00.000Z",
 * and Date objects. This prevents errors such as:
 *   invalid input syntax for type integer: "2026-10-30T00:00:00.000Z"
 */
function toDateOnly(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).split('T')[0];
}

/**
 * Get today's date in the user's LOCAL timezone as YYYY-MM-DD.
 * (toISOString() uses UTC and can return yesterday/tomorrow depending on the
 * user's timezone offset.)
 */
function getLocalTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function calculateNextDueDate(recurrence: RecurrenceType, dueDay: number): string {
  const now = new Date();
  let target = new Date(now);
  
  switch (recurrence) {
    case 'DAILY':
      target.setDate(now.getDate() + 1);
      break;
    case 'WEEKLY':
      target.setDate(now.getDate() + 7);
      break;
    case 'MONTHLY':
      target.setMonth(now.getMonth() + 1);
      target.setDate(dueDay);
      if (target < now) target.setMonth(target.getMonth() + 1);
      break;
    case 'QUARTERLY':
      target.setMonth(now.getMonth() + 3);
      target.setDate(dueDay);
      if (target < now) target.setMonth(target.getMonth() + 3);
      break;
    case 'YEARLY':
      target.setFullYear(now.getFullYear() + 1);
      target.setDate(dueDay);
      if (target < now) target.setFullYear(target.getFullYear() + 1);
      break;
    default:
      target.setDate(now.getDate() + 7);
  }
  
  return target.toISOString().split('T')[0];
}

// ============ STANDALONE MAPPER FUNCTIONS ============

function mapTemplate(row: any): TaskTemplate {
  const dueDayRaw = row.due_day;
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    recurrence: row.recurrence,
    // due_day is an INTEGER column used only by recurring tasks (day of month).
    // One-time (ONCE) task due dates live in the template_due_date DATE column.
    // The legacy fallback (due date previously stuffed into due_day) keeps old
    // rows readable without breaking inserts on the integer column.
    dueDay: typeof dueDayRaw === 'number' ? dueDayRaw : undefined,
    dueDate: row.template_due_date
      ? String(row.template_due_date).split('T')[0]
      : (dueDayRaw && String(dueDayRaw).includes('-') ? String(dueDayRaw).split('T')[0] : undefined),
    dueDaysOfWeek: row.due_days_of_week || [],
    dueTime: row.due_time,
    startDate: row.start_date ? String(row.start_date).split('T')[0] : undefined,
    category: row.category,
    priority: row.priority,
    resourceLink: row.resource_link,
    visible: row.visible !== false, // Default to true if not set
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapInstance(row: any): TaskInstance {
  return {
    id: row.id,
    templateId: row.template_id,
    template: row.template ? mapTemplate(row.template) : null as any,
    assignedTo: row.assigned_to,
    assignee: row.assignee ? AuthService.mapUser(row.assignee) : null as any,
    dueDate: row.due_date,
    status: row.status,
    output: row.output,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

/**
 * Database Service - All task/template operations via Supabase
 */
export const DatabaseService = {
  // ============ TASK TEMPLATES ============
  
  async getTemplates(): Promise<TaskTemplate[]> {
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[DB] Error fetching templates:', error);
      return [];
    }
    
    return (data || []).map(mapTemplate);
  },

  async createTemplate(template: Omit<TaskTemplate, 'id' | 'createdAt'>): Promise<{ template: TaskTemplate | null; error?: string }> {
    // First, try to insert with resource_link
    const insertData: any = {
      title: template.title,
      description: template.description,
      recurrence: template.recurrence,
      category: template.category,
      priority: template.priority,
      visible: template.visible !== false, // Default to true
      created_by: template.createdBy,
    };

    // Date handling:
    // - due_day is an INTEGER column (day of month, 1-31) used ONLY by recurring
    //   tasks. Never write a date string into it (that caused:
    //   "invalid input syntax for type integer: 2026-10-30T00:00:00.000Z").
    // - ONCE (one-time) tasks store the full chosen due date in the
    //   template_due_date DATE column instead.
    if (template.recurrence === 'ONCE') {
      const dueDateOnly = toDateOnly(template.dueDate);
      if (dueDateOnly) {
        insertData.template_due_date = dueDateOnly;
      }
    } else if (typeof template.dueDay === 'number' && Number.isFinite(template.dueDay)) {
      insertData.due_day = Math.trunc(template.dueDay);
    }

    // Add daily recurrence fields if provided
    if (template.recurrence === 'DAILY') {
      if (template.dueDaysOfWeek && template.dueDaysOfWeek.length > 0) {
        insertData.due_days_of_week = template.dueDaysOfWeek;
      }
      if (template.dueTime) {
        insertData.due_time = template.dueTime;
      }
      if (template.startDate) {
        const startOnly = toDateOnly(template.startDate);
        if (startOnly) insertData.start_date = startOnly;
      }
    }

    // Only add resource_link if it's provided
    if (template.resourceLink) {
      insertData.resource_link = template.resourceLink;
    }

    const { data, error } = await supabase
      .from('task_templates')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('[DB] Error creating template:', error);
      
      // If the error is about a missing optional column (resource_link or
      // template_due_date), retry without it so older schemas still work.
      if (error.message?.includes('resource_link') ||
          error.message?.includes('template_due_date') ||
          error.code === '42703') {
        console.warn('[DB] Optional column missing, retrying without it...', error.message);

        const retryData: any = {
          title: template.title,
          description: template.description,
          recurrence: template.recurrence,
          category: template.category,
          priority: template.priority,
          created_by: template.createdBy,
        };
        if (template.recurrence === 'ONCE') {
          const dueDateOnly = toDateOnly(template.dueDate);
          // Only include template_due_date if that wasn't the missing column
          if (dueDateOnly && !error.message?.includes('template_due_date')) {
            retryData.template_due_date = dueDateOnly;
          }
        } else if (typeof template.dueDay === 'number' && Number.isFinite(template.dueDay)) {
          retryData.due_day = Math.trunc(template.dueDay);
        }
        if (template.recurrence === 'DAILY') {
          if (template.dueDaysOfWeek && template.dueDaysOfWeek.length > 0) {
            retryData.due_days_of_week = template.dueDaysOfWeek;
          }
          if (template.dueTime) retryData.due_time = template.dueTime;
          if (template.startDate) {
            const startOnly = toDateOnly(template.startDate);
            if (startOnly) retryData.start_date = startOnly;
          }
        }

        const { data: retryResult, error: retryError } = await supabase
          .from('task_templates')
          .insert(retryData)
          .select()
          .single();

        if (retryError) {
          return { template: null, error: explainDbError(retryError.message, retryError.code) };
        }

        return { template: mapTemplate(retryResult) };
      }
      
      return { template: null, error: explainDbError(error.message, error.code) };
    }
    
    return { template: mapTemplate(data) };
  },

  async deleteTemplate(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('task_templates')
      .delete()
      .eq('id', id);
    
    return !error;
  },

  async updateTemplate(id: string, updates: Partial<Omit<TaskTemplate, 'id' | 'createdAt' | 'createdBy'>>): Promise<TaskTemplate | null> {
    const updateData: any = {};
    
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.recurrence !== undefined) updateData.recurrence = updates.recurrence;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.resourceLink !== undefined) updateData.resource_link = updates.resourceLink || null;

    // Date handling:
    // - due_day is an INTEGER column (day of month) used only by recurring tasks.
    //   Never write a date string into it.
    // - ONCE (one-time) tasks store the chosen due date in template_due_date (DATE).
    const effectiveRecurrence = updates.recurrence;
    let newOnceDueDate: string | undefined;
    if (effectiveRecurrence === 'ONCE') {
      if (updates.dueDate !== undefined && updates.dueDate) {
        newOnceDueDate = toDateOnly(updates.dueDate);
        if (newOnceDueDate) updateData.template_due_date = newOnceDueDate;
      }
    } else if (typeof updates.dueDay === 'number' && Number.isFinite(updates.dueDay)) {
      updateData.due_day = Math.trunc(updates.dueDay);
    }

    // Add daily recurrence fields if provided
    if (updates.dueDaysOfWeek !== undefined) {
      updateData.due_days_of_week = updates.dueDaysOfWeek;
    }
    if (updates.dueTime !== undefined) {
      updateData.due_time = updates.dueTime;
    }
    if (updates.startDate !== undefined) {
      updateData.start_date = updates.startDate ? toDateOnly(updates.startDate) : null;
    }

    const { data, error } = await supabase
      .from('task_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error updating template:', error);
      return null;
    }

    // If this is a one-time task and the due date changed, also update the
    // due_date of its existing (not yet completed) instances so the change
    // is reflected everywhere.
    if (effectiveRecurrence === 'ONCE' && newOnceDueDate) {
      const { error: instError } = await supabase
        .from('task_instances')
        .update({ due_date: newOnceDueDate })
        .eq('template_id', id)
        .neq('status', 'COMPLETED');

      if (instError) {
        console.error('[DB] Error syncing instance due dates after template update:', instError);
      }
    }
    
    return mapTemplate(data);
  },

  async getInstancesByTemplate(templateId: string): Promise<TaskInstance[]> {
    const { data, error } = await supabase
      .from('task_instances')
      .select(`
        *,
        template:task_templates(*),
        assignee:users!task_instances_assigned_to_fkey(*)
      `)
      .eq('template_id', templateId)
      .order('due_date', { ascending: true });
    
    if (error) {
      console.error('[DB] Error fetching template instances:', error);
      return [];
    }
    
    return (data || []).map(mapInstance);
  },

  async updateTaskAssignments(templateId: string, userIds: string[]): Promise<boolean> {
    try {
      // Get current instances for this template
      const { data: currentInstances, error: fetchError } = await supabase
        .from('task_instances')
        .select('id, assigned_to')
        .eq('template_id', templateId);
      
      if (fetchError) {
        console.error('[DB] Error fetching current instances:', fetchError);
        return false;
      }

      const currentUserIds = (currentInstances || []).map((inst: any) => inst.assigned_to);
      
      // Find users to add (in new list but not in current)
      const usersToAdd = userIds.filter(id => !currentUserIds.includes(id));
      
      // Find users to remove (in current list but not in new)
      const usersToRemove = currentUserIds.filter((id: string) => !userIds.includes(id));

      // Get template details for creating new instances
      const { data: template, error: templateError } = await supabase
        .from('task_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (templateError || !template) {
        console.error('[DB] Error fetching template:', templateError);
        return false;
      }

      // Remove instances for users no longer assigned
      if (usersToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('task_instances')
          .delete()
          .eq('template_id', templateId)
          .in('assigned_to', usersToRemove);
        
        if (deleteError) {
          console.error('[DB] Error removing instances:', deleteError);
        }
      }

      // Add instances for new users
      if (usersToAdd.length > 0) {
        let dueDate: string;
        
        if (template.recurrence === 'ONCE') {
          // BUG FIX: previously this used "today" and ignored the chosen due date.
          // For one-time tasks the chosen due date is stored in template_due_date
          // (legacy rows may have it inside due_day), so use that instead of today.
          const mapped = mapTemplate(template);
          dueDate = mapped.dueDate || getLocalTodayString();
        } else if (template.recurrence === 'DAILY' && template.start_date) {
          // For DAILY tasks, use the start_date
          dueDate = String(template.start_date).split('T')[0];
        } else {
          // For other recurring tasks, calculate next due date
          dueDate = calculateNextDueDate(template.recurrence, template.due_day || 25);
        }

        const newInstances = usersToAdd.map(userId => ({
          template_id: templateId,
          assigned_to: userId,
          due_date: dueDate,
          due_time: template.due_time || null,
          status: 'PENDING',
        }));

        const { error: insertError } = await supabase
          .from('task_instances')
          .insert(newInstances);
        
        if (insertError) {
          console.error('[DB] Error adding instances:', insertError);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('[DB] Error updating task assignments:', error);
      return false;
    }
  },

  async getTaskAssignments(templateId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('task_assignments')
        .select('user_id')
        .eq('template_id', templateId);

      if (error) {
        console.error('[DB] Error fetching assignments:', error);
        return [];
      }

      return (data || []).map((a: any) => a.user_id);
    } catch (error) {
      console.error('[DB] Exception fetching assignments:', error);
      return [];
    }
  },

  // ============ PERSONAL BOOKMARKS ============

  async getPersonalBookmarks(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('personal_bookmarks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[DB] Error fetching bookmarks:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[DB] Exception fetching bookmarks:', error);
      return [];
    }
  },

  async createPersonalBookmark(bookmark: {
    userId: string;
    title: string;
    url: string;
    description?: string;
    category?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('personal_bookmarks')
        .insert({
          user_id: bookmark.userId,
          title: bookmark.title,
          url: bookmark.url,
          description: bookmark.description || null,
          category: bookmark.category || 'General',
        });

      if (error) {
        console.error('[DB] Error creating bookmark:', error);
        return { success: false, error: explainDbError(error.message, error.code) };
      }

      return { success: true };
    } catch (error) {
      console.error('[DB] Exception creating bookmark:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async updatePersonalBookmark(id: string, updates: {
    title?: string;
    url?: string;
    description?: string;
    category?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = { updated_at: new Date().toISOString() };
      
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.url !== undefined) updateData.url = updates.url;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.category !== undefined) updateData.category = updates.category;

      const { error } = await supabase
        .from('personal_bookmarks')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('[DB] Error updating bookmark:', error);
        return { success: false, error: explainDbError(error.message, error.code) };
      }

      return { success: true };
    } catch (error) {
      console.error('[DB] Exception updating bookmark:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async deletePersonalBookmark(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('personal_bookmarks')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[DB] Error deleting bookmark:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[DB] Exception deleting bookmark:', error);
      return false;
    }
  },

  // ============ TASK INSTANCES ============
  
  async getInstances(options?: { userId?: string; includeInvisible?: boolean }): Promise<TaskInstance[]> {
    let query = supabase
      .from('task_instances')
      .select(`
        *,
        template:task_templates(*),
        assignee:users!task_instances_assigned_to_fkey(*)
      `);

    // If not including invisible tasks, filter them out
    if (!options?.includeInvisible) {
      query = query.eq('template.visible', true);
    }

    const { data, error } = await query.order('due_date', { ascending: true });
    
    if (error) {
      console.error('[DB] Error fetching instances:', error);
      return [];
    }
    
    return (data || []).map(mapInstance);
  },

  async getInstancesByUser(userId: string): Promise<TaskInstance[]> {
    // Get ALL tasks for the user, including invisible ones
    const { data, error } = await supabase
      .from('task_instances')
      .select(`
        *,
        template:task_templates(*),
        assignee:users!task_instances_assigned_to_fkey(*)
      `)
      .eq('assigned_to', userId)
      .order('due_date', { ascending: true });
    
    if (error) {
      console.error('[DB] Error fetching user instances:', error);
      return [];
    }
    
    return (data || []).map(mapInstance);
  },

  async createInstance(instance: {
    templateId: string;
    assignedTo: string;
    dueDate: string;
    dueTime?: string;
    status?: TaskStatus;
  }): Promise<TaskInstance | null> {
    // Fetch template and assignee first
    const [templateResult, assigneeResult] = await Promise.all([
      supabase.from('task_templates').select('*').eq('id', instance.templateId).single(),
      supabase.from('users').select('*').eq('id', instance.assignedTo).single(),
    ]);
    
    if (templateResult.error || assigneeResult.error) {
      console.error('[DB] Error fetching related data');
      return null;
    }
    
    const { data, error } = await supabase
      .from('task_instances')
      .insert({
        template_id: instance.templateId,
        assigned_to: instance.assignedTo,
        due_date: instance.dueDate,
        due_time: instance.dueTime || null,
        status: instance.status || 'PENDING',
      })
      .select(`
        *,
        template:task_templates(*),
        assignee:users!task_instances_assigned_to_fkey(*)
      `)
      .single();
    
    if (error) {
      console.error('[DB] Error creating instance:', error);
      return null;
    }
    
    return mapInstance(data);
  },

  async updateInstanceStatus(
    id: string, 
    status: TaskStatus, 
    output?: string
  ): Promise<boolean> {
    const updates: any = { status };
    if (output !== undefined) updates.output = output;
    if (status === 'COMPLETED') {
      updates.completed_at = new Date().toISOString().split('T')[0];
    }
    
    const { error } = await supabase
      .from('task_instances')
      .update(updates)
      .eq('id', id);
    
    return !error;
  },

  // ============ RLS DIAGNOSTICS ============

  /**
   * Returns a human-readable reason why the CURRENT session cannot write data,
   * or null if everything looks good. Used to surface actionable errors instead
   * of silent RLS failures for "old users" (users whose public.users row has no
   * matching Supabase Auth account / session).
   */
  async diagnoseWriteAccess(userId: string): Promise<string | null> {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        return 'You are not signed in with a Supabase Auth session. This account was created before authentication was enabled ("old user"), so the database blocks all writes. Please ask an admin to re-create your account from User Management, or run FIX_OLD_USERS_AUTH_RLS.sql and log in again.';
      }

      if (authUser.id !== userId) {
        return `Your login id (${authUser.id}) does not match your user profile id (${userId}). Row-level security is blocking task/bookmark changes. An admin must align the two ids (re-create the user or run FIX_OLD_USERS_AUTH_RLS.sql).`;
      }

      // Verify the caller's own role row is readable (some old rows may be
      // invisible to RLS policies on the users table).
      const { error: probeError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', authUser.id)
        .maybeSingle();

      if (probeError) {
        return `RLS is blocking access to your own user record: ${probeError.message}. Run FIX_ALL_ADMIN_PERMISSIONS.sql / FIX_TASK_TEMPLATES_RLS_COMPLETE.sql in the Supabase SQL Editor.`;
      }

      return null;
    } catch (e) {
      console.warn('[DB] diagnoseWriteAccess exception:', e);
      return null;
    }
  },

  // ============ USERS ============
  
  async getUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[DB] Error fetching users:', error);
      return [];
    }
    
    return data || [];
  },

  async createUser(userData: {
    email: string;
    name: string;
    department: string;
    position?: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'STANDARD';
    password: string;
  }) {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          full_name: userData.name,
          department: userData.department,
          position: userData.position,
          role: userData.role,
        },
      },
    });
    
    if (authError) return { success: false, error: authError.message };
    if (!authData.user) return { success: false, error: 'Failed to create user' };
    
    // Create profile with password stored for admin visibility
    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        id: authData.user.id,
        email: userData.email,
        name: userData.name,
        department: userData.department,
        position: userData.position,
        role: userData.role,
        password: userData.password, // Store plain text password for admin view
      }, { onConflict: 'id' });
    
    if (profileError) {
      return { success: false, error: profileError.message };
    }
    
    return { success: true };
  },

  /**
   * SHA-256 hex of the Supabase service role key, used as the shared-secret
   * token for server-side admin endpoints (/api/admin-delete-user).
   * Resolution order:
   *   1. VITE_SUPABASE_SERVICE_TOKEN build-time env var (precomputed hash).
   *   2. The gated Postgres RPC public.get_service_token_hash() (installed by
   *      FIX_USER_DELETE_PERMISSIONS.sql) — callable only with the anon key;
   *      the DB itself refuses to return it unless the caller's session maps
   *      to an ADMIN/SUPER_ADMIN row in public.users. Fetched once and cached.
   */
  async getAdminToken(): Promise<string | null> {
    const precomputed = (import.meta as any).env?.VITE_SUPABASE_SERVICE_TOKEN;
    if (precomputed) return String(precomputed);

    if (!(DatabaseService as any)._adminTokenPromise) {
      (DatabaseService as any)._adminTokenPromise = (async () => {
        try {
          const { data, error } = await supabase.rpc('get_service_token_hash');
          if (error || !data) {
            console.warn('[DB] get_service_token_hash unavailable:', error?.message);
            return null;
          }
          return String(data);
        } catch (e) {
          console.warn('[DB] Could not fetch admin token:', e);
          return null;
        }
      })();
    }
    return (DatabaseService as any)._adminTokenPromise;
  },

  /**
   * POST to a server-side admin endpoint. Sends the shared-secret token when
   * available, but ALWAYS sends the Bearer JWT — the endpoints accept a
   * verified admin JWT alone as a bootstrap path (see api/_shared.ts), which
   * makes deletes work even before the SQL migration / secrets row exists.
   */
  async callAdminEndpoint(
    path: string,
    payload: Record<string, any>,
  ): Promise<{ ok: boolean; status: number; result: any; networkError?: string }> {
    const token = await this.getAdminToken();
    let accessToken: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      accessToken = data?.session?.access_token;
    } catch {
      /* legacy custom-login session: no JWT available */
    }
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(token ? { ...payload, token } : payload),
      });
      const result = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, result };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        result: {},
        networkError: e instanceof Error ? e.message : 'Network error',
      };
    }
  },

  async deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
    // Deleting another user (especially one whose profile has no matching
    // auth.uid()) cannot be done through RLS with the anon key, and removing
    // the Supabase Auth account requires the service role. Both are handled
    // server-side by /api/admin-delete-user (see api/admin-delete-user.ts).
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''))) {
      return {
        success: false,
        error: `The selected account has an invalid id ("${id}"). Reload the user list and try again.`,
      };
    }

    const endpointHit = await this.callAdminEndpoint('/api/admin-delete-user', { id });
    if (endpointHit.ok && endpointHit.result?.success) {
      return { success: true };
    }
    if (endpointHit.status === 404) {
      // Endpoint not deployed yet - fall back to the client-side path below.
      console.warn('[DB] /api/admin-delete-user not found; falling back to direct delete.');
    } else if (endpointHit.status !== 0) {
      // The endpoint IS deployed — report its real error instead of silently
      // falling through to an anon-key delete that RLS will block anyway.
      console.error('[DB] Admin delete endpoint failed:', endpointHit.result);
      const detail = endpointHit.result?.error
        || endpointHit.result?.message
        || (typeof endpointHit.result === 'string' ? endpointHit.result.slice(0, 300) : '');
      return {
        success: false,
        error:
          detail ||
          `The delete endpoint returned HTTP ${endpointHit.status} with no error message. ` +
          'Check the Vercel function logs for /api/admin-delete-user, and run ' +
          'FIX_USER_DELETE_FOREIGN_KEYS.sql in the Supabase SQL Editor.',
      };
    } else {
      console.warn('[DB] Admin delete endpoint unreachable:', endpointHit.networkError);
    }

    // Fallback: direct deletes with the anon key (works only if the RLS
    // policies from FIX_USER_DELETE_PERMISSIONS.sql are installed).
    // 1) Delete the profile row from the users table.
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (userError) {
      console.error('[DB] Error deleting user:', userError);
      return { success: false, error: userError.message };
    }

    // No rows actually removed? RLS silently filtered the DELETE.
    const { data: stillThere, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (!checkError && stillThere) {
      return {
        success: false,
        error:
          'Row-level security blocked the delete (the user is still in the database). ' +
          'Deploy api/admin-delete-user.ts with SUPABASE_SERVICE_ROLE_KEY set, and run ' +
          'FIX_USER_DELETE_PERMISSIONS.sql in the Supabase SQL Editor.',
      };
    }

    // 2) Clean up related data so nothing is left dangling.
    //    Task instances assigned to this user are removed first (they have a
    //    foreign key to users), then any explicit assignment rows.
    const { error: instError } = await supabase
      .from('task_instances')
      .delete()
      .eq('assigned_to', id);
    if (instError) console.warn('[DB] Could not clean task instances for deleted user:', instError.message);

    const { error: assignError } = await supabase
      .from('task_assignments')
      .delete()
      .eq('user_id', id);
    if (assignError) console.warn('[DB] Could not clean task assignments for deleted user:', assignError.message);

    const { error: notifError } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', id);
    if (notifError) console.warn('[DB] Could not clean notifications for deleted user:', notifError.message);

    const { error: bmError } = await supabase
      .from('personal_bookmarks')
      .delete()
      .eq('user_id', id);
    if (bmError) console.warn('[DB] Could not clean bookmarks for deleted user:', bmError.message);

    // 3) Also try to remove the Supabase Auth account so the email can be
    //    reused. Requires the service role, so this usually fails from the
    //    browser; failure here is non-fatal.
    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(id);
      if (authError) {
        console.warn('[DB] Could not delete auth user (profile was removed):', authError.message);
      }
    } catch (e) {
      console.warn('[DB] Auth user cleanup skipped:', e);
    }

    return { success: true };
  },

  /**
   * Full clean-slate reset: deletes ALL accounts (public.users profiles, every
   * related row, and every Supabase Auth user) and re-creates one guaranteed
   * Super Admin so the login/registration system can be rebuilt from scratch:
   * Super Admin first, then Admins, then Standard users.
   *
   * Handled server-side by /api/admin-reset-users (service role key). Only a
   * verified SUPER_ADMIN caller with { confirm: "RESET" } is accepted.
   */
  async resetAllUsers(overrides?: {
    superAdminEmail?: string;
    superAdminPassword?: string;
    superAdminName?: string;
    superAdminDepartment?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    warning?: string;
    result?: any;
  }> {
    const hit = await this.callAdminEndpoint('/api/admin-reset-users', {
      confirm: 'RESET',
      ...(overrides || {}),
    });

    if (hit.ok && hit.result?.success) {
      // Drop our own stale session/storage — our old auth user no longer
      // exists after the wipe. The app will bounce to the login screen.
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      sessionStorage.removeItem('dilg_current_user');
      return { success: true, result: hit.result };
    }

    if (hit.status === 404) {
      return {
        success: false,
        error:
          'Reset endpoint not deployed yet. Deploy api/admin-reset-users.ts to Vercel ' +
          '(with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set), then try again.',
      };
    }
    if (hit.status !== 0) {
      return {
        success: false,
        error:
          hit.result?.error ||
          hit.result?.message ||
          `The reset endpoint returned HTTP ${hit.status}. Check the Vercel function logs for /api/admin-reset-users.`,
        warning: hit.result?.warning,
      };
    }
    return {
      success: false,
      error: `Could not reach /api/admin-reset-users (${hit.networkError || 'network error'}).`,
    };
  },

  /**
   * Repair a legacy user's Supabase Auth account WITHOUT deleting anything.
   *
   * "Old users" (created before Supabase Auth was wired up) have no matching
   * row in auth.users — they show as "No authentication logs available" in
   * the Supabase dashboard and every RLS policy that checks auth.uid() fails,
   * so they cannot add/assign tasks or save bookmarks. This calls the
   * server-side endpoint /api/admin-repair-auth (service role key) which
   * provisions/re-keys their auth account using the SAME uuid as their
   * public.users.id and the SAME email + stored password — so their login
   * credentials are unchanged, but from their next sign-in they get a real
   * JWT session and all RLS policies pass again.
   *
   * NOTE: this method works even when the caller's own browser session is the
   * custom (no-JWT) fallback login — the admin token alone authenticates the
   * request; the Bearer header is only sent when a real session exists.
   */
  async repairUserAuth(id: string): Promise<{ success: boolean; action?: string; temporaryPassword?: string; error?: string }> {
    // The endpoint accepts a verified admin JWT alone (bootstrap path) even
    // when no shared-secret token is configured yet — see api/_shared.ts.
    const hit = await this.callAdminEndpoint('/api/admin-repair-auth', { id });
    if (hit.ok && hit.result?.success) {
      return {
        success: true,
        action: hit.result.action,
        temporaryPassword: hit.result.temporaryPassword,
      };
    }
    if (hit.status === 404) {
      return {
        success: false,
        error: 'Repair endpoint not deployed yet. Deploy api/admin-repair-auth.ts to Vercel.',
      };
    }
    return {
      success: false,
      error:
        hit.result?.error ||
        hit.networkError ||
        `The repair endpoint returned HTTP ${hit.status}. Check the Vercel function logs for /api/admin-repair-auth.`,
    };
  },

  /**
   * Update a user profile from User Management.
   *
   * Role-assignment rules (enforced here AND in the DB via RLS):
   *   - Only a SUPER_ADMIN may change anyone's ROLE.
   *   - A SUPER_ADMIN can assign STANDARD or ADMIN (and grant SUPER_ADMIN).
   *   - The last remaining SUPER_ADMIN can never be demoted.
   *   - Password changes additionally go through /api/admin-create-auth-user
   *     so the Supabase Auth credential stays in sync with users.password.
   */
  async updateUser(id: string, updates: { name?: string; department?: string; position?: string; role?: 'SUPER_ADMIN' | 'ADMIN' | 'STANDARD'; password?: string }): Promise<{ success: boolean; error?: string }> {
    const caller = (await AuthService.getCurrentUser()) as any;

    // ---- Guard for role changes ----
    if (updates.role !== undefined) {
      const newRole = String(updates.role).toUpperCase();
      if (!['STANDARD', 'ADMIN', 'SUPER_ADMIN'].includes(newRole)) {
        return { success: false, error: `Invalid role "${updates.role}".` };
      }
      if (!caller || String(caller.role).toUpperCase() !== 'SUPER_ADMIN') {
        return { success: false, error: 'Only a Super Admin can assign roles (ADMIN / STANDARD).' };
      }

      // Load the target row to validate the transition.
      const { data: target, error: targetError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', id)
        .maybeSingle();
      if (targetError) {
        return { success: false, error: explainDbError(targetError.message, targetError.code) };
      }
      if (!target) {
        return { success: false, error: 'User not found. Reload the user list and try again.' };
      }
      const oldRole = String(target.role || '').toUpperCase();
      if (oldRole === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN') {
        const { count, error: countError } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'SUPER_ADMIN');
        if (countError || (count ?? 0) <= 1) {
          return { success: false, error: 'You cannot demote the last remaining Super Admin.' };
        }
      }
    }

    const updateData: any = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.department !== undefined) updateData.department = updates.department;
    if (updates.position !== undefined) updateData.position = updates.position;
    if (updates.role !== undefined) updateData.role = String(updates.role).toUpperCase();
    if (updates.password !== undefined) updateData.password = updates.password;

    console.log('[DB] Updating user:', id, 'with data:', updateData);

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('[DB] Error updating user:', error);
      return { success: false, error: explainDbError(error.message, error.code) };
    }

    // Check if any rows were actually updated
    if (!data || data.length === 0) {
      console.error('[DB] No rows were updated. This might be a permissions issue.');
      return { success: false, error: 'No rows were updated. Check RLS policies.' };
    }

    // Keep the Supabase Auth credential in sync when the password changed, so
    // the account keeps signing in through real Auth (not just legacy fallback).
    if (updates.password) {
      const emailRow = Array.isArray(data) ? data[0]?.email : undefined;
      if (emailRow) {
        try {
          await fetch('/api/admin-create-auth-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, email: emailRow, password: updates.password }),
          });
        } catch (e) {
          console.warn('[DB] Could not sync auth password (profile saved anyway):', e);
        }
      }
    }

    console.log('[DB] User updated successfully:', data);
    return { success: true };
  },

  // ============ STATS ============
  
  async getStats() {
    const instances = await this.getInstances();
    
    return {
      total: instances.length,
      completed: instances.filter(i => i.status === 'COMPLETED').length,
      pending: instances.filter(i => i.status === 'PENDING').length,
      inProgress: instances.filter(i => i.status === 'IN_PROGRESS').length,
      submitted: instances.filter(i => i.status === 'SUBMITTED').length,
      overdue: instances.filter(i => i.status === 'OVERDUE').length,
      completionRate: instances.length > 0
        ? Math.round((instances.filter(i => i.status === 'COMPLETED').length / instances.length) * 100)
        : 0,
    };
  },
};

// ============ ALIASES FOR BACKWARD COMPATIBILITY ============

// TemplateService alias
export const TemplateService = {
  getAll: () => DatabaseService.getTemplates(),
  create: (template: Omit<TaskTemplate, 'id' | 'createdAt'>) => DatabaseService.createTemplate(template),
  delete: (id: string) => DatabaseService.deleteTemplate(id),
  getById: async (id: string) => {
    const templates = await DatabaseService.getTemplates();
    return templates.find(t => t.id === id);
  },
};

// InstanceService alias
export const InstanceService = {
  getAll: () => DatabaseService.getInstances(),
  getByUser: (userId: string) => DatabaseService.getInstancesByUser(userId),
  create: (instance: any) => DatabaseService.createInstance(instance),
  updateStatus: (id: string, status: TaskStatus, output?: string) => 
    DatabaseService.updateInstanceStatus(id, status, output),
  getByTemplate: async (templateId: string) => {
    const instances = await DatabaseService.getInstances();
    return instances.filter(i => i.templateId === templateId);
  },
  getStats: () => DatabaseService.getStats(),
};

// UserService alias
export const UserService = {
  getAll: () => DatabaseService.getUsers(),
  getById: async (id: string) => {
    const users = await DatabaseService.getUsers();
    return users.find((u: any) => u.id === id);
  },
  getByEmail: async (email: string) => {
    const users = await DatabaseService.getUsers();
    return users.find((u: any) => u.email === email);
  },
  create: (userData: any) => DatabaseService.createUser(userData),
  update: async (id: string, updates: any) => {
    // Update the users table
    const result = await DatabaseService.updateUser(id, updates);
    
    // If password was updated, it's stored in the users table
    // We'll use custom authentication that checks the users table
    if (result.success && updates.password) {
      console.log('[Auth] Password updated in users table for user:', id);
    }
    
    return result;
  },
  delete: (id: string) => DatabaseService.deleteUser(id),
  repairAuth: (id: string) => DatabaseService.repairUserAuth(id),
  resetAll: (overrides?: {
    superAdminEmail?: string;
    superAdminPassword?: string;
    superAdminName?: string;
    superAdminDepartment?: string;
  }) => DatabaseService.resetAllUsers(overrides),
};

// Reset function (clears all data - use with caution)
export function resetDatabase() {
  // In production with Supabase, this would require admin access
  // For now, just log a warning
  console.warn('[DB] resetDatabase called - not implemented for Supabase. Use Supabase dashboard to clear data.');
}

// Initialize function (no-op for Supabase)
export function initializeDatabase() {
  // No-op - Supabase handles initialization
  console.log('[DB] Database initialized (Supabase mode)');
}
