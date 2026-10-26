# Notification System Implementation Guide

## Overview

The DILG Siquijor Task Tracker now includes a comprehensive notification system that keeps users informed about their tasks through various alerts and reminders.

## Notification Types

### 1. **Task Assignment Notification**
- **Triggered when:** A new task is assigned to a user
- **Icon:** CheckCircle2 (purple)
- **Color:** Purple theme
- **Message:** "You have been assigned [Task Title] due on [Date]"

### 2. **3-Day Reminder**
- **Triggered when:** A pending task is due in 3 days
- **Icon:** Calendar (blue)
- **Color:** Blue theme
- **Message:** "[Task Title] is due on [Date] at [Time]"
- **Frequency:** Once per task (won't duplicate)

### 3. **1-Day Reminder**
- **Triggered when:** A pending task is due tomorrow
- **Icon:** Clock (orange)
- **Color:** Orange theme
- **Message:** "[Task Title] is due tomorrow ([Date]) at [Time]"
- **Frequency:** Once per task (won't duplicate)

### 4. **Overdue Notification**
- **Triggered when:** A task becomes overdue
- **Icon:** AlertCircle (red)
- **Color:** Red theme
- **Message:** "[Task Title] was due on [Date] at [Time] and is now overdue"
- **Frequency:** Once per task (won't duplicate)

### 5. **Recurrence Generated Notification**
- **Triggered when:** The scheduler generates new instances of a recurring task
- **Icon:** RefreshCw (green)
- **Color:** Green theme
- **Message:** "A new instance of [Task Title] has been generated for you"
- **Frequency:** Each time new instances are generated

### 6. **Task Completion Notification**
- **Triggered when:** A user marks a task as complete
- **Icon:** Check (emerald)
- **Color:** Emerald theme
- **Message:** "[Task Title] has been marked as completed by [User Name]"
- **Note:** Only sent if someone other than the assignee completes the task

## Database Schema

### Notifications Table

```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'reminder_3days',
    'reminder_1day', 
    'overdue',
    'recurrence_generated',
    'task_assigned',
    'task_completed'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  task_id UUID REFERENCES public.task_instances(id) ON DELETE SET NULL,
  task_title TEXT,
  due_date DATE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON public.notifications(type);
```

### Row Level Security (RLS)

```sql
-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can insert notifications (for scheduler)
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (true);
```

## Setup Instructions

### Step 1: Run Database Migration

Execute the SQL migration file in your Supabase SQL Editor:

```bash
# File: CREATE_NOTIFICATIONS_TABLE.sql
```

This will:
- Create the notifications table
- Add necessary indexes
- Enable Row Level Security
- Create security policies

### Step 2: Verify Installation

Run this query to verify the table was created:

```sql
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'notifications';
```

### Step 3: Test Notifications

1. Create a new task and assign it to a user
2. The assigned user should receive a "Task Assigned" notification
3. Create a task due in 3 days
4. Run the scheduler manually or wait for automatic run
5. The user should receive a "3-Day Reminder" notification

## How It Works

### Notification Generation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Scheduler Runs (Daily)                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  1. Generate Task Instances           │
        │     (for recurring tasks)             │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  2. Send Recurrence Notifications     │
        │     (to assigned users)               │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  3. Mark Overdue Tasks                │
        │     (update status to OVERDUE)        │
        └───────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  4. Generate Reminders                │
        │     - 3-day reminders                 │
        │     - 1-day reminders                 │
        │     - Overdue notifications           │
        └───────────────────────────────────────┘
```

### Duplicate Prevention

The system prevents duplicate notifications by checking if a notification already exists before creating a new one:

```typescript
async checkExistingNotification(
  userId: string, 
  type: NotificationType, 
  taskId: string
): Promise<boolean>
```

This ensures:
- Users don't receive the same reminder multiple times
- Overdue notifications are only sent once per task
- Recurrence notifications are only sent when new instances are actually created

## User Interface

### Notification Bell

Located in the top header bar, the notification bell shows:
- Bell icon
- Unread count badge (red circle with number)
- Click to open notification panel

### Notification Panel

When clicked, the panel displays:
- **Header:** "Notifications" with "Mark all as read" button
- **List:** All notifications sorted by date (newest first)
- **Each notification shows:**
  - Icon (color-coded by type)
  - Title
  - Message
  - Timestamp (relative: "5m ago", "2h ago", "3d ago")
  - "Mark as read" button (if unread)
  - Delete button

### Notification Colors

| Type | Icon | Background | Border |
|------|------|------------|--------|
| 3-Day Reminder | Calendar (blue) | blue-50 | blue-200 |
| 1-Day Reminder | Clock (orange) | orange-50 | orange-200 |
| Overdue | AlertCircle (red) | red-50 | red-200 |
| Recurrence | RefreshCw (green) | green-50 | green-200 |
| Task Assigned | CheckCircle2 (purple) | purple-50 | purple-200 |
| Task Completed | Check (emerald) | emerald-50 | emerald-200 |

## API Methods

### NotificationService

#### Get User Notifications
```typescript
async getUserNotifications(userId: string): Promise<Notification[]>
```
Returns all notifications for a user, sorted by creation date (newest first).

#### Get Unread Count
```typescript
async getUnreadCount(userId: string): Promise<number>
```
Returns the count of unread notifications for a user.

#### Create Notification
```typescript
async createNotification(
  notification: Omit<Notification, 'id' | 'createdAt' | 'read'>
): Promise<Notification | null>
```
Creates a new notification. Returns the created notification or null if failed.

#### Mark as Read
```typescript
async markAsRead(notificationId: string): Promise<boolean>
```
Marks a specific notification as read.

#### Mark All as Read
```typescript
async markAllAsRead(userId: string): Promise<boolean>
```
Marks all notifications for a user as read.

#### Delete Notification
```typescript
async deleteNotification(notificationId: string): Promise<boolean>
```
Deletes a specific notification.

#### Generate Reminders
```typescript
async generateReminders(): Promise<{ created: number; errors: string[] }>
```
Generates reminder notifications for:
- Tasks due in 3 days
- Tasks due in 1 day
- Overdue tasks

Returns the number of notifications created and any errors.

#### Notify Recurrence Generated
```typescript
async notifyRecurrenceGenerated(
  templateId: string, 
  templateTitle: string, 
  assignedUserIds: string[]
): Promise<number>
```
Sends notifications to all assigned users when new recurring task instances are generated.

#### Notify Task Assignment
```typescript
async notifyTaskAssignment(
  taskId: string, 
  taskTitle: string, 
  assignedUserId: string, 
  dueDate: string
): Promise<boolean>
```
Sends a notification when a task is assigned to a user.

#### Notify Task Completion
```typescript
async notifyTaskCompletion(
  taskId: string, 
  taskTitle: string, 
  assigneeId: string, 
  completedById: string, 
  completedByName: string
): Promise<boolean>
```
Sends a notification when a task is completed (only if completed by someone other than the assignee).

## Scheduler Integration

The notification system is integrated with the scheduler service:

```typescript
// In scheduler.ts
async generateInstances(): Promise<{ generated: number; errors: string[] }> {
  // ... generate instances ...
  
  // Send recurrence notifications
  await NotificationService.notifyRecurrenceGenerated(
    template.id,
    template.title,
    assignedUserIds
  );
  
  // Mark overdue tasks
  await this.markOverdueTasks();
  
  // Generate reminder notifications
  const reminderResult = await NotificationService.generateReminders();
  
  return { generated, errors };
}
```

## Task Creation Integration

When creating a new task, notifications are sent to all assigned users:

```typescript
// In TaskManagement.tsx
for (const userId of selectedUsers) {
  const instanceResult = await DatabaseService.createInstance({
    templateId: template.id,
    assignedTo: userId,
    dueDate: initialDueDate,
    status: 'PENDING',
  });

  if (instanceResult) {
    // Send notification to assigned user
    await NotificationService.notifyTaskAssignment(
      instanceResult.id,
      template.title,
      userId,
      initialDueDate
    );
  }
}
```

## Task Completion Integration

When a task is marked as complete, a notification is sent:

```typescript
// In MyTasks.tsx
async function confirmCompleteTask() {
  const success = await DatabaseService.updateInstanceStatus(
    taskToComplete.id, 
    'COMPLETED'
  );
  
  if (success) {
    // Send notification about task completion
    await NotificationService.notifyTaskCompletion(
      taskToComplete.id,
      taskToComplete.template?.title || 'Task',
      taskToComplete.assignedTo,
      user.id,
      user.name
    );
    
    await loadTasks();
  }
}
```

## Auto-Refresh

The notification bell component automatically refreshes every 30 seconds:

```typescript
useEffect(() => {
  if (user) {
    loadNotifications();
    // Refresh notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }
}, [user]);
```

## Testing

### Test Task Assignment Notification
1. Login as admin
2. Create a new task
3. Assign it to a user
4. Login as that user
5. Check notification bell - should show "New Task Assigned"

### Test 3-Day Reminder
1. Create a task due in 3 days
2. Run the scheduler manually (or wait for automatic run)
3. Check notification bell - should show "Task Due in 3 Days"

### Test 1-Day Reminder
1. Create a task due tomorrow
2. Run the scheduler manually
3. Check notification bell - should show "Task Due Tomorrow"

### Test Overdue Notification
1. Create a task with a past due date
2. Run the scheduler manually
3. Check notification bell - should show "Task Overdue"

### Test Recurrence Notification
1. Create a daily recurring task
2. Run the scheduler manually
3. Check notification bell - should show "New Recurring Task Generated"

### Test Task Completion Notification
1. Login as admin
2. View a task assigned to another user
3. Mark it as complete
4. Login as the assigned user
5. Check notification bell - should show "Task Completed"

## Troubleshooting

### Notifications Not Appearing

1. **Check database table exists:**
   ```sql
   SELECT * FROM public.notifications LIMIT 5;
   ```

2. **Check RLS policies:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'notifications';
   ```

3. **Check scheduler is running:**
   - Go to Scheduler page
   - Click "Run Scheduler"
   - Check console for errors

4. **Check browser console:**
   - Open DevTools (F12)
   - Look for [Notification] errors

### Duplicate Notifications

The system should prevent duplicates automatically. If you see duplicates:

1. Check the `checkExistingNotification` function is working
2. Verify the database query is correct
3. Check console for errors

### Notifications Not Marking as Read

1. Check RLS policy allows updates
2. Verify the `markAsRead` function is being called
3. Check browser console for errors

## Performance Considerations

### Database Queries

- Notifications are fetched with proper indexes
- Unread count uses `count: 'exact'` for accuracy
- Queries are optimized for the notifications table structure

### Auto-Refresh

- Notifications refresh every 30 seconds
- This is a balance between real-time updates and server load
- Can be adjusted in the `NotificationBell` component

### Duplicate Prevention

- Each notification type checks for existing notifications
- Prevents spam and database bloat
- Uses efficient database queries

## Future Enhancements

Potential improvements for the notification system:

1. **Email Notifications:** Send email alerts for important notifications
2. **Push Notifications:** Browser push notifications for real-time alerts
3. **Notification Preferences:** Allow users to customize which notifications they receive
4. **Notification Categories:** Group notifications by type
5. **Snooze Functionality:** Allow users to snooze notifications
6. **Notification History:** Keep a history of all notifications (including deleted ones)
7. **Batch Notifications:** Combine multiple notifications into a single alert
8. **Priority Levels:** Add priority levels to notifications (low, medium, high, critical)

## Security

### Row Level Security (RLS)

All notification operations are protected by RLS:
- Users can only see their own notifications
- Users can only update their own notifications
- Users can only delete their own notifications
- Only the service role can insert notifications (via scheduler)

### Data Privacy

- Notifications are user-specific
- Task details are included in notifications but only visible to the assigned user
- No sensitive information is exposed through notifications

## Maintenance

### Regular Tasks

1. **Monitor notification volume:** Check if notification count is growing too large
2. **Clean up old notifications:** Consider archiving or deleting old read notifications
3. **Review notification types:** Ensure all notification types are still relevant
4. **Test scheduler integration:** Verify notifications are being generated correctly

### Cleanup Query

To delete old read notifications (older than 30 days):

```sql
DELETE FROM public.notifications
WHERE read = true
  AND created_at < NOW() - INTERVAL '30 days';
```

## Support

For issues or questions about the notification system:

1. Check the browser console for errors
2. Verify the database table and policies exist
3. Test the scheduler manually
4. Review the notification service logs
5. Check RLS policies are correctly configured

---

**Version:** 1.0.0  
**Last Updated:** 2024  
**Status:** Production Ready ✅
