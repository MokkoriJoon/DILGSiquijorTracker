/**
 * Notification Service
 * 
 * Manages in-app notifications. In production, this would also trigger
 * email notifications via Supabase Edge Functions or a service like SendGrid.
 */

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'task' | 'deadline';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
  userId?: string; // If null, it's a global notification
}

const NOTIFICATION_KEY = 'dilg_notifications';
const EMAIL_CONFIG_KEY = 'dilg_email_config';

export interface EmailConfig {
  enabled: boolean;
  reminderDays: number; // Days before deadline to send reminder
  overdueAlert: boolean;
  completionAlert: boolean;
  dailyDigest: boolean;
}

export const NotificationService = {
  getAll(userId?: string): Notification[] {
    const data = localStorage.getItem(NOTIFICATION_KEY);
    const all: Notification[] = data ? JSON.parse(data) : [];
    if (userId) {
      return all.filter(n => !n.userId || n.userId === userId);
    }
    return all;
  },

  getUnread(userId?: string): Notification[] {
    return this.getAll(userId).filter(n => !n.read);
  },

  getUnreadCount(userId?: string): number {
    return this.getUnread(userId).length;
  },

  create(notification: Omit<Notification, 'id' | 'read' | 'createdAt'>): Notification {
    const notifications = this.getAll();
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      read: false,
      createdAt: new Date().toISOString(),
    };
    notifications.unshift(newNotification);
    // Keep only last 100 notifications
    const trimmed = notifications.slice(0, 100);
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(trimmed));
    return newNotification;
  },

  markAsRead(id: string): void {
    const notifications = this.getAll();
    const index = notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      notifications[index].read = true;
      localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
    }
  },

  markAllAsRead(userId?: string): void {
    const notifications = this.getAll();
    notifications.forEach(n => {
      if (!userId || !n.userId || n.userId === userId) {
        n.read = true;
      }
    });
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
  },

  delete(id: string): void {
    const notifications = this.getAll();
    const filtered = notifications.filter(n => n.id !== id);
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(filtered));
  },

  clearAll(userId?: string): void {
    if (userId) {
      const notifications = this.getAll().filter(n => n.userId && n.userId !== userId);
      localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
    } else {
      localStorage.setItem(NOTIFICATION_KEY, JSON.stringify([]));
    }
  },

  // Generate notifications based on task events
  notifyTaskAssigned(taskTitle: string, assigneeName: string, dueDate: string): Notification {
    return this.create({
      type: 'task',
      title: 'New Task Assigned',
      message: `"${taskTitle}" has been assigned. Due: ${dueDate}`,
    });
  },

  notifyTaskCompleted(taskTitle: string, userName: string): Notification {
    return this.create({
      type: 'success',
      title: 'Task Completed',
      message: `${userName} completed "${taskTitle}"`,
    });
  },

  notifyTaskOverdue(taskTitle: string, assigneeName: string, dueDate: string): Notification {
    return this.create({
      type: 'warning',
      title: 'Task Overdue',
      message: `"${taskTitle}" assigned to ${assigneeName} is overdue (was due: ${dueDate})`,
    });
  },

  notifySchedulerRun(generated: number, errors: number): Notification {
    return this.create({
      type: generated > 0 ? 'info' : 'success',
      title: 'Scheduler Run Complete',
      message: `Generated ${generated} new task instances. ${errors > 0 ? `${errors} errors.` : 'No errors.'}`,
    });
  },

  notifyDeadlineReminder(taskTitle: string, daysLeft: number): Notification {
    return this.create({
      type: 'deadline',
      title: 'Deadline Approaching',
      message: `"${taskTitle}" is due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    });
  },
};

// ============ EMAIL CONFIGURATION ============

export const EmailConfigService = {
  get(): EmailConfig {
    const data = localStorage.getItem(EMAIL_CONFIG_KEY);
    return data ? JSON.parse(data) : {
      enabled: false,
      reminderDays: 3,
      overdueAlert: true,
      completionAlert: true,
      dailyDigest: false,
    };
  },

  update(config: Partial<EmailConfig>): EmailConfig {
    const current = this.get();
    const updated = { ...current, ...config };
    localStorage.setItem(EMAIL_CONFIG_KEY, JSON.stringify(updated));
    return updated;
  },
};
