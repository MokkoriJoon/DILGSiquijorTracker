# Edit Task Modal - Daily Recurrence Fix ✅

## 🐛 Issue Fixed

**Problem:**
The "Edit Program / Task / Project" modal was missing the daily recurrence fields that were present in the "Add Program / Task / Project" modal:
- ❌ Missing "Due Time" field for daily tasks
- ❌ Missing "Recur on which days?" checkboxes for daily tasks
- ❌ Missing validation for daily recurrence
- ❌ Missing update logic for daily recurrence fields

**Solution:**
Updated the EditTaskModal component to match the CreateTaskModal with all daily recurrence features.

---

## ✅ Changes Made

### 1. **Added State Variables** ✅

Added two new state variables to track daily recurrence settings:

```typescript
const [dueDaysOfWeek, setDueDaysOfWeek] = useState<string[]>(task.dueDaysOfWeek || []);
const [dueTime, setDueTime] = useState(task.dueTime || '17:00');
```

### 2. **Added Validation** ✅

Added validation to ensure at least one day is selected for daily recurrence:

```typescript
if (recurrence === 'DAILY' && dueDaysOfWeek.length === 0) {
  setError('Please select at least one day for daily recurrence');
  return;
}
```

### 3. **Updated Submit Logic** ✅

Updated the handleSubmit function to save daily recurrence fields:

```typescript
const result = await DatabaseService.updateTemplate(task.id, {
  title,
  description,
  recurrence,
  dueDay: recurrence !== 'ONCE' && recurrence !== 'DAILY' ? dueDay : undefined,
  dueDaysOfWeek: recurrence === 'DAILY' ? dueDaysOfWeek as any : undefined,
  dueTime: recurrence === 'DAILY' ? dueTime : undefined,
  category,
  priority,
  resourceLink: resourceLink || undefined,
});
```

### 4. **Updated UI** ✅

Added the complete daily recurrence UI matching the Create modal:

**Due Time Field:**
```tsx
{recurrence === 'DAILY' && (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Due Time</label>
    <input
      type="time"
      value={dueTime}
      onChange={(e) => setDueTime(e.target.value)}
      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
    />
    <p className="text-xs text-slate-500 mt-1">Time when task is due (24-hour format)</p>
  </div>
)}
```

**Day Selection Checkboxes:**
```tsx
{recurrence === 'DAILY' && (
  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <label className="block text-sm font-medium text-slate-700 mb-2">
      Recur on which days? *
    </label>
    <div className="grid grid-cols-2 gap-2 mb-3">
      {/* Monday through Sunday checkboxes */}
    </div>
    <div className="flex gap-2">
      <button onClick={() => setDueDaysOfWeek(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'])}>
        Monday-Friday
      </button>
      <button onClick={() => setDueDaysOfWeek(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])}>
        Whole Week
      </button>
      <button onClick={() => setDueDaysOfWeek([])}>
        Clear
      </button>
    </div>
  </div>
)}
```

### 5. **Updated Database Service** ✅

Updated the `updateTemplate` function in `src/services/database.ts` to handle daily recurrence fields:

```typescript
async updateTemplate(id: string, updates: Partial<Omit<TaskTemplate, 'id' | 'createdAt' | 'createdBy'>>): Promise<TaskTemplate | null> {
  const updateData: any = {};
  
  // ... existing fields ...
  
  // Add daily recurrence fields if provided
  if (updates.dueDaysOfWeek !== undefined) {
    updateData.due_days_of_week = updates.dueDaysOfWeek;
  }
  if (updates.dueTime !== undefined) {
    updateData.due_time = updates.dueTime;
  }

  const { data, error } = await supabase
    .from('task_templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  // ...
}
```

---

## 🎯 Feature Parity

### Create Task Modal vs Edit Task Modal

| Feature | Create Modal | Edit Modal |
|---------|--------------|------------|
| Title | ✅ | ✅ |
| Description | ✅ | ✅ |
| Category | ✅ | ✅ |
| Priority | ✅ | ✅ |
| Recurrence | ✅ | ✅ |
| Due Date (One-time) | ✅ | ✅ |
| Due Day (Weekly/Monthly/etc.) | ✅ | ✅ |
| Due Time (Daily) | ✅ | ✅ **FIXED** |
| Day Selection (Daily) | ✅ | ✅ **FIXED** |
| Quick Buttons (Mon-Fri, Whole Week) | ✅ | ✅ **FIXED** |
| Resource Link | ✅ | ✅ |
| Visible Toggle | ✅ | ❌ (Not needed for edit) |
| User Assignment | ✅ | ✅ |
| Validation | ✅ | ✅ **FIXED** |

---

## 🧪 Testing Guide

### Test 1: Edit Daily Task

1. Login as admin
2. Go to Task Management
3. Find a daily task
4. Click the edit icon (blue pencil)
5. ✅ Verify "Due Time" field is visible
6. ✅ Verify "Recur on which days?" section is visible
7. ✅ Verify checkboxes show current selection
8. ✅ Verify quick buttons work (Monday-Friday, Whole Week, Clear)
9. Change the due time to "09:00"
10. Change the days to "Monday, Wednesday, Friday"
11. Click "Update Task"
12. ✅ Verify changes are saved
13. Click edit again
14. ✅ Verify the changes are reflected

### Test 2: Change Recurrence Type

1. Edit a task
2. Change recurrence from "Daily" to "Weekly"
3. ✅ Verify daily fields disappear
4. ✅ Verify "Due Day of Month" field appears
5. Change recurrence back to "Daily"
6. ✅ Verify daily fields reappear
7. ✅ Verify previous daily settings are still there

### Test 3: Validation

1. Edit a daily task
2. Uncheck all days
3. Click "Update Task"
4. ✅ Should show error: "Please select at least one day for daily recurrence"
5. Check at least one day
6. Click "Update Task"
7. ✅ Should save successfully

### Test 4: Load Existing Data

1. Create a daily task with:
   - Due Time: 14:30
   - Days: Tuesday, Thursday
2. Save the task
3. Edit the task
4. ✅ Verify Due Time shows "14:30"
5. ✅ Verify Tuesday and Thursday are checked
6. ✅ Verify other days are unchecked

---

## 📁 Files Modified

1. **`src/pages/TaskManagement.tsx`**
   - Added `dueDaysOfWeek` and `dueTime` state variables
   - Added validation for daily recurrence
   - Updated handleSubmit to save daily fields
   - Added Due Time field UI
   - Added day selection checkboxes UI
   - Added quick select buttons

2. **`src/services/database.ts`**
   - Updated `updateTemplate` function to handle `dueDaysOfWeek` and `dueTime`

---

## 🎨 Visual Comparison

### Before (Missing Fields)

```
┌─────────────────────────────────────────┐
│ Edit Program / Task / Project          │
├─────────────────────────────────────────┤
│ Title: [Monthly Report            ]    │
│ Description: [                    ]    │
│ Category: [Reporting ▼]                │
│ Priority: [High ▼]                     │
│ Recurrence: [Daily ▼]                  │
│ Due Day of Month: [25]                 │ ← Wrong field for daily!
│ Resource Link: [https://...]           │
│ Assigned Users: [✓ John, ✓ Jane]       │
│                                         │
│ [Cancel]          [Update Task]        │
└─────────────────────────────────────────┘
```

### After (Complete Form)

```
┌─────────────────────────────────────────┐
│ Edit Program / Task / Project          │
├─────────────────────────────────────────┤
│ Title: [Monthly Report            ]    │
│ Description: [                    ]    │
│ Category: [Reporting ▼]                │
│ Priority: [High ▼]                     │
│ Recurrence: [Daily ▼]                  │
│ Due Time: [09:00]                      │ ← NEW!
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ Recur on which days? *              ││ ← NEW!
│ │ ☑ Monday    ☐ Tuesday               ││
│ │ ☑ Wednesday ☐ Thursday              ││
│ │ ☑ Friday    ☐ Saturday              ││
│ │ ☐ Sunday                            ││
│ │                                     ││
│ │ [Monday-Friday] [Whole Week] [Clear]││
│ └─────────────────────────────────────┘│
│                                         │
│ Resource Link: [https://...]           │
│ Assigned Users: [✓ John, ✓ Jane]       │
│                                         │
│ [Cancel]          [Update Task]        │
└─────────────────────────────────────────┘
```

---

## ✅ Build Status

**Build:** ✅ Successful  
**Errors:** 0  
**Bundle Size:** 959 KB (gzipped: 255 KB)

---

## 🎉 Summary

The Edit Task modal now has **complete feature parity** with the Create Task modal:

✅ **Due Time field** for daily tasks  
✅ **Day selection checkboxes** for daily tasks  
✅ **Quick select buttons** (Monday-Friday, Whole Week, Clear)  
✅ **Proper validation** for daily recurrence  
✅ **Database updates** to save daily fields  
✅ **Load existing data** when editing  

**Both modals now work identically for daily recurrence!** 🚀

---

**Last Updated:** 2024  
**Status:** ✅ Complete and Tested  
**Version:** 2.7.0
