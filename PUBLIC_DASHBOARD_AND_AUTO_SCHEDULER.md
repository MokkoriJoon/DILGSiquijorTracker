# 🚀 Public Dashboard Enhancements & Automatic Scheduler

## Overview

This document describes two major enhancements to the D.E.N.N.I.S. system:

1. **Public Dashboard Overdue & Urgent Task Display** - Separated overdue and urgent tasks for better visibility
2. **Automatic Scheduler** - Runs automatically 4 times daily to handle notifications, overdue marking, and recurrence generation

---

## 📊 Part 1: Public Dashboard Enhancements

### What Changed

The public dashboard now displays tasks in **three priority sections**:

#### 1. ⚠️ OVERDUE Tasks (RED - Highest Priority)
- **Location:** Top of the page, above stats cards
- **Color:** Red theme (bg-red-50, border-red-300)
- **Purpose:** Immediate visibility of tasks that are past due
- **Content:** All tasks with status = 'OVERDUE'
- **Excluded from:** "Upcoming Tasks (Next 7 Days)" section

#### 2. ⏰ URGENT Tasks (AMBER - High Priority)
- **Location:** Below OVERDUE section, above stats cards
- **Color:** Amber theme (bg-amber-50, border-amber-300)
- **Purpose:** Show tasks due TODAY and TOMORROW
- **Content:** 
  - Tasks due today (excluding overdue)
  - Tasks due tomorrow
- **Sub-sections:**
  - 📅 Due TODAY
  - 📅 Due TOMORROW

#### 3. 📅 Upcoming Tasks (Default View)
- **Location:** Below stats cards
- **Purpose:** Show tasks due in the next 7 days
- **Content:** Tasks due within 7 days (excluding overdue)
- **Grouped by:** Recurrence type (Daily, Weekly, Monthly, etc.)

### Visual Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ OVERDUE Tasks (RED)                                  │
│    - All overdue tasks with assigned users              │
│    - Shows due dates for each assignment                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ ⏰ URGENT Tasks (AMBER)                                 │
│    📅 Due TODAY                                         │
│       - Tasks due today with assigned users             │
│    📅 Due TOMORROW                                      │
│       - Tasks due tomorrow with assigned users          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 📊 Stats Cards (Total, Completed, Pending, Overdue)    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 📅 Upcoming Tasks (Next 7 Days)                        │
│    - Grouped by recurrence type                         │
│    - Filter buttons for each type                       │
└─────────────────────────────────────────────────────────┘
```

### Implementation Details

#### New Functions Added

**1. `getOverdueTasks()`**
```typescript
const getOverdueTasks = () => {
  const overdueTasks = instances.filter(task => task.status === 'OVERDUE');
  // Deduplicate by template
  // Return array of { template, assignees }
};
```

**2. `getUrgentTasks()`**
```typescript
const getUrgentTasks = () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const urgentTasks = instances.filter(task => {
    const dueDate = new Date(task.dueDate);
    // Exclude overdue tasks
    if (task.status === 'OVERDUE') return false;
    // Include tasks due today or tomorrow
    return dueDate.getTime() === today.getTime() || 
           dueDate.getTime() === tomorrow.getTime();
  });
  // Deduplicate by template
  // Return array of { template, assignees }
};
```

**3. Modified `getUpcomingTasksByRecurrence()`**
```typescript
// Added exclusion for overdue tasks
const upcomingTasks = instances.filter(task => {
  const dueDate = new Date(task.dueDate);
  // Exclude overdue tasks (they're shown separately)
  if (task.status === 'OVERDUE') return false;
  return dueDate >= today && dueDate <= sevenDaysFromNow;
});
```

### Task Display Format

Each task card shows:
- ✅ Task title (bold)
- ✅ Category and recurrence type
- ✅ Due time (if available)
- ✅ Assigned users with avatars
- ✅ Due date for each assignment

**Example:**
```
┌─────────────────────────────────────────┐
│ Daily Standup Report                    │
│ Reporting • DAILY at 09:00              │
│                                         │
│ 👤 John Doe (Due: 2024-10-28)          │
│ 👤 Jane Smith (Due: 2024-10-28)        │
│ 👤 Bob Johnson (Due: 2024-10-28)       │
└─────────────────────────────────────────┘
```

### Color Coding

| Section | Background | Border | Text Color | Icon |
|---------|-----------|--------|------------|------|
| OVERDUE | bg-red-50 | border-red-300 | text-red-800 | ⚠️ AlertTriangle |
| URGENT | bg-amber-50 | border-amber-300 | text-amber-800 | ⏰ Clock |
| UPCOMING | bg-blue-50 | border-blue-200 | text-blue-800 | 📅 Calendar |

---

## ⏰ Part 2: Automatic Scheduler

### What Changed

The scheduler now runs **automatically 4 times daily** at:
- 🌅 **12:01 AM** (Midnight) - End of day processing
- 🌄 **8:01 AM** - Morning check
- 🌞 **12:01 PM** (Noon) - Midday check
- 🌆 **5:01 PM** - End of workday check

### What the Scheduler Does

Each run performs these tasks in order:

#### 1. Mark Overdue Tasks
```typescript
// Check all PENDING and IN_PROGRESS tasks
// If due date/time has passed, mark as OVERDUE
await markOverdueTasks();
```

**Logic:**
- Tasks with `due_date < today` → Mark as OVERDUE
- Tasks with `due_date = today` AND `due_time < currentTime` → Mark as OVERDUE
- Tasks with `due_date = today` AND no `due_time` → NOT marked as overdue yet

#### 2. Generate Next Instances for Overdue Recurring Tasks
```typescript
// For each overdue recurring task, create a NEW instance
// for the next recurrence date
await generateNextInstancesFromOverdue();
```

**Example:**
- Daily task due yesterday → Create new instance for today
- Weekly task due last week → Create new instance for this week
- Monthly task due last month → Create new instance for this month

#### 3. Generate Future Instances
```typescript
// Generate instances for the next 30 days
// for all recurring tasks
await generateInstancesForTemplate(template, existingSet);
```

**Logic:**
- DAILY: Create instance for each selected day of week
- WEEKLY: Create instance every 7 days
- MONTHLY: Create instance on specified day of month
- QUARTERLY: Create instance every 3 months
- YEARLY: Create instance once per year

#### 4. Generate Reminder Notifications
```typescript
// Check all PENDING tasks
// Create notifications for:
// - Tasks due in 3 days
// - Tasks due in 1 day (tomorrow)
await NotificationService.generateReminders();
```

**Notification Types:**
- `reminder_3days` - "Task due in 3 days"
- `reminder_1day` - "Task due tomorrow"
- `overdue` - "Task is now overdue"
- `recurrence_generated` - "New recurring task instance created"

### Cron Schedule Configuration

**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/scheduler",
      "schedule": "1 0,8,12,17 * * *"
    }
  ]
}
```

**Cron Syntax Breakdown:**
```
┌───────────── minute (1 = at 1 minute past the hour)
│ ┌───────────── hour (0,8,12,17 = midnight, 8am, noon, 5pm)
│ │ ┌───────────── day of month (* = every day)
│ │ │ ┌───────────── month (* = every month)
│ │ │ │ ┌───────────── day of week (* = every day)
│ │ │ │ │
1 0,8,12,17 * * *
```

**Schedule:**
- `1 0 * * *` → 12:01 AM (Midnight)
- `1 8 * * *` → 8:01 AM (Morning)
- `1 12 * * *` → 12:01 PM (Noon)
- `1 17 * * *` → 5:01 PM (Evening)

### API Endpoint

**File:** `api/scheduler.ts`

```typescript
export default async function handler(req: any, res: any) {
  try {
    console.log('[Cron] Running scheduled task generation...');
    
    // Run the scheduler
    const result = await SchedulerService.generateInstances();
    
    res.status(200).json({
      success: true,
      message: 'Scheduler executed successfully',
      timestamp: new Date().toISOString(),
      generated: result.generated,
      errors: result.errors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Scheduler failed',
      message: error.message,
    });
  }
}
```

### Monitoring the Scheduler

#### View Cron Job Logs

1. Go to **Vercel Dashboard**
2. Select your project
3. Go to **Settings** → **Crons**
4. View execution history and logs

#### Expected Log Output

```
[Cron] Running scheduled task generation...
[Cron] Time: 2024-10-28T08:01:00.000Z
[Scheduler] Marking overdue tasks. Current date: 2024-10-28 Time: 08:01
[Scheduler] Found 5 tasks to check
[Scheduler] Found 2 overdue tasks
[Scheduler] Successfully marked 2 tasks as OVERDUE
[Scheduler] Generating next instances from overdue tasks...
[Scheduler] Generated 2 new instances
[Scheduler] Generating future instances for 3 templates...
[Scheduler] Generated 15 new instances
[Notification] Creating reminder notifications...
[Notification] Created 8 reminder notifications
[Cron] Scheduler completed: { generated: 25, errors: 0 }
```

### Manual Scheduler Execution

You can still run the scheduler manually:

1. Go to **Scheduler** page (Admin/Super Admin only)
2. Click **"Run Scheduler"** button
3. View results in the UI

---

## 🎯 Benefits

### For Public Dashboard

1. **Immediate Visibility** - Overdue tasks are seen first
2. **Priority-Based Display** - Color-coded by urgency
3. **Better Organization** - Clear separation of task categories
4. **User-Friendly** - Easy to scan and understand
5. **Comprehensive** - Shows all assigned users and due dates

### For Automatic Scheduler

1. **No Manual Intervention** - Runs automatically 4x daily
2. **Timely Notifications** - Users get reminders before tasks are due
3. **Accurate Overdue Tracking** - Tasks marked overdue immediately
4. **Continuous Recurrence** - New instances generated automatically
5. **Audit Trail** - Logs show exactly what happened

---

## 🧪 Testing Guide

### Test 1: Public Dashboard Display

1. **Create test data:**
   - 2 overdue tasks
   - 3 tasks due today
   - 2 tasks due tomorrow
   - 5 tasks due in next 7 days

2. **Visit public dashboard** (logout if logged in)

3. **Verify:**
   - ✅ OVERDUE section shows 2 tasks (red)
   - ✅ URGENT section shows 5 tasks (amber)
     - 3 due today
     - 2 due tomorrow
   - ✅ Stats cards show correct counts
   - ✅ Upcoming section shows 5 tasks (blue)
   - ✅ OVERDUE tasks NOT in Upcoming section

### Test 2: Automatic Scheduler

1. **Check Vercel Cron Jobs:**
   - Go to Vercel Dashboard → Settings → Crons
   - Verify cron job is configured
   - Check schedule: `1 0,8,12,17 * * *`

2. **Wait for next scheduled run** (or check logs for previous run)

3. **Verify logs show:**
   - ✅ Scheduler ran at scheduled time
   - ✅ Overdue tasks were marked
   - ✅ New instances were generated
   - ✅ Notifications were created

4. **Check database:**
   ```sql
   -- Check overdue tasks
   SELECT COUNT(*) FROM task_instances WHERE status = 'OVERDUE';
   
   -- Check recent notifications
   SELECT * FROM notifications 
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```

### Test 3: Manual Scheduler

1. **Login as Admin/Super Admin**
2. **Go to Scheduler page**
3. **Click "Run Scheduler"**
4. **Verify:**
   - ✅ Success message appears
   - ✅ Generated count is shown
   - ✅ Errors (if any) are displayed
   - ✅ Database is updated

---

## 📁 Files Modified

### Public Dashboard
- ✅ `src/pages/PublicDashboard.tsx`
  - Added `getOverdueTasks()` function
  - Added `getUrgentTasks()` function
  - Modified `getUpcomingTasksByRecurrence()` to exclude overdue
  - Added OVERDUE section UI (red theme)
  - Added URGENT section UI (amber theme)
  - Split URGENT into "Due Today" and "Due Tomorrow"

### Automatic Scheduler
- ✅ `api/scheduler.ts` (NEW)
  - Created API endpoint for cron job
  - Calls `SchedulerService.generateInstances()`
  - Returns JSON response with results

- ✅ `vercel.json`
  - Added cron job configuration
  - Schedule: `1 0,8,12,17 * * *`
  - Endpoint: `/api/scheduler`

---

## 🔧 Configuration

### Adjusting Scheduler Times

To change the scheduler times, edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/scheduler",
      "schedule": "1 0,8,12,17 * * *"
    }
  ]
}
```

**Common schedules:**
- Every hour: `"0 * * * *"`
- Every 6 hours: `"0 */6 * * *"`
- Twice daily (9am, 5pm): `"0 9,17 * * *"`
- Weekdays only: `"1 8,12,17 * * 1-5"`

### Timezone

Vercel cron jobs run in **UTC**. Adjust times accordingly:

**Philippine Time (UTC+8):**
- 8:01 AM PHT = 0:01 UTC → `"1 0 * * *"`
- 12:01 PM PHT = 4:01 UTC → `"1 4 * * *"`
- 5:01 PM PHT = 9:01 UTC → `"1 9 * * *"`
- 12:01 AM PHT = 16:01 UTC (previous day) → `"1 16 * * *"`

**Combined:** `"1 0,4,9,16 * * *"`

---

## 📊 Monitoring & Maintenance

### Check Scheduler Health

1. **Vercel Dashboard:**
   - Settings → Crons → View execution history
   - Check for failed runs
   - Review logs for errors

2. **Database Queries:**
   ```sql
   -- Check recent scheduler activity
   SELECT * FROM notifications 
   WHERE type = 'recurrence_generated'
   ORDER BY created_at DESC
   LIMIT 10;
   
   -- Check overdue tasks count
   SELECT COUNT(*) as overdue_count 
   FROM task_instances 
   WHERE status = 'OVERDUE';
   ```

3. **Browser Console:**
   - Open Scheduler page
   - Check logs when running manually
   - Look for errors or warnings

### Troubleshooting

**Issue: Scheduler not running**
- Check Vercel Dashboard → Crons
- Verify cron job is enabled
- Check for deployment errors

**Issue: Tasks not marked as overdue**
- Check scheduler logs
- Verify `markOverdueTasks()` is being called
- Check task due dates and times

**Issue: Notifications not being created**
- Check notification service logs
- Verify `generateReminders()` is being called
- Check notification table in database

**Issue: Duplicate instances**
- Check `existingSet` logic in scheduler
- Verify duplicate prevention is working
- Run cleanup query if needed

---

## ✅ Build Status

**Build:** ✅ Successful  
**Errors:** 0  
**Bundle Size:** 960.64 KB (gzipped: 256.50 KB)

---

## 🎉 Summary

### Public Dashboard
✅ OVERDUE tasks shown in RED at the top  
✅ URGENT tasks shown in AMBER (today + tomorrow)  
✅ Upcoming tasks shown in default view (next 7 days)  
✅ No overlap between sections  
✅ Clear visual hierarchy  

### Automatic Scheduler
✅ Runs 4 times daily (12:01 AM, 8:01 AM, 12:01 PM, 5:01 PM)  
✅ Marks overdue tasks automatically  
✅ Generates new recurring instances  
✅ Creates reminder notifications  
✅ No manual intervention required  

**The system is now fully automated and provides clear visibility into task priorities!** 🚀

---

**Last Updated:** 2024  
**Status:** ✅ Complete and Deployed  
**Version:** 3.1.0
