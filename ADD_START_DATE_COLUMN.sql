-- Add start_date column to task_templates table
-- This allows daily recurrence tasks to have a specific start date

ALTER TABLE public.task_templates 
ADD COLUMN IF NOT EXISTS start_date DATE;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'task_templates' 
  AND column_name = 'start_date';
