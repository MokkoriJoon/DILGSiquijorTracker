/**
 * Database Service Layer
 * 
 * This service abstracts all database operations. In development/demo mode,
 * it uses localStorage for persistence. In production, swap the implementation
 * to use Supabase client calls.
 * 
 * To switch to Supabase:
 * 1. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 * 2. Replace localStorage calls with supabase.from().select() etc.
 */

import { User, TaskTemplate, TaskInstance, TaskStatus, RecurrenceType } from '../types';
import { mockUsers, mockTaskTemplates, mockTaskInstances } from '../data/mockData';

const DB_KEYS = {
  USERS: 'dilg_users',
  TEMPLATES: 'dilg_templates',
  INSTANCES: 'dilg_instances',
  INITIALIZED: 'dilg_db_initialized',
};

// ============ INITIALIZATION ============

export function initializeDatabase(): void {
  const isInitialized = localStorage.getItem(DB_KEYS.INITIALIZED);
  if (!isInitialized) {
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(mockUsers));
    localStorage.setItem(DB_KEYS.TEMPLATES, JSON.stringify(mockTaskTemplates));
    localStorage.setItem(DB_KEYS.INSTANCES, JSON.stringify(mockTaskInstances));
    localStorage.setItem(DB_KEYS.INITIALIZED, 'true');
  }
}

export function resetDatabase(): void {
  localStorage.removeItem(DB_KEYS.INITIALIZED);
  localStorage.removeItem(DB_KEYS.USERS);
  localStorage.removeItem(DB_KEYS.TEMPLATES);
  localStorage.removeItem(DB_KEYS.INSTANCES);
  initializeDatabase();
}

// ============ USERS ============

export const UserService = {
  getAll(): User[] {
    const data = localStorage.getItem(DB_KEYS.USERS);
    return data ? JSON.parse(data) : [];
  },

  getById(id: string): User | undefined {
    return this.getAll().find(u => u.id === id);
  },

  getByEmail(email: string): User | undefined {
    return this.getAll().find(u => u.email === email);
  },

  create(user: Omit<User, 'id' | 'createdAt'>): User {
    const users = this.getAll();
    const newUser: User = {
      ...user,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    users.push(newUser);
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
    return newUser;
  },

  update(id: string, updates: Partial<User>): User | undefined {
    const users = this.getAll();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return undefined;
    users[index] = { ...users[index], ...updates };
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
    return users[index];
  },

  delete(id: string): boolean {
    const users = this.getAll();
    const filtered = users.filter(u => u.id !== id);
    if (filtered.length === users.length) return false;
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(filtered));
    return true;
  },
};

// ============ TASK TEMPLATES ============

export const TemplateService = {
  getAll(): TaskTemplate[] {
    const data = localStorage.getItem(DB_KEYS.TEMPLATES);
    return data ? JSON.parse(data) : [];
  },

  getById(id: string): TaskTemplate | undefined {
    return this.getAll().find(t => t.id === id);
  },

  create(template: Omit<TaskTemplate, 'id' | 'createdAt'>): TaskTemplate {
    const templates = this.getAll();
    const newTemplate: TaskTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    templates.push(newTemplate);
    localStorage.setItem(DB_KEYS.TEMPLATES, JSON.stringify(templates));
    return newTemplate;
  },

  update(id: string, updates: Partial<TaskTemplate>): TaskTemplate | undefined {
    const templates = this.getAll();
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) return undefined;
    templates[index] = { ...templates[index], ...updates };
    localStorage.setItem(DB_KEYS.TEMPLATES, JSON.stringify(templates));
    return templates[index];
  },

  delete(id: string): boolean {
    const templates = this.getAll();
    const filtered = templates.filter(t => t.id !== id);
    if (filtered.length === templates.length) return false;
    localStorage.setItem(DB_KEYS.TEMPLATES, JSON.stringify(filtered));
    return true;
  },
};

// ============ TASK INSTANCES ============

export const InstanceService = {
  getAll(): TaskInstance[] {
    const data = localStorage.getItem(DB_KEYS.INSTANCES);
    return data ? JSON.parse(data) : [];
  },

  getById(id: string): TaskInstance | undefined {
    return this.getAll().find(i => i.id === id);
  },

  getByUser(userId: string): TaskInstance[] {
    return this.getAll().filter(i => i.assignedTo === userId);
  },

  getByTemplate(templateId: string): TaskInstance[] {
    return this.getAll().filter(i => i.templateId === templateId);
  },

  getByStatus(status: TaskStatus): TaskInstance[] {
    return this.getAll().filter(i => i.status === status);
  },

  getOverdue(): TaskInstance[] {
    const today = new Date().toISOString().split('T')[0];
    return this.getAll().filter(i => 
      i.dueDate < today && i.status !== 'COMPLETED' && i.status !== 'SUBMITTED'
    );
  },

  create(instance: Omit<TaskInstance, 'id' | 'createdAt'>): TaskInstance {
    const instances = this.getAll();
    const newInstance: TaskInstance = {
      ...instance,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    instances.push(newInstance);
    localStorage.setItem(DB_KEYS.INSTANCES, JSON.stringify(instances));
    return newInstance;
  },

  update(id: string, updates: Partial<TaskInstance>): TaskInstance | undefined {
    const instances = this.getAll();
    const index = instances.findIndex(i => i.id === id);
    if (index === -1) return undefined;
    instances[index] = { ...instances[index], ...updates };
    localStorage.setItem(DB_KEYS.INSTANCES, JSON.stringify(instances));
    return instances[index];
  },

  updateStatus(id: string, status: TaskStatus, output?: string): TaskInstance | undefined {
    const updates: Partial<TaskInstance> = { status };
    if (output) updates.output = output;
    if (status === 'COMPLETED') updates.completedAt = new Date().toISOString().split('T')[0];
    return this.update(id, updates);
  },

  delete(id: string): boolean {
    const instances = this.getAll();
    const filtered = instances.filter(i => i.id !== id);
    if (filtered.length === instances.length) return false;
    localStorage.setItem(DB_KEYS.INSTANCES, JSON.stringify(filtered));
    return true;
  },

  getStats() {
    const all = this.getAll();
    return {
      total: all.length,
      completed: all.filter(i => i.status === 'COMPLETED').length,
      pending: all.filter(i => i.status === 'PENDING').length,
      inProgress: all.filter(i => i.status === 'IN_PROGRESS').length,
      submitted: all.filter(i => i.status === 'SUBMITTED').length,
      overdue: all.filter(i => i.status === 'OVERDUE').length,
      completionRate: all.length > 0 
        ? Math.round((all.filter(i => i.status === 'COMPLETED').length / all.length) * 100) 
        : 0,
    };
  },
};
