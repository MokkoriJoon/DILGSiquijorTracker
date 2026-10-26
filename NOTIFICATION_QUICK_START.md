# Notification System - Quick Setup Guide

## 🚀 Quick Start (5 Minutes)

### Step 1: Run Database Migration

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `CREATE_NOTIFICATIONS_TABLE.sql`
4. Click **Run**

✅ This creates the notifications table with all necessary indexes and security policies.

### Step 2: Test the System

1. **Create a task** and assign it to a user
2. **Login as that user**
3. **Check the notification bell** in the top right corner
4. You should see a "New Task Assigned" notification

### Step 3: Run the Scheduler

1. Go to **Scheduler** page
2. Click **"Run Scheduler"**
3. This will:
   - Generate recurring task instances
   - Send recurrence notifications
   - Mark overdue tasks
   - Generate reminder notifications

---

## 📋 What You Get

### Notification Types

| Type | When | Icon | Color |
|------|------|------|-------|
| **Task Assigned** | When a task is assigned to you | ✓ Check | Purple |
| **3-Day Reminder** | 3 days before due date | 📅 Calendar | Blue |
| **1-Day Reminder** | 1 day before due date | ⏰ Clock | Orange |
| **Overdue** | When task becomes overdue | ⚠️ Alert | Red |
| **Recurrence Generated** | When new recurring task is created | 🔄 Refresh | Green |
| **Task Completed** | When someone completes your task | ✓ Check | Emerald |

---

## 🎯 How It Works

### Automatic Notifications

The system automatically sends notifications:

1. **When you create a task:**
   - Assigned users get "Task Assigned" notification

2. **When scheduler runs (daily):**
   - Users with tasks due in 3 days get "3-Day Reminder"
   - Users with tasks due tomorrow get "1-Day Reminder"
   - Users with overdue tasks get "Overdue" notification
   - Users with new recurring tasks get "Recurrence Generated" notification

3. **When a task is completed:**
   - The assignee gets "Task Completed" notification (if completed by someone else)

### No Duplicates

The system prevents duplicate notifications:
- You won't get the same reminder twice
- Overdue notifications are sent only once per task
- Recurrence notifications are sent only when new instances are created

---

## 🔔 Using Notifications

### View Notifications

1. Click the **bell icon** in the top right corner
2. See all your notifications
3. Unread notifications have a red badge with count

### Mark as Read

- Click **"Mark as read"** on individual notifications
- Or click **"Mark all as read"** to clear all unread notifications

### Delete Notifications

- Click the **trash icon** on any notification to delete it

### Auto-Refresh

- Notifications automatically refresh every 30 seconds
- You'll see new notifications appear without refreshing the page

---

## 🧪 Testing Checklist

### Test Task Assignment
- [ ] Create a task as admin
- [ ] Assign it to a user
- [ ] Login as that user
- [ ] Check notification bell
- [ ] Should see "New Task Assigned" notification

### Test 3-Day Reminder
- [ ] Create a task due in 3 days
- [ ] Run the scheduler
- [ ] Check notification bell
- [ ] Should see "Task Due in 3 Days" notification

### Test 1-Day Reminder
- [ ] Create a task due tomorrow
- [ ] Run the scheduler
- [ ] Check notification bell
- [ ] Should see "Task Due Tomorrow" notification

### Test Overdue Notification
- [ ] Create a task with past due date
- [ ] Run the scheduler
- [ ] Check notification bell
- [ ] Should see "Task Overdue" notification

### Test Recurrence Notification
- [ ] Create a daily recurring task
- [ ] Run the scheduler
- [ ] Check notification bell
- [ ] Should see "New Recurring Task Generated" notification

### Test Task Completion
- [ ] Login as admin
- [ ] View a task assigned to another user
- [ ] Mark it as complete
- [ ] Login as the assigned user
- [ ] Check notification bell
- [ ] Should see "Task Completed" notification

---

## 🎨 Notification Appearance

### In the Header
```
┌─────────────────────────────────────┐
│  DILG Siquijor Task Tracker    🔔 3 │
└─────────────────────────────────────┘
```
The bell icon shows the unread count in a red badge.

### In the Panel
```
┌─────────────────────────────────────┐
│ Notifications        Mark all read  │
├─────────────────────────────────────┤
│ 📅 Task Due in 3 Days               │
│ "Monthly Report" is due on          │
│ 2024-02-15 at 09:00                 │
│ 5m ago  [Mark as read]  [🗑️]       │
├─────────────────────────────────────┤
│ ⚠️ Task Overdue                     │
│ "Weekly Summary" was due on         │
│ 2024-02-10 at 17:00 and is now     │
│ overdue                             │
│ 2h ago  [Mark as read]  [🗑️]       │
└─────────────────────────────────────┘
```

---

## 🔧 Troubleshooting

### Notifications Not Appearing?

1. **Check database table exists:**
   ```sql
   SELECT * FROM public.notifications LIMIT 5;
   ```

2. **Run the scheduler manually:**
   - Go to Scheduler page
   - Click "Run Scheduler"
   - Check console for errors

3. **Check browser console:**
   - Press F12
   - Look for [Notification] errors

4. **Verify RLS policies:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'notifications';
   ```

### Duplicate Notifications?

The system should prevent duplicates automatically. If you see duplicates:
- Check the scheduler isn't running multiple times
- Verify the database queries are working correctly
- Check browser console for errors

### Notifications Not Marking as Read?

- Check RLS policy allows updates
- Verify the "Mark as read" button is being clicked
- Check browser console for errors

---

## 📊 Database Queries

### View All Notifications
```sql
SELECT 
  n.id,
  n.type,
  n.title,
  n.message,
  n.read,
  n.created_at,
  u.name as user_name
FROM public.notifications n
JOIN public.users u ON n.user_id = u.id
ORDER BY n.created_at DESC;
```

### Count Unread Notifications by User
```sql
SELECT 
  u.name,
  COUNT(*) as unread_count
FROM public.notifications n
JOIN public.users u ON n.user_id = u.id
WHERE n.read = false
GROUP BY u.name
ORDER BY unread_count DESC;
```

### Delete Old Read Notifications
```sql
DELETE FROM public.notifications
WHERE read = true
  AND created_at < NOW() - INTERVAL '30 days';
```

---

## ⚙️ Configuration

### Auto-Refresh Interval

To change how often notifications refresh (default: 30 seconds):

Edit `src/components/NotificationBell.tsx`:
```typescript
// Change this line:
const interval = setInterval(loadNotifications, 30000);

// To your preferred interval (in milliseconds):
const interval = setInterval(loadNotifications, 60000); // 60 seconds
```

### Notification Types

To add new notification types:

1. Update the `NotificationType` type in `src/services/notification.ts`
2. Add the type to the database CHECK constraint
3. Update the `getNotificationIcon` and `getNotificationColor` functions
4. Create a method to generate the new notification type

---

## 📚 Documentation

- **Full Guide:** `NOTIFICATION_SYSTEM.md` - Complete technical documentation
- **Database Schema:** `CREATE_NOTIFICATIONS_TABLE.sql` - SQL migration file
- **Service:** `src/services/notification.ts` - Notification service implementation
- **UI Component:** `src/components/NotificationBell.tsx` - Notification bell component

---

## ✅ Success Indicators

You know the notification system is working when:

- ✅ Bell icon appears in the header
- ✅ Red badge shows unread count
- ✅ Clicking bell opens notification panel
- ✅ Notifications appear when tasks are assigned
- ✅ Reminders appear 3 days and 1 day before due date
- ✅ Overdue notifications appear for past-due tasks
- ✅ Recurrence notifications appear when scheduler runs
- ✅ Can mark notifications as read
- ✅ Can delete notifications
- ✅ Notifications auto-refresh every 30 seconds

---

## 🎉 You're Done!

Your notification system is now fully functional. Users will receive timely reminders about their tasks, helping them stay on top of their workload.

**Next Steps:**
1. Run the database migration
2. Test by creating a task
3. Run the scheduler
4. Check notifications appear
5. Enjoy your new notification system!

---

**Need Help?**
- Check `NOTIFICATION_SYSTEM.md` for detailed documentation
- Review the troubleshooting section above
- Check browser console for error messages
- Verify database table and policies exist

**Version:** 1.0.0  
**Status:** Production Ready ✅
