import { supabase } from '../lib/supabase';
import type { TaskTemplate, TaskInstance } from '../types';

/**
 * Supabase Database Service
 * Handles all database operations for tasks, templates, and instances
 */
export const supabaseDatabaseService = {
  // ============================================
  // TASK TEMPLATES
  // ============================================

  /**
   * Get all task templates
   */
  async getTaskTemplates(): Promise<TaskTemplate[]> {
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching task templates:', error);
      return [];
    }

    return data.map((template: any) => ({
      id: template.id,
      title: template.title,
      description: template.description,
      category: template.category,
      priority: template.priority,
      recurrence: template.recurrence,
      dueDay: template.due_day,
      createdBy: template.created_by,
      createdAt: template.created_at,
    }));
  },

  /**
   * Create a new task template
   */
  async createTaskTemplate(template: Omit<TaskTemplate, 'id' | 'createdAt'>): Promise<TaskTemplate | null> {
    const { data, error } = await supabase
      .from('task_templates')
      .insert({
        title: template.title,
        description: template.description,
        category: template.category,
        priority: template.priority,
        recurrence: template.recurrence,
        due_day: template.dueDay,
        created_by: template.createdBy,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating task template:', error);
      return null;
    }

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      recurrence: data.recurrence,
      dueDay: data.due_day,
      createdBy: data.created_by,
      createdAt: data.created_at,
    };
  },

  /**
   * Update a task template
   */
  async updateTaskTemplate(id: string, updates: Partial<TaskTemplate>): Promise<boolean> {
    const { error } = await supabase
      .from('task_templates')
      .update({
        title: updates.title,
        description: updates.description,
        category: updates.category,
        priority: updates.priority,
        recurrence: updates.recurrence,
        due_day: updates.dueDay,
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating task template:', error);
      return false;
    }

    return true;
  },

  /**
   * Delete a task template
   */
  async deleteTaskTemplate(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('task_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting task template:', error);
      return false;
    }

    return true;
  },

  // ============================================
  // TASK INSTANCES
  // ============================================

  /**
   * Get all task instances
   */
  async getTaskInstances(): Promise<TaskInstance[]> {
    const { data, error } = await supabase
      .from('task_instances')
      .select(`
        *,
        task_templates!inner(
          id,
          title,
          description,
          category,
          priority,
          recurrence,
          due_day,
          created_by
        ),
        users!inner(
          id,
          name,
          email,
          department,
          role
        )
      `)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error fetching task instances:', error);
      return [];
    }

    return data.map((instance: any) => ({
      id: instance.id,
      templateId: instance.template_id,
      assignedTo: instance.assigned_to,
      dueDate: instance.due_date,
      status: instance.status,
      output: instance.output,
      completedAt: instance.completed_at,
      createdAt: instance.created_at,
      template: {
        id: instance.task_templates.id,
        title: instance.task_templates.title,
        description: instance.task_templates.description,
        category: instance.task_templates.category,
        priority: instance.task_templates.priority,
        recurrence: instance.task_templates.recurrence,
        dueDay: instance.task_templates.due_day,
        createdBy: instance.task_templates.created_by,
        createdAt: instance.task_templates.created_at,
      },
      assignee: {
        id: instance.users.id,
        name: instance.users.name,
        email: instance.users.email,
        department: instance.users.department,
        role: instance.users.role,
        createdAt: instance.users.created_at,
      },
    }));
  },

  /**
   * Get task instances for a specific user
   */
  async getTaskInstancesByUser(userId: string): Promise<TaskInstance[]> {
    const { data, error } = await supabase
      .from('task_instances')
      .select(`
        *,
        task_templates!inner(
          id,
          title,
          description,
          category,
          priority,
          recurrence,
          due_day,
          created_by
        ),
        users!inner(
          id,
          name,
          email,
          department,
          role
        )
      `)
      .eq('assigned_to', userId)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error fetching user task instances:', error);
      return [];
    }

    return data.map((instance: any) => ({
      id: instance.id,
      templateId: instance.template_id,
      assignedTo: instance.assigned_to,
      dueDate: instance.due_date,
      status: instance.status,
      output: instance.output,
      completedAt: instance.completed_at,
      createdAt: instance.created_at,
      template: {
        id: instance.task_templates.id,
        title: instance.task_templates.title,
        description: instance.task_templates.description,
        category: instance.task_templates.category,
        priority: instance.task_templates.priority,
        recurrence: instance.task_templates.recurrence,
        dueDay: instance.task_templates.due_day,
        createdBy: instance.task_templates.created_by,
        createdAt: instance.task_templates.created_at,
      },
      assignee: {
        id: instance.users.id,
        name: instance.users.name,
        email: instance.users.email,
        department: instance.users.department,
        role: instance.users.role,
        createdAt: instance.users.created_at,
      },
    }));
  },

  /**
   * Create a new task instance
   */
  async createTaskInstance(instance: Omit<TaskInstance, 'id' | 'createdAt'>): Promise<TaskInstance | null> {
    const { data, error } = await supabase
      .from('task_instances')
      .insert({
        template_id: instance.templateId,
        assigned_to: instance.assignedTo,
        due_date: instance.dueDate,
        status: instance.status,
        output: instance.output,
        completed_at: instance.completedAt,
      })
      .select(`
        *,
        task_templates!inner(
          id,
          title,
          description,
          category,
          priority,
          recurrence,
          due_day,
          created_by
        ),
        users!inner(
          id,
          name,
          email,
          department,
          role
        )
      `)
      .single();

    if (error) {
      console.error('Error creating task instance:', error);
      return null;
    }

    return {
      id: data.id,
      templateId: data.template_id,
      assignedTo: data.assigned_to,
      dueDate: data.due_date,
      status: data.status,
      output: data.output,
      completedAt: data.completed_at,
      createdAt: data.created_at,
      template: {
        id: data.task_templates.id,
        title: data.task_templates.title,
        description: data.task_templates.description,
        category: data.task_templates.category,
        priority: data.task_templates.priority,
        recurrence: data.task_templates.recurrence,
        dueDay: data.task_templates.due_day,
        createdBy: data.task_templates.created_by,
        createdAt: data.task_templates.created_at,
      },
      assignee: {
        id: data.users.id,
        name: data.users.name,
        email: data.users.email,
        department: data.users.department,
        role: data.users.role,
        createdAt: data.users.created_at,
      },
    };
  },

  /**
   * Update a task instance
   */
  async updateTaskInstance(id: string, updates: Partial<TaskInstance>): Promise<boolean> {
    const { error } = await supabase
      .from('task_instances')
      .update({
        status: updates.status,
        output: updates.output,
        completed_at: updates.completedAt,
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating task instance:', error);
      return false;
    }

    return true;
  },

  /**
   * Delete a task instance
   */
  async deleteTaskInstance(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('task_instances')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting task instance:', error);
      return false;
    }

    return true;
  },

  // ============================================
  // USERS
  // ============================================

  /**
   * Get all users
   */
  async getUsers(): Promise<any[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }

    return data;
  },

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }

    return data;
  },

  /**
   * Update user
   */
  async updateUser(userId: string, updates: Partial<any>): Promise<boolean> {
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error('Error updating user:', error);
      return false;
    }

    return true;
  },

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      console.error('Error deleting user:', error);
      return false;
    }

    return true;
  },

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<any> {
    const { data: instances, error } = await supabase
      .from('task_instances')
      .select('status, due_date, assigned_to, users!inner(department)');

    if (error) {
      console.error('Error fetching stats:', error);
      return null;
    }

    const total = instances.length;
    const completed = instances.filter((i: any) => i.status === 'COMPLETED').length;
    const inProgress = instances.filter((i: any) => i.status === 'IN_PROGRESS').length;
    const pending = instances.filter((i: any) => i.status === 'PENDING').length;
    const overdue = instances.filter((i: any) => {
      const today = new Date().toISOString().split('T')[0];
      return i.due_date < today && i.status !== 'COMPLETED';
    }).length;

    // Calculate department stats
    const departmentMap: Record<string, { total: number; completed: number }> = {};
    instances.forEach((instance: any) => {
      const dept = instance.users.department;
      if (!departmentMap[dept]) {
        departmentMap[dept] = { total: 0, completed: 0 };
      }
      departmentMap[dept].total++;
      if (instance.status === 'COMPLETED') {
        departmentMap[dept].completed++;
      }
    });

    const departments = Object.entries(departmentMap).map(([name, stats]) => ({
      name,
      total: stats.total,
      completed: stats.completed,
      completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
    }));

    return {
      total,
      completed,
      inProgress,
      pending,
      overdue,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      departments,
    };
  },
};
