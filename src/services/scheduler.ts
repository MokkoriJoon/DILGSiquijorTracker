/**
 * Recurring Task Scheduler Service
 * 
 * Generates TaskInstance records from TaskTemplate definitions based on
 * their recurrence rules. This simulates what a cron job would do in production.
 * 
 * In production (Next.js + Supabase):
 * - Use Vercel Cron Jobs or node-cron
 * - Run daily at midnight to check which templates need new instances
 * - Create TaskInstance records for the upcoming period
 */

import { addDays, addWeeks, addMonths, addYears, addQuarters, 
         format, isAfter, isBefore, startOfDay, subDays } from 'date-fns';
import { TaskTemplate, TaskInstance, RecurrenceType } from '../types';
import { TemplateService, InstanceService, UserService } from './database';

interface SchedulerResult {
  generated: number;
  skipped: number;
  errors: string[];
  details: Array<{
    templateId: string;
    templateTitle: string;
    instanceId?: string;
    dueDate: string;
    action: 'created' | 'skipped' | 'error';
    reason?: string;
  }>;
}

/**
 * Calculate the next due date based on recurrence type and the last instance date
 */
export function calculateNextDueDate(
  recurrence: RecurrenceType,
  lastDate: string,
  dueDay?: number
): string {
  const last = new Date(lastDate);
  let nextDate: Date;

  switch (recurrence) {
    case 'DAILY':
      nextDate = addDays(last, 1);
      break;
    case 'WEEKLY':
      nextDate = addWeeks(last, 1);
      break;
    case 'MONTHLY':
      if (dueDay) {
        // Set to the specific day of the next month
        nextDate = addMonths(last, 1);
        nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth(), dueDay);
      } else {
        nextDate = addMonths(last, 1);
      }
      break;
    case 'QUARTERLY':
      if (dueDay) {
        nextDate = addQuarters(last, 1);
        nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth(), dueDay);
      } else {
        nextDate = addQuarters(last, 1);
      }
      break;
    case 'YEARLY':
      if (dueDay) {
        nextDate = addYears(last, 1);
        nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth(), dueDay);
      } else {
        nextDate = addYears(last, 1);
      }
      break;
    case 'ONCE':
    default:
      return ''; // No next date for one-time tasks
  }

  return format(nextDate, 'yyyy-MM-dd');
}

/**
 * Get all assignees for a template (based on existing instances)
 */
function getTemplateAssignees(templateId: string): string[] {
  const instances = InstanceService.getByTemplate(templateId);
  const assignees = [...new Set(instances.map(i => i.assignedTo))];
  return assignees;
}

/**
 * Check if an instance already exists for a given template + assignee + due date
 */
function instanceExists(templateId: string, assignedTo: string, dueDate: string): boolean {
  const instances = InstanceService.getAll();
  return instances.some(
    i => i.templateId === templateId && i.assignedTo === assignedTo && i.dueDate === dueDate
  );
}

/**
 * Run the scheduler - generates new task instances for recurring templates
 */
export function runScheduler(): SchedulerResult {
  const result: SchedulerResult = {
    generated: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  const templates = TemplateService.getAll().filter(t => t.recurrence !== 'ONCE');
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const lookahead = format(addDays(new Date(), 30), 'yyyy-MM-dd'); // Generate 30 days ahead

  for (const template of templates) {
    try {
      const existingInstances = InstanceService.getByTemplate(template.id);
      
      if (existingInstances.length === 0) {
        // No instances yet - create the first one
        const assignees = getStandardUsers();
        if (assignees.length === 0) {
          result.errors.push(`No standard users available for template: ${template.title}`);
          continue;
        }

        // Create first instance for the first assignee
        const firstDueDate = calculateFirstDueDate(template);
        const assignee = assignees[0];
        
        if (!instanceExists(template.id, assignee.id, firstDueDate)) {
          const user = UserService.getById(assignee.id);
          if (user) {
            InstanceService.create({
              templateId: template.id,
              template: template,
              assignedTo: assignee.id,
              assignee: user,
              dueDate: firstDueDate,
              status: 'PENDING',
            });
            result.generated++;
            result.details.push({
              templateId: template.id,
              templateTitle: template.title,
              dueDate: firstDueDate,
              action: 'created',
            });
          }
        }
      } else {
        // Find the latest instance date for this template
        const latestInstance = existingInstances
          .sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];

        if (!latestInstance) continue;

        const nextDueDate = calculateNextDueDate(
          template.recurrence,
          latestInstance.dueDate,
          template.dueDay
        );

        if (!nextDueDate) continue;

        // Only generate if the next due date is within our lookahead window
        if (isBefore(new Date(nextDueDate), new Date(lookahead))) {
          const assignees = getTemplateAssignees(template.id);
          
          for (const assigneeId of assignees) {
            if (!instanceExists(template.id, assigneeId, nextDueDate)) {
              const user = UserService.getById(assigneeId);
              if (user) {
                InstanceService.create({
                  templateId: template.id,
                  template: template,
                  assignedTo: assigneeId,
                  assignee: user,
                  dueDate: nextDueDate,
                  status: 'PENDING',
                });
                result.generated++;
                result.details.push({
                  templateId: template.id,
                  templateTitle: template.title,
                  dueDate: nextDueDate,
                  action: 'created',
                });
              }
            } else {
              result.skipped++;
              result.details.push({
                templateId: template.id,
                templateTitle: template.title,
                dueDate: nextDueDate,
                action: 'skipped',
                reason: 'Instance already exists',
              });
            }
          }
        } else {
          result.skipped++;
          result.details.push({
            templateId: template.id,
            templateTitle: template.title,
            dueDate: nextDueDate,
            action: 'skipped',
            reason: 'Next date beyond lookahead window',
          });
        }
      }
    } catch (error) {
      const errorMsg = `Error processing template ${template.title}: ${error}`;
      result.errors.push(errorMsg);
      result.details.push({
        templateId: template.id,
        templateTitle: template.title,
        dueDate: '',
        action: 'error',
        reason: errorMsg,
      });
    }
  }

  // Also mark overdue tasks
  markOverdueTasks(result);

  return result;
}

/**
 * Mark tasks that are past their due date as OVERDUE
 */
function markOverdueTasks(result: SchedulerResult): void {
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const instances = InstanceService.getAll();

  for (const instance of instances) {
    if (
      instance.dueDate < today &&
      instance.status === 'PENDING'
    ) {
      InstanceService.updateStatus(instance.id, 'OVERDUE');
      result.details.push({
        templateId: instance.templateId,
        templateTitle: instance.template.title,
        dueDate: instance.dueDate,
        action: 'created',
        reason: 'Marked as overdue',
      });
    }
  }
}

/**
 * Calculate the first due date for a new template
 */
function calculateFirstDueDate(template: TaskTemplate): string {
  const now = new Date();
  
  switch (template.recurrence) {
    case 'DAILY':
      return format(now, 'yyyy-MM-dd');
    case 'WEEKLY':
      return format(addDays(now, 7), 'yyyy-MM-dd');
    case 'MONTHLY':
      if (template.dueDay) {
        let target = new Date(now.getFullYear(), now.getMonth(), template.dueDay);
        if (isBefore(target, now)) {
          target = addMonths(target, 1);
        }
        return format(target, 'yyyy-MM-dd');
      }
      return format(addMonths(now, 1), 'yyyy-MM-dd');
    case 'QUARTERLY':
      if (template.dueDay) {
        let target = new Date(now.getFullYear(), now.getMonth(), template.dueDay);
        if (isBefore(target, now)) {
          target = addQuarters(target, 1);
        }
        return format(target, 'yyyy-MM-dd');
      }
      return format(addQuarters(now, 1), 'yyyy-MM-dd');
    case 'YEARLY':
      if (template.dueDay) {
        let target = new Date(now.getFullYear(), now.getMonth(), template.dueDay);
        if (isBefore(target, now)) {
          target = addYears(target, 1);
        }
        return format(target, 'yyyy-MM-dd');
      }
      return format(addYears(now, 1), 'yyyy-MM-dd');
    default:
      return format(addDays(now, 7), 'yyyy-MM-dd');
  }
}

/**
 * Get all standard (non-admin) users
 */
function getStandardUsers(): Array<{ id: string; name: string }> {
  const users = UserService.getAll();
  return users.filter(u => u.role === 'STANDARD').map(u => ({ id: u.id, name: u.name }));
}

/**
 * Preview what the scheduler would generate without actually creating instances
 */
export function previewScheduler(): Array<{
  templateTitle: string;
  recurrence: RecurrenceType;
  nextDueDate: string;
  assignees: string[];
}> {
  const templates = TemplateService.getAll().filter(t => t.recurrence !== 'ONCE');
  const preview: Array<{
    templateTitle: string;
    recurrence: RecurrenceType;
    nextDueDate: string;
    assignees: string[];
  }> = [];

  for (const template of templates) {
    const existingInstances = InstanceService.getByTemplate(template.id);
    let nextDueDate: string;

    if (existingInstances.length === 0) {
      nextDueDate = calculateFirstDueDate(template);
    } else {
      const latest = existingInstances.sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
      nextDueDate = calculateNextDueDate(template.recurrence, latest.dueDate, template.dueDay);
    }

    const assignees = existingInstances.length > 0
      ? getTemplateAssignees(template.id).map(id => UserService.getById(id)?.name || 'Unknown')
      : getStandardUsers().map(u => u.name);

    preview.push({
      templateTitle: template.title,
      recurrence: template.recurrence,
      nextDueDate,
      assignees,
    });
  }

  return preview;
}
