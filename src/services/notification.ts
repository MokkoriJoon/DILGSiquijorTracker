import { supabase } from '../lib/supabase';

export type NotificationType = 
  | 'reminder_3days'
  | 'reminder_1day'
  | 'overdue'
  | 'recurrence_generated'
  | 'task_assigned'
  | 'task_completed';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  taskId?: string;
  taskTitle?: string;
  dueDate?: string;
  read: boolean;
  createdAt: string;
}

export const NotificationService = {
  // Get all notifications for a user
  async getUserNotifications(userId: string): Promise<Notification[]> {
    console.log('[Notification] Fetching notifications for user:', userId);
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Notification] Error fetching notifications:', {
        error,
        userId,
        message: 'Check if notifications table exists and RLS policies allow SELECT',
      });
      return [];
    }

    console.log('[Notification] Found', data?.length || 0, 'notifications for user', userId);
    return data || [];
  },

  // Get unread notification count
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('[Notification] Error counting notifications:', {
        error,
        userId,
        message: 'Check if notifications table exists and RLS policies allow SELECT',
      });
      return 0;
    }

    console.log('[Notification] Unread count for user', userId, ':', count || 0);
    return count || 0;
  },

  // Diagnostic function to test notification system
  async testNotificationSystem(userId: string): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    console.log('[Notification] Testing notification system for user:', userId);

    try {
      // Test 1: Check if table exists
      const { error: tableError } = await supabase
        .from('notifications')
        .select('id')
        .limit(1);

      if (tableError) {
        return {
          success: false,
          message: 'Notifications table does not exist or is not accessible',
          details: tableError,
        };
      }

      // Test 2: Try to create a test notification
      const testNotification = await this.createNotification({
        userId,
        type: 'task_assigned',
        title: 'Test Notification',
        message: 'This is a test notification to verify the system is working',
      });

      if (!testNotification) {
        return {
          success: false,
          message: 'Failed to create test notification. Check RLS policies.',
        };
      }

      // Test 3: Try to fetch the notification
      const notifications = await this.getUserNotifications(userId);
      const found = notifications.some(n => n.id === testNotification.id);

      if (!found) {
        return {
          success: false,
          message: 'Test notification was created but cannot be fetched. Check RLS SELECT policy.',
        };
      }

      // Test 4: Clean up test notification
      await this.deleteNotification(testNotification.id);

      return {
        success: true,
        message: 'Notification system is working correctly!',
        details: {
          tableExists: true,
          canCreate: true,
          canRead: true,
          canDelete: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Unexpected error during notification system test',
        details: error,
      };
    }
  },

  // Create a new notification
  async createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<Notification | null> {
    console.log('[Notification] Creating notification:', {
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
    });

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        task_id: notification.taskId,
        task_title: notification.taskTitle,
        due_date: notification.dueDate,
        read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[Notification] Error creating notification:', {
        error,
        notification,
        message: 'Check if notifications table exists and RLS policies are set up correctly',
      });
      return null;
    }

    console.log('[Notification] Notification created successfully:', data.id);

    return {
      id: data.id,
      userId: data.user_id,
      type: data.type,
      title: data.title,
      message: data.message,
      taskId: data.task_id,
      taskTitle: data.task_title,
      dueDate: data.due_date,
      read: data.read,
      createdAt: data.created_at,
    };
  },

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('[Notification] Error marking as read:', error);
      return false;
    }

    return true;
  },

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('[Notification] Error marking all as read:', error);
      return false;
    }

    return true;
  },

  // Delete a notification
  async deleteNotification(notificationId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('[Notification] Error deleting notification:', error);
      return false;
    }

    return true;
  },

  // Generate reminder notifications
  async generateReminders(): Promise<{ created: number; errors: string[] }> {
    const errors: string[] = [];
    let created = 0;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const in3Days = new Date(today);
      in3Days.setDate(today.getDate() + 3);

      const in1Day = new Date(today);
      in1Day.setDate(today.getDate() + 1);

      // Get all pending tasks
      const { data: pendingTasks, error: pendingError } = await supabase
        .from('task_instances')
        .select(`
          *,
          template:task_templates(*),
          assignee:users!task_instances_assigned_to_fkey(*)
        `)
        .eq('status', 'PENDING');

      if (pendingError) {
        errors.push(`Failed to fetch pending tasks: ${pendingError.message}`);
        return { created, errors };
      }

      if (!pendingTasks || pendingTasks.length === 0) {
        return { created, errors };
      }

      // Check each task for reminders
      for (const task of pendingTasks) {
        const dueDate = new Date(task.due_date);
        dueDate.setHours(0, 0, 0, 0);

        const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // 3-day reminder
        if (daysUntilDue === 3) {
          const existingReminder = await this.checkExistingNotification(
            task.assigned_to,
            'reminder_3days',
            task.id
          );

          if (!existingReminder) {
            const notification = await this.createNotification({
              userId: task.assigned_to,
              type: 'reminder_3days',
              title: 'Task Due in 3 Days',
              message: `"${task.template?.title}" is due on ${task.due_date}${task.template?.dueTime ? ` at ${task.template.dueTime}` : ''}`,
              taskId: task.id,
              taskTitle: task.template?.title,
              dueDate: task.due_date,
            });

            if (notification) created++;
          }
        }

        // 1-day reminder
        if (daysUntilDue === 1) {
          const existingReminder = await this.checkExistingNotification(
            task.assigned_to,
            'reminder_1day',
            task.id
          );

          if (!existingReminder) {
            const notification = await this.createNotification({
              userId: task.assigned_to,
              type: 'reminder_1day',
              title: 'Task Due Tomorrow',
              message: `"${task.template?.title}" is due tomorrow (${task.due_date})${task.template?.dueTime ? ` at ${task.template.dueTime}` : ''}`,
              taskId: task.id,
              taskTitle: task.template?.title,
              dueDate: task.due_date,
            });

            if (notification) created++;
          }
        }
      }

      // Check for overdue tasks
      const { data: overdueTasks, error: overdueError } = await supabase
        .from('task_instances')
        .select(`
          *,
          template:task_templates(*),
          assignee:users!task_instances_assigned_to_fkey(*)
        `)
        .in('status', ['PENDING', 'IN_PROGRESS'])
        .lt('due_date', today.toISOString().split('T')[0]);

      if (overdueError) {
        errors.push(`Failed to fetch overdue tasks: ${overdueError.message}`);
      } else if (overdueTasks && overdueTasks.length > 0) {
        for (const task of overdueTasks) {
          const existingOverdue = await this.checkExistingNotification(
            task.assigned_to,
            'overdue',
            task.id
          );

          if (!existingOverdue) {
            const notification = await this.createNotification({
              userId: task.assigned_to,
              type: 'overdue',
              title: 'Task Overdue',
              message: `"${task.template?.title}" was due on ${task.due_date}${task.template?.dueTime ? ` at ${task.template.dueTime}` : ''} and is now overdue`,
              taskId: task.id,
              taskTitle: task.template?.title,
              dueDate: task.due_date,
            });

            if (notification) created++;
          }
        }
      }

    } catch (error) {
      errors.push(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { created, errors };
  },

  // Check if notification already exists
  async checkExistingNotification(userId: string, type: NotificationType, taskId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', type)
      .eq('task_id', taskId)
      .single();

    if (error || !data) {
      return false;
    }

    return true;
  },

  // Generate recurrence success notification
  async notifyRecurrenceGenerated(templateId: string, templateTitle: string, assignedUserIds: string[]): Promise<number> {
    let created = 0;

    for (const userId of assignedUserIds) {
      const notification = await this.createNotification({
        userId,
        type: 'recurrence_generated',
        title: 'New Recurring Task Generated',
        message: `A new instance of "${templateTitle}" has been generated for you`,
        taskId: templateId,
        taskTitle: templateTitle,
      });

      if (notification) created++;
    }

    return created;
  },

  // Notify task assignment
  async notifyTaskAssignment(taskId: string, taskTitle: string, assignedUserId: string, dueDate: string): Promise<boolean> {
    const notification = await this.createNotification({
      userId: assignedUserId,
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: `You have been assigned "${taskTitle}" due on ${dueDate}`,
      taskId,
      taskTitle,
      dueDate,
    });

    return notification !== null;
  },

  // Notify task completion
  async notifyTaskCompletion(taskId: string, taskTitle: string, assigneeId: string, completedById: string, completedByName: string): Promise<boolean> {
    // Notify the assignee
    if (assigneeId !== completedById) {
      const notification = await this.createNotification({
        userId: assigneeId,
        type: 'task_completed',
        title: 'Task Completed',
        message: `"${taskTitle}" has been marked as completed by ${completedByName}`,
        taskId,
        taskTitle,
      });

      return notification !== null;
    }

    return true;
  },
};
