import { supabase } from '../lib/supabase';
import type { TaskTemplate, DayOfWeek } from '../types';
import { NotificationService } from './notification';

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
      // STEP 1: Mark overdue tasks FIRST
      const { marked: overdueTasks, errors: overdueErrors } = await this.markOverdueTasks();
      if (overdueErrors.length > 0) {
        errors.push(...overdueErrors);
      }

      // STEP 2: For each overdue recurring task, create a NEW instance for the next recurrence
      if (overdueTasks.length > 0) {
        const { generated: newGenerated, errors: newErrors } = await this.generateNextInstancesFromOverdue();
        if (newErrors.length > 0) {
          errors.push(...newErrors);
        }
        generated += newGenerated;
      }

      // STEP 3: Get all active templates with recurrence
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

      // STEP 4: Get all existing instances to avoid duplicates
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

      // STEP 5: Generate instances for each template (for future dates)
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
              
              // Generate recurrence notifications for assigned users
              const assignedUserIds = [...new Set(instances.map(i => i.assigned_to))];
              await NotificationService.notifyRecurrenceGenerated(
                template.id,
                template.title,
                assignedUserIds
              );
            }
          }
        } catch (err) {
          errors.push(`Error generating instances for template ${template.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // STEP 6: Generate reminder notifications
      const reminderResult = await NotificationService.generateReminders();
      if (reminderResult.errors.length > 0) {
        errors.push(...reminderResult.errors);
      }
      generated += reminderResult.created;

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
   * Mark tasks as OVERDUE if past due date/time and return the list of overdue tasks
   */
  async markOverdueTasks(): Promise<{ marked: any[]; errors: string[] }> {
    const errors: string[] = [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM format

    console.log('[Scheduler] Marking overdue tasks. Current date:', today, 'Time:', currentTime);

    // First, get ALL tasks that should be checked
    const { data: tasksToCheck, error: fetchError } = await supabase
      .from('task_instances')
      .select(`
        *,
        template:task_templates(*)
      `)
      .in('status', ['PENDING', 'IN_PROGRESS']);

    if (fetchError) {
      console.error('[Scheduler] Error fetching tasks:', fetchError);
      errors.push(`Failed to fetch tasks to mark overdue: ${fetchError.message}`);
      return { marked: [], errors };
    }

    if (!tasksToCheck || tasksToCheck.length === 0) {
      console.log('[Scheduler] No tasks found to check');
      return { marked: [], errors };
    }

    console.log('[Scheduler] Found', tasksToCheck.length, 'tasks to check');

    // Filter tasks that are actually overdue
    const overdueTasks = tasksToCheck.filter(task => {
      console.log('[Scheduler] Checking task:', {
        id: task.id,
        due_date: task.due_date,
        due_time: task.due_time,
        status: task.status,
        today: today,
        currentTime: currentTime,
      });
      
      // If due date is before today, it's overdue
      if (task.due_date < today) {
        console.log('[Scheduler] Task is overdue (past date):', task.id);
        return true;
      }
      
      // If due date is today and there's a due time, check if time has passed
      if (task.due_date === today && task.due_time) {
        const isOverdue = task.due_time < currentTime;
        console.log('[Scheduler] Task due today, time check:', {
          taskId: task.id,
          due_time: task.due_time,
          currentTime: currentTime,
          isOverdue: isOverdue,
        });
        return isOverdue;
      }
      
      // If due date is today but no time specified, don't mark as overdue yet
      console.log('[Scheduler] Task not overdue yet:', task.id);
      return false;
    });

    console.log('[Scheduler] Found', overdueTasks.length, 'overdue tasks');

    if (overdueTasks.length === 0) {
      return { marked: [], errors };
    }

    // Mark them as OVERDUE
    const taskIds = overdueTasks.map(t => t.id);
    const { error: updateError } = await supabase
      .from('task_instances')
      .update({ status: 'OVERDUE' })
      .in('id', taskIds);

    if (updateError) {
      console.error('[Scheduler] Error updating tasks:', updateError);
      errors.push(`Failed to mark tasks as overdue: ${updateError.message}`);
      return { marked: [], errors };
    }

    console.log('[Scheduler] Successfully marked', overdueTasks.length, 'tasks as OVERDUE');

    return { marked: overdueTasks, errors };
  },

  /**
   * Generate new instances for recurring tasks that just became overdue
   * This ensures that when a recurring task is overdue, a new instance is created for the next recurrence
   */
  async generateNextInstancesFromOverdue(): Promise<{ generated: number; errors: string[] }> {
    const errors: string[] = [];
    let generated = 0;

    try {
      // Get all overdue tasks that are part of recurring templates
      const { data: overdueTasks, error: fetchError } = await supabase
        .from('task_instances')
        .select(`
          *,
          template:task_templates(*)
        `)
        .eq('status', 'OVERDUE')
        .neq('template.recurrence', 'ONCE');

      if (fetchError) {
        errors.push(`Failed to fetch overdue tasks: ${fetchError.message}`);
        return { generated, errors };
      }

      if (!overdueTasks || overdueTasks.length === 0) {
        return { generated, errors };
      }

      // Get existing instances to avoid duplicates
      const { data: existingInstances, error: instancesError } = await supabase
        .from('task_instances')
        .select('template_id, due_date, assigned_to');

      if (instancesError) {
        errors.push(`Failed to fetch existing instances: ${instancesError.message}`);
        return { generated, errors };
      }

      const existingSet = new Set(
        (existingInstances || []).map(i => `${i.template_id}-${i.due_date}-${i.assigned_to}`)
      );

      // For each overdue recurring task, create a new instance for the next recurrence
      const newInstances: any[] = [];

      for (const overdueTask of overdueTasks) {
        const template = overdueTask.template;
        
        if (!template) continue;

        // Calculate the next due date based on recurrence
        const nextDueDate = this.calculateNextRecurrenceDate(
          template.recurrence,
          overdueTask.due_date,
          template.dueDay,
          template.dueDaysOfWeek,
          template.startDate
        );

        if (!nextDueDate) continue;

        // Check if instance already exists for this date
        const instanceKey = `${template.id}-${nextDueDate}-${overdueTask.assigned_to}`;
        
        if (existingSet.has(instanceKey)) {
          continue; // Skip if already exists
        }

        newInstances.push({
          template_id: template.id,
          assigned_to: overdueTask.assigned_to,
          due_date: nextDueDate,
          due_time: template.dueTime || null,
          status: 'PENDING',
        });

        existingSet.add(instanceKey);
      }

      // Insert new instances
      if (newInstances.length > 0) {
        const { error: insertError } = await supabase
          .from('task_instances')
          .insert(newInstances);

        if (insertError) {
          errors.push(`Failed to insert new instances from overdue tasks: ${insertError.message}`);
        } else {
          generated = newInstances.length;
          
          // Notify users about new instances
          const assignedUserIds = [...new Set(newInstances.map(i => i.assigned_to))];
          const templateIds = [...new Set(newInstances.map(i => i.template_id))];
          
          for (const templateId of templateIds) {
            const template = overdueTasks.find(t => t.template_id === templateId)?.template;
            if (template) {
              const usersForThisTemplate = assignedUserIds.filter(userId => 
                newInstances.some(i => i.template_id === templateId && i.assigned_to === userId)
              );
              
              await NotificationService.notifyRecurrenceGenerated(
                templateId,
                template.title,
                usersForThisTemplate
              );
            }
          }
        }
      }

    } catch (err) {
      errors.push(`Error generating instances from overdue tasks: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return { generated, errors };
  },

  /**
   * Calculate the next recurrence date based on the recurrence pattern
   */
  calculateNextRecurrenceDate(
    recurrence: string,
    currentDate: string,
    dueDay?: number,
    dueDaysOfWeek?: string[],
    startDate?: string
  ): string | null {
    const current = new Date(currentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let nextDate = new Date(current);

    switch (recurrence) {
      case 'DAILY':
        // For daily tasks, find the next occurrence based on dueDaysOfWeek
        if (dueDaysOfWeek && dueDaysOfWeek.length > 0) {
          // Find the next day that matches the dueDaysOfWeek
          let daysToAdd = 1;
          while (daysToAdd <= 7) {
            const checkDate = new Date(current);
            checkDate.setDate(current.getDate() + daysToAdd);
            const dayOfWeek = this.getDayOfWeek(checkDate);
            
            if (dueDaysOfWeek.includes(dayOfWeek)) {
              nextDate = checkDate;
              break;
            }
            daysToAdd++;
          }
          
          // If no matching day found in next 7 days, just add 1 day
          if (daysToAdd > 7) {
            nextDate.setDate(current.getDate() + 1);
          }
        } else {
          // No specific days, just add 1 day
          nextDate.setDate(current.getDate() + 1);
        }
        break;

      case 'WEEKLY':
        nextDate.setDate(current.getDate() + 7);
        break;

      case 'MONTHLY':
        nextDate.setMonth(current.getMonth() + 1);
        if (dueDay) {
          const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
          nextDate.setDate(Math.min(dueDay, lastDayOfMonth));
        }
        break;

      case 'QUARTERLY':
        nextDate.setMonth(current.getMonth() + 3);
        if (dueDay) {
          const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
          nextDate.setDate(Math.min(dueDay, lastDayOfMonth));
        }
        break;

      case 'YEARLY':
        nextDate.setFullYear(current.getFullYear() + 1);
        if (dueDay) {
          nextDate.setDate(dueDay);
        }
        break;

      default:
        return null;
    }

    // Make sure the next date is in the future
    if (nextDate < today) {
      nextDate = today;
      nextDate.setDate(today.getDate() + 1);
    }

    return nextDate.toISOString().split('T')[0];
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
