-- Add visible column to task_templates table
-- This allows admins to create private tasks that are only visible to assigned users

ALTER TABLE public.task_templates 
ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT true;

-- Update existing tasks to be visible by default
UPDATE public.task_templates 
SET visible = true 
WHERE visible IS NULL;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'task_templates' 
  AND column_name = 'visible';
