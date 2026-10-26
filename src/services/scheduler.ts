import { supabase } from '../lib/supabase';
import type { TaskTemplate, DayOfWeek } from '../types';

/**
 * Scheduler Service - Handles automatic task instance generation
 */
export const SchedulerService = {
  /**
   * Generate task instances for the next 30 days based on recurrence rules
   */
  async generateInstances(): Promise<{ generated: number; errors: string[] }> {
    const errors: string[] = [];
    let generated = 0;

    try {
      // Get all active templates with recurrence
      const { data: templates, error: templatesError } = await supabase
        .from('task_templates')
        .select('*')
        .neq('recurrence', 'ONCE');

      if (templatesError) {
        errors.push(`Failed to fetch templates: ${templatesError.message}`);
        return { generated, errors };
      }

      if (!templates || templates.length === 0) {
        return { generated, errors };
      }

      // Get all existing instances to avoid duplicates
      const { data: existingInstances, error: instancesError } = await supabase
        .from('task_instances')
        .select('template_id, due_date, assigned_to');

      if (instancesError) {
        errors.push(`Failed to fetch instances: ${instancesError.message}`);
        return { generated, errors };
      }

      const existingSet = new Set(
        (existingInstances || []).map(i => `${i.template_id}-${i.due_date}-${i.assigned_to}`)
      );

      // Generate instances for each template
      for (const template of templates) {
        try {
          const instances = await this.generateInstancesForTemplate(template, existingSet);
          
          if (instances.length > 0) {
            const { error: insertError } = await supabase
              .from('task_instances')
              .insert(instances);

            if (insertError) {
              errors.push(`Failed to insert instances for template ${template.id}: ${insertError.message}`);
            } else {
              generated += instances.length;
            }
          }
        } catch (err) {
          errors.push(`Error generating instances for template ${template.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Mark overdue tasks
      await this.markOverdueTasks();

    } catch (err) {
      errors.push(`Scheduler error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return { generated, errors };
  },

  /**
   * Generate instances for a specific template
   */
  async generateInstancesForTemplate(
    template: TaskTemplate,
    existingSet: Set<string>
  ): Promise<any[]> {
    const instances: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all users assigned to this template from task_assignments table
    const { data: assignments, error: assignmentsError } = await supabase
      .from('task_assignments')
      .select('user_id')
      .eq('template_id', template.id);

    if (assignmentsError) {
      console.error('[Scheduler] Error fetching assignments:', assignmentsError);
      return instances;
    }

    // If no assignments table or no assignments, fall back to getting users from existing instances
    let userIds: string[] = [];
    if (assignments && assignments.length > 0) {
      userIds = assignments.map(a => a.user_id);
    } else {
      // Fallback: get unique users from existing instances
      const { data: existingInstances } = await supabase
        .from('task_instances')
        .select('assigned_to')
        .eq('template_id', template.id);
      
      if (existingInstances) {
        userIds = [...new Set(existingInstances.map(i => i.assigned_to))];
      }
    }

    if (userIds.length === 0) {
      return instances;
    }

    // Generate for next 30 days
    for (let i = 0; i < 30; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() + i);

      let shouldCreate = false;
      let dueDate = currentDate.toISOString().split('T')[0];

      switch (template.recurrence) {
        case 'DAILY':
          // Check if this day of week is selected
          if (template.dueDaysOfWeek && template.dueDaysOfWeek.length > 0) {
            const dayOfWeek = this.getDayOfWeek(currentDate);
            shouldCreate = template.dueDaysOfWeek.includes(dayOfWeek);
          } else {
            // If no days specified, create for all days
            shouldCreate = true;
          }
          break;

        case 'WEEKLY':
          // Create once per week (every 7 days from start)
          shouldCreate = i % 7 === 0;
          break;

        case 'MONTHLY':
          // Create on specific day of month
          if (template.dueDay) {
            const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            const targetDay = Math.min(template.dueDay, lastDayOfMonth);
            if (currentDate.getDate() === targetDay) {
              shouldCreate = true;
            }
          }
          break;

        case 'QUARTERLY':
          // Create every 3 months on specific day
          if (template.dueDay && currentDate.getMonth() % 3 === 0) {
            const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            const targetDay = Math.min(template.dueDay, lastDayOfMonth);
            if (currentDate.getDate() === targetDay) {
              shouldCreate = true;
            }
          }
          break;

        case 'YEARLY':
          // Create once per year on specific day
          if (template.dueDay && currentDate.getMonth() === 0 && currentDate.getDate() === template.dueDay) {
            shouldCreate = true;
          }
          break;
      }

      if (shouldCreate) {
        // Create instance for each assigned user
        for (const userId of userIds) {
          const instanceKey = `${template.id}-${dueDate}-${userId}`;
          
          // Skip if already exists
          if (existingSet.has(instanceKey)) {
            continue;
          }

          instances.push({
            template_id: template.id,
            assigned_to: userId,
            due_date: dueDate,
            due_time: template.dueTime || null,
            status: 'PENDING',
          });

          // Add to existing set to avoid duplicates in this batch
          existingSet.add(instanceKey);
        }
      }
    }

    return instances;
  },

  /**
   * Get day of week as DayOfWeek enum
   */
  getDayOfWeek(date: Date): DayOfWeek {
    const days: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return days[date.getDay()];
  },

  /**
   * Mark tasks as OVERDUE if past due date
   */
  async markOverdueTasks(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase
      .from('task_instances')
      .update({ status: 'OVERDUE' })
      .lt('due_date', today)
      .in('status', ['PENDING', 'IN_PROGRESS']);

    if (error) {
      console.error('[Scheduler] Error marking overdue tasks:', error);
    }
  },

  /**
   * Get scheduler statistics
   */
  async getStats(): Promise<{
    totalTemplates: number;
    recurringTemplates: number;
    totalInstances: number;
    pendingInstances: number;
    overdueInstances: number;
  }> {
    const { data: templates } = await supabase
      .from('task_templates')
      .select('id, recurrence');

    const { data: instances } = await supabase
      .from('task_instances')
      .select('status');

    const totalTemplates = templates?.length || 0;
    const recurringTemplates = templates?.filter(t => t.recurrence !== 'ONCE').length || 0;
    const totalInstances = instances?.length || 0;
    const pendingInstances = instances?.filter(i => i.status === 'PENDING').length || 0;
    const overdueInstances = instances?.filter(i => i.status === 'OVERDUE').length || 0;

    return {
      totalTemplates,
      recurringTemplates,
      totalInstances,
      pendingInstances,
      overdueInstances,
    };
  },
};
