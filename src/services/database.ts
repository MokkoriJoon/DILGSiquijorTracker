import { supabase } from '../lib/supabase';
import type { TaskTemplate, TaskInstance, TaskStatus, RecurrenceType } from '../types';
import { AuthService } from './auth';

// ============ HELPER FUNCTIONS ============

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
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    recurrence: row.recurrence,
    dueDay: row.due_day,
    dueDaysOfWeek: row.due_days_of_week || [],
    dueTime: row.due_time,
    startDate: row.start_date,
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
      due_day: template.dueDay,
      category: template.category,
      priority: template.priority,
      visible: template.visible !== false, // Default to true
      created_by: template.createdBy,
    };

    // Add daily recurrence fields if provided
    if (template.recurrence === 'DAILY') {
      if (template.dueDaysOfWeek && template.dueDaysOfWeek.length > 0) {
        insertData.due_days_of_week = template.dueDaysOfWeek;
      }
      if (template.dueTime) {
        insertData.due_time = template.dueTime;
      }
      if (template.startDate) {
        insertData.start_date = template.startDate;
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
      
      // If the error is about resource_link column not existing, try again without it
      if (error.message?.includes('resource_link') || error.code === '42703') {
        console.warn('[DB] resource_link column missing, retrying without it...');
        
        const { data: retryData, error: retryError } = await supabase
          .from('task_templates')
          .insert({
            title: template.title,
            description: template.description,
            recurrence: template.recurrence,
            due_day: template.dueDay,
            category: template.category,
            priority: template.priority,
            created_by: template.createdBy,
          })
          .select()
          .single();
        
        if (retryError) {
          return { template: null, error: retryError.message };
        }
        
        return { template: mapTemplate(retryData) };
      }
      
      return { template: null, error: error.message };
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
    if (updates.dueDay !== undefined) updateData.due_day = updates.dueDay;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.resourceLink !== undefined) updateData.resource_link = updates.resourceLink || null;
    
    // Add daily recurrence fields if provided
    if (updates.dueDaysOfWeek !== undefined) {
      updateData.due_days_of_week = updates.dueDaysOfWeek;
    }
    if (updates.dueTime !== undefined) {
      updateData.due_time = updates.dueTime;
    }
    if (updates.startDate !== undefined) {
      updateData.start_date = updates.startDate;
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
        const dueDate = template.recurrence === 'ONCE' 
          ? new Date().toISOString().split('T')[0]
          : calculateNextDueDate(template.recurrence, template.due_day || 25);

        const newInstances = usersToAdd.map(userId => ({
          template_id: templateId,
          assigned_to: userId,
          due_date: dueDate,
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
        role: userData.role,
        password: userData.password, // Store plain text password for admin view
      }, { onConflict: 'id' });
    
    if (profileError) {
      return { success: false, error: profileError.message };
    }
    
    return { success: true };
  },

  async deleteUser(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    
    return !error;
  },

  async updateUser(id: string, updates: { name?: string; department?: string; role?: 'SUPER_ADMIN' | 'ADMIN' | 'STANDARD'; password?: string }): Promise<{ success: boolean; error?: string }> {
    const updateData: any = {};
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.department !== undefined) updateData.department = updates.department;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.password !== undefined) updateData.password = updates.password;

    console.log('[DB] Updating user:', id, 'with data:', updateData);

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('[DB] Error updating user:', error);
      return { success: false, error: error.message };
    }

    // Check if any rows were actually updated
    if (!data || data.length === 0) {
      console.error('[DB] No rows were updated. This might be a permissions issue.');
      return { success: false, error: 'No rows were updated. Check RLS policies.' };
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
