-- Add resource_link column to task_templates table
-- This allows admins to add a link (e.g., Google Drive) where task outputs are stored

ALTER TABLE public.task_templates 
ADD COLUMN IF NOT EXISTS resource_link TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'task_templates' 
  AND column_name = 'resource_link';
