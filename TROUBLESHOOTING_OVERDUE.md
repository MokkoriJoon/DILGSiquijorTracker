# 🔧 Troubleshooting: Overdue Tasks Not Being Marked

## Problem
Daily recurring task created for 10/26/2026 at 2:46 PM is not being marked as OVERDUE even though the time has passed.

---

## 🧪 Step-by-Step Diagnostic

### Step 1: Check Browser Console Logs

1. Go to **Scheduler** page
2. Open browser console (F12)
3. Click **"Run Scheduler"**
4. Look for these logs:

```
[Scheduler] Marking overdue tasks. Current date: YYYY-MM-DD Time: HH:MM
[Scheduler] Found X tasks to check
[Scheduler] Checking task: { id: '...', due_date: '...', due_time: '...', status: '...', today: '...', currentTime: '...' }
[Scheduler] Task is overdue (past date): ... OR Task not overdue yet: ...
[Scheduler] Found X overdue tasks
[Scheduler] Successfully marked X tasks as OVERDUE
```

**Share these logs with me so I can see what's happening.**

---

### Step 2: Verify Task Details in Database

Run this SQL query in Supabase SQL Editor:

```sql
-- Check your task details
SELECT 
  ti.id,
  ti.status,
  ti.due_date,
  ti.due_time,
  ti.created_at,
  tt.title,
  tt.recurrence,
  tt.start_date,
  u.name as assigned_to
FROM task_instances ti
JOIN task_templates tt ON ti.template_id = tt.id
JOIN users u ON ti.assigned_to = u.id
WHERE tt.recurrence = 'DAILY'
ORDER BY ti.due_date DESC, ti.due_time DESC
LIMIT 10;
```

**Check:**
- ✅ Is the task status `PENDING` or `IN_PROGRESS`? (If it's already `OVERDUE` or `COMPLETED`, it won't be marked again)
- ✅ What is the `due_date`? (Should be a past date or today)
- ✅ What is the `due_time`? (Should be in HH:MM format like "14:46")
- ✅ What is today's date? (Compare with due_date)

---

### Step 3: Check Current Date/Time

Run this SQL to see what the database thinks "now" is:

```sql
SELECT 
  CURRENT_DATE as today_date,
  CURRENT_TIME as current_time,
  NOW() as full_timestamp;
```

**Compare this with your task's due_date and due_time.**

---

### Step 4: Manual Overdue Check

Run this query to see which tasks SHOULD be overdue:

```sql
-- Tasks that should be overdue (past due date)
SELECT 
  id,
  status,
  due_date,
  due_time,
  'Should be OVERDUE (past date)' as reason
FROM task_instances
WHERE status IN ('PENDING', 'IN_PROGRESS')
  AND due_date < CURRENT_DATE

UNION ALL

-- Tasks due today with past time
SELECT 
  id,
  status,
  due_date,
  due_time,
  'Should be OVERDUE (time passed)' as reason
FROM task_instances
WHERE status IN ('PENDING', 'IN_PROGRESS')
  AND due_date = CURRENT_DATE
  AND due_time < CURRENT_TIME

ORDER BY due_date, due_time;
```

**If this returns tasks but they're not marked as OVERDUE, there's a bug in the scheduler.**

---

### Step 5: Check if Scheduler is Running

Go to **Scheduler** page and check:
- ✅ Does it show "Last Run" time?
- ✅ Does it show how many instances were generated?
- ✅ Are there any error messages?

---

## 🔍 Common Issues & Solutions

### Issue 1: Task Date is in the Future

**Problem:** You created a task with start date 10/26/2026 (year 2026), which is in the future.

**Solution:** The scheduler can't mark future tasks as overdue. They become overdue only AFTER their due date/time passes.

**Check:**
```sql
SELECT due_date, CURRENT_DATE FROM task_instances WHERE id = 'YOUR-TASK-ID';
```

If `due_date > CURRENT_DATE`, the task is not due yet.

---

### Issue 2: Task Status is Not PENDING or IN_PROGRESS

**Problem:** The task might already be marked as OVERDUE or COMPLETED.

**Solution:** The scheduler only marks tasks with status `PENDING` or `IN_PROGRESS` as overdue.

**Check:**
```sql
SELECT status FROM task_instances WHERE id = 'YOUR-TASK-ID';
```

If status is already `OVERDUE` or `COMPLETED`, it won't be marked again.

---

### Issue 3: Time Format Mismatch

**Problem:** The `due_time` might be in a different format than expected.

**Expected format:** `HH:MM` (24-hour format) like "14:46" for 2:46 PM

**Check:**
```sql
SELECT due_time FROM task_instances WHERE id = 'YOUR-TASK-ID';
```

If it shows something like "2:46 PM" or "14:46:00", there might be a format issue.

---

### Issue 4: Timezone Issues

**Problem:** The database server time might be different from your local time.

**Solution:** Check what time the database thinks it is:

```sql
SELECT 
  CURRENT_TIME as db_time,
  NOW() as db_timestamp,
  CURRENT_DATE as db_date;
```

Compare this with your local time. If there's a significant difference, the scheduler might be using the wrong time.

---

### Issue 5: Scheduler Not Running

**Problem:** The scheduler might not be running at all.

**Solution:** 
1. Go to Scheduler page
2. Click "Run Scheduler" manually
3. Check browser console for logs
4. Verify tasks are being marked as overdue

---

## 🧪 Test Script

Run this in browser console (F12) to test the overdue logic:

```javascript
// Test the overdue marking logic
async function testOverdueLogic() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);
  
  console.log('Current date:', today);
  console.log('Current time:', currentTime);
  
  // Get all pending tasks
  const { data: tasks, error } = await supabase
    .from('task_instances')
    .select('*, template:task_templates(*)')
    .in('status', ['PENDING', 'IN_PROGRESS']);
  
  if (error) {
    console.error('Error fetching tasks:', error);
    return;
  }
  
  console.log('Found', tasks.length, 'tasks to check');
  
  // Check each task
  tasks.forEach(task => {
    const isOverdue = 
      task.due_date < today ||
      (task.due_date === today && task.due_time && task.due_time < currentTime);
    
    console.log('Task:', {
      id: task.id,
      due_date: task.due_date,
      due_time: task.due_time,
      status: task.status,
      isOverdue: isOverdue,
      reason: task.due_date < today ? 'Past date' :
              task.due_date === today && task.due_time < currentTime ? 'Time passed' :
              'Not due yet'
    });
  });
}

testOverdueLogic();
```

**This will show you exactly which tasks should be marked as overdue and why.**

---

## 📊 Expected Behavior

### Scenario 1: Task Due Yesterday
```
Task: due_date = 2024-10-25, due_time = 14:46
Today: 2024-10-27
Result: ✅ Should be marked as OVERDUE (past date)
```

### Scenario 2: Task Due Today, Time Passed
```
Task: due_date = 2024-10-27, due_time = 14:46
Today: 2024-10-27, Current time: 15:00
Result: ✅ Should be marked as OVERDUE (time passed)
```

### Scenario 3: Task Due Today, Time Not Passed
```
Task: due_date = 2024-10-27, due_time = 14:46
Today: 2024-10-27, Current time: 14:00
Result: ❌ Should NOT be marked as OVERDUE yet (time not passed)
```

### Scenario 4: Task Due Tomorrow
```
Task: due_date = 2024-10-28, due_time = 14:46
Today: 2024-10-27
Result: ❌ Should NOT be marked as OVERDUE (future date)
```

---

## 🎯 Action Plan

1. **Run the diagnostic SQL queries** (Steps 2-4 above)
2. **Run the scheduler manually** and check browser console logs
3. **Run the test script** in browser console
4. **Share the results** with me:
   - SQL query results
   - Browser console logs
   - Test script output

With this information, I can identify exactly what's wrong and fix it.

---

## 🐛 If Nothing Works

If the scheduler still doesn't mark tasks as overdue after all this, we might need to:

1. **Check RLS policies** - Make sure the scheduler can update task_instances
2. **Check database permissions** - Verify the Supabase user has UPDATE permissions
3. **Add manual override** - Create a button to manually mark tasks as overdue
4. **Debug the scheduler** - Add more detailed logging at every step

**Share your diagnostic results and I'll help you fix it!**
