/**
 * Supabase Database Service (Production)
 * 
 * This file provides the same interface as database.ts but uses Supabase.
 * To switch to production:
 * 1. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 * 2. Import from this file instead of database.ts
 * 3. Or use the isProduction() check in database.ts to auto-switch
 */

import { supabase, isProduction } from './supabaseClient';
import { User, TaskTemplate, TaskInstance, TaskStatus } from '../types';

// ============ USERS ============

export const SupabaseUserService = {
  async getAll(): Promise<User[]> {
    if (!isProduction() || !supabase) return [];
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<User | undefined> {
    if (!isProduction() || !supabase) return undefined;
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return undefined;
    return data;
  },

  async getByEmail(email: string): Promise<User | undefined> {
    if (!isProduction() || !supabase) return undefined;
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error) return undefined;
    return data;
  },

  async create(user: Omit<User, 'id' | 'createdAt'> & { password?: string }): Promise<User> {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: user.email,
        name: user.name,
        password: user.password || 'default', // Will be hashed by Supabase Auth
        role: user.role,
        department: user.department,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async authenticate(email: string, password: string): Promise<User | null> {
    if (!supabase) return null;
    
    // Use Supabase Auth for authentication
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) return null;
    
    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();
    
    return profile;
  },

  async delete(id: string): Promise<boolean> {
    if (!supabase) return false;
    
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    
    return !error;
  },
};

// ============ TASK TEMPLATES ============

export const SupabaseTemplateService = {
  async getAll(): Promise<TaskTemplate[]> {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async create(template: Omit<TaskTemplate, 'id' | 'createdAt'>): Promise<TaskTemplate> {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data, error } = await supabase
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
    
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<boolean> {
    if (!supabase) return false;
    
    const { error } = await supabase
      .from('task_templates')
      .update({ is_active: false })
      .eq('id', id);
    
    return !error;
  },
};

// ============ TASK INSTANCES ============

export const SupabaseInstanceService = {
  async getAll(): Promise<TaskInstance[]> {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('task_instances')
      .select(`
        *,
        template:task_templates(*),
        assignments:task_assignments(
          user:users(*)
        )
      `)
      .order('due_date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  async getByUser(userId: string): Promise<TaskInstance[]> {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('task_instances')
      .select(`
        *,
        template:task_templates(*),
        assignments:task_assignments!inner(
          user:users(*)
        )
      `)
      .eq('task_assignments.user_id', userId)
      .order('due_date', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  async updateStatus(id: string, status: TaskStatus, output?: string): Promise<void> {
    if (!supabase) return;
    
    const updates: any = { status };
    if (output) updates.output = output;
    if (status === 'COMPLETED') updates.completed_at = new Date().toISOString().split('T')[0];
    
    await supabase
      .from('task_instances')
      .update(updates)
      .eq('id', id);
  },

  async getStats() {
    const instances = await this.getAll();
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

// ============ FILE STORAGE ============

export const SupabaseStorageService = {
  async upload(file: File, taskId?: string): Promise<string> {
    if (!supabase) throw new Error('Supabase not configured');
    
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = taskId ? `${taskId}/${fileName}` : fileName;
    
    const { error } = await supabase.storage
      .from('task-outputs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data } = supabase.storage
      .from('task-outputs')
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  },

  async delete(filePath: string): Promise<boolean> {
    if (!supabase) return false;
    
    const { error } = await supabase.storage
      .from('task-outputs')
      .remove([filePath]);
    
    return !error;
  },
};
