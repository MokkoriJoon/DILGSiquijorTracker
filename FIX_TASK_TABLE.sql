-- Add resource_link column to task_templates table
-- Run this in Supabase SQL Editor if you haven't already

ALTER TABLE public.task_templates 
ADD COLUMN IF NOT EXISTS resource_link TEXT;

-- Also ensure created_by can be null (in case of issues)
ALTER TABLE public.task_templates 
ALTER COLUMN created_by DROP NOT NULL;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'task_templates' 
ORDER BY ordinal_position;
