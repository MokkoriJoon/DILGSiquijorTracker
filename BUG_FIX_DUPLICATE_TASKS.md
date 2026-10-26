# 🐛 Bug Fix: Duplicate Task Instances

## Issue Description

When creating a daily task and assigning it to multiple users, each user was receiving **duplicate task instances** (2 tasks per user instead of 1).

**Example:**
- Creating 1 daily task assigned to 2 users
- Expected: 2 total tasks (1 per user)
- Actual: 4 total tasks (2 per user) ❌

---

## Root Cause

The task creation process was creating instances **twice**:

### First Creation (Correct)
In `TaskManagement.tsx` line 325:
```typescript
const assignmentsSaved = await DatabaseService.updateTaskAssignments(
  template.id, 
  selectedUsers
);
```

The `updateTaskAssignments()` function in `database.ts` was:
1. Saving assignments to `task_assignments` table
2. **Creating initial task instances** for each assigned user

### Second Creation (Duplicate)
In `TaskManagement.tsx` lines 333-351:
```typescript
// Create initial instances for each selected user
for (const userId of selectedUsers) {
  const instanceResult = await DatabaseService.createInstance({
    templateId: template.id,
    assignedTo: userId,
    dueDate: initialDueDate,
    // ...
  });
}
```

This manual loop was **also creating instances** for each user, resulting in duplicates.

---

## Solution

### Changes Made

#### 1. Removed Duplicate Instance Creation
**File:** `src/pages/TaskManagement.tsx`

**Before:**
```typescript
// Save task assignments
await DatabaseService.updateTaskAssignments(template.id, selectedUsers);

// ❌ DUPLICATE: Create instances manually
for (const userId of selectedUsers) {
  await DatabaseService.createInstance({
    templateId: template.id,
    assignedTo: userId,
    // ...
  });
}
```

**After:**
```typescript
// Save task assignments (this creates instances automatically)
await DatabaseService.updateTaskAssignments(template.id, selectedUsers);

// ✅ Only send notifications (no duplicate instance creation)
for (const userId of selectedUsers) {
  await NotificationService.notifyTaskAssignment(
    template.id,
    template.title,
    userId,
    initialDueDate
  );
}
```

#### 2. Improved Daily Task Date Calculation
**File:** `src/services/database.ts`

**Before:**
```typescript
const dueDate = template.recurrence === 'ONCE' 
  ? new Date().toISOString().split('T')[0]
  : calculateNextDueDate(template.recurrence, template.due_day || 25);
```

**After:**
```typescript
let dueDate: string;

if (template.recurrence === 'ONCE') {
  dueDate = new Date().toISOString().split('T')[0];
} else if (template.recurrence === 'DAILY' && template.start_date) {
  // ✅ For DAILY tasks, use the start_date
  dueDate = template.start_date;
} else {
  // For other recurring tasks, calculate next due date
  dueDate = calculateNextDueDate(template.recurrence, template.due_day || 25);
}
```

This ensures daily tasks use their configured `start_date` instead of calculating the next occurrence.

---

## How Task Creation Works Now

### Flow Diagram
```
User creates task
    ↓
1. Create task template
    ↓
2. Save assignments to task_assignments table
    ↓
3. updateTaskAssignments() creates initial instances
   (one per assigned user)
    ↓
4. Send notifications to assigned users
    ↓
✅ Done! Each user has exactly 1 task instance
```

### Scheduler Flow (For Recurring Tasks)
```
Scheduler runs (daily)
    ↓
1. Fetch all recurring templates
    ↓
2. Get existing instances (to avoid duplicates)
    ↓
3. For each template:
   - Get assigned users from task_assignments
   - Generate instances for next 30 days
   - Check existingSet to skip duplicates
   - Insert new instances
    ↓
✅ No duplicates created!
```

---

## Testing

### Test Case 1: Create Daily Task for 2 Users
1. Create a daily task
2. Assign to User A and User B
3. **Expected Result:**
   - User A has 1 task instance
   - User B has 1 task instance
   - Total: 2 instances ✅

### Test Case 2: Create Weekly Task for 3 Users
1. Create a weekly task
2. Assign to User A, User B, and User C
3. **Expected Result:**
   - Each user has 1 task instance
   - Total: 3 instances ✅

### Test Case 3: Run Scheduler
1. Create a recurring task
2. Run the scheduler
3. **Expected Result:**
   - Scheduler creates instances for next 30 days
   - No duplicate instances created ✅

---

## Files Modified

1. **`src/pages/TaskManagement.tsx`**
   - Removed duplicate instance creation loop
   - Kept only notification sending

2. **`src/services/database.ts`**
   - Improved `updateTaskAssignments()` to handle DAILY tasks correctly
   - Uses `start_date` for daily tasks instead of calculating next date

---

## Prevention

To prevent similar issues in the future:

### ✅ Do:
- Use `updateTaskAssignments()` to create initial instances
- Let the scheduler handle recurring instance generation
- Check `existingSet` before creating instances

### ❌ Don't:
- Manually create instances after calling `updateTaskAssignments()`
- Create instances in multiple places
- Skip the duplicate check in the scheduler

---

## Verification Query

To check for duplicate instances in your database:

```sql
-- Find duplicate task instances
SELECT 
  template_id,
  assigned_to,
  due_date,
  COUNT(*) as instance_count
FROM task_instances
GROUP BY template_id, assigned_to, due_date
HAVING COUNT(*) > 1
ORDER BY instance_count DESC;
```

If this returns any results, you have duplicates that need to be cleaned up.

### Cleanup Query (Use with Caution!)
```sql
-- Remove duplicate instances (keeps the first one)
DELETE FROM task_instances
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY template_id, assigned_to, due_date 
        ORDER BY created_at
      ) as row_num
    FROM task_instances
  ) t
  WHERE t.row_num > 1
);
```

⚠️ **Warning:** Always backup your database before running DELETE queries!

---

## Summary

✅ **Fixed:** Duplicate task instance creation  
✅ **Improved:** Daily task date calculation  
✅ **Verified:** Scheduler duplicate prevention  
✅ **Tested:** Task creation flow  

**Build Status:** ✅ Successful  
**Bundle Size:** 954.68 KB (gzipped: 255.72 KB)

---

**Last Updated:** 2024  
**Status:** ✅ Fixed and Deployed  
**Version:** 3.0.1
