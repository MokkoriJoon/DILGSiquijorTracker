-- ============================================================================
-- FIX: Add due_time column to task_instances and populate from templates
-- ============================================================================

-- Step 1: Add due_time column if it doesn't exist
ALTER TABLE public.task_instances 
ADD COLUMN IF NOT EXISTS due_time TIME;

-- Step 2: Update existing task instances with due_time from their templates
UPDATE public.task_instances ti
SET due_time = tt.due_time
FROM public.task_templates tt
WHERE ti.template_id = tt.id
  AND tt.due_time IS NOT NULL
  AND ti.due_time IS NULL;

-- Step 3: Verify the changes
SELECT 
  ti.id,
  ti.due_date,
  ti.due_time,
  tt.title,
  tt.due_time as template_due_time,
  CASE 
    WHEN ti.due_time IS NULL THEN '⚠️ Missing due_time'
    ELSE '✅ Has due_time'
  END as status
FROM public.task_instances ti
JOIN public.task_templates tt ON ti.template_id = tt.id
WHERE tt.due_time IS NOT NULL
ORDER BY ti.due_date DESC
LIMIT 10;

SELECT '✅ due_time column added and populated from templates' as result;
