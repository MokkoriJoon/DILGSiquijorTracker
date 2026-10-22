import { supabase } from '../lib/supabase';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'task' | 'deadline';
  title: string;
  message: string;
  read: boolean;
  userId?: string;
  link?: string;
  createdAt: string;
}

/**
 * Supabase Notification Service
 * Handles notifications using Supabase database
 */
export const supabaseNotificationService = {
  /**
   * Get all notifications for a user
   */
  async getNotifications(userId?: string): Promise<Notification[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }

    return data.map((notification: any) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      read: notification.read,
      userId: notification.user_id,
      link: notification.link,
      createdAt: notification.created_at,
    }));
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId?: string): Promise<number> {
    let query = supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('read', false);

    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }

    return count || 0;
  },

  /**
   * Create a new notification
   */
  async createNotification(
    type: Notification['type'],
    title: string,
    message: string,
    userId?: string,
    link?: string
  ): Promise<Notification | null> {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        type,
        title,
        message,
        user_id: userId,
        link,
        read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return null;
    }

    return {
      id: data.id,
      type: data.type,
      title: data.title,
      message: data.message,
      read: data.read,
      userId: data.user_id,
      link: data.link,
      createdAt: data.created_at,
    };
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }

    return true;
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId?: string): Promise<boolean> {
    let query = supabase
      .from('notifications')
      .update({ read: true })
      .eq('read', false);

    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { error } = await query;

    if (error) {
      console.error('Error marking all as read:', error);
      return false;
    }

    return true;
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Error deleting notification:', error);
      return false;
    }

    return true;
  },

  /**
   * Clear all notifications for a user
   */
  async clearAll(userId?: string): Promise<boolean> {
    let query = supabase.from('notifications').delete();

    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { error } = await query;

    if (error) {
      console.error('Error clearing notifications:', error);
      return false;
    }

    return true;
  },

  /**
   * Notify task assigned
   */
  async notifyTaskAssigned(
    taskTitle: string,
    assigneeName: string,
    dueDate: string,
    userId?: string
  ): Promise<Notification | null> {
    return this.createNotification(
      'task',
      'New Task Assigned',
      `"${taskTitle}" has been assigned to ${assigneeName}. Due: ${dueDate}`,
      userId
    );
  },

  /**
   * Notify task completed
   */
  async notifyTaskCompleted(
    taskTitle: string,
    userName: string,
    userId?: string
  ): Promise<Notification | null> {
    return this.createNotification(
      'success',
      'Task Completed',
      `${userName} completed "${taskTitle}"`,
      userId
    );
  },

  /**
   * Notify task overdue
   */
  async notifyTaskOverdue(
    taskTitle: string,
    assigneeName: string,
    dueDate: string,
    userId?: string
  ): Promise<Notification | null> {
    return this.createNotification(
      'warning',
      'Task Overdue',
      `"${taskTitle}" assigned to ${assigneeName} is overdue (was due: ${dueDate})`,
      userId
    );
  },

  /**
   * Notify scheduler run
   */
  async notifySchedulerRun(
    generated: number,
    errors: number,
    userId?: string
  ): Promise<Notification | null> {
    return this.createNotification(
      generated > 0 ? 'info' : 'success',
      'Scheduler Run Complete',
      `Generated ${generated} new task instances. ${errors > 0 ? `${errors} errors.` : 'No errors.'}`,
      userId
    );
  },

  /**
   * Notify deadline reminder
   */
  async notifyDeadlineReminder(
    taskTitle: string,
    daysLeft: number,
    userId?: string
  ): Promise<Notification | null> {
    return this.createNotification(
      'deadline',
      'Deadline Approaching',
      `"${taskTitle}" is due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
      userId
    );
  },
};
