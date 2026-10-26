-- Daily Recurrence Feature Migration
-- Run this in Supabase SQL Editor

-- Add columns for daily recurrence (if not already added)
ALTER TABLE task_templates 
ADD COLUMN IF NOT EXISTS due_days_of_week TEXT[],
ADD COLUMN IF NOT EXISTS due_time TIME;

-- Add due_time column to task_instances for tracking specific times
ALTER TABLE task_instances 
ADD COLUMN IF NOT EXISTS due_time TIME;

-- Create task_assignments table if it doesn't exist
-- This tracks which users are assigned to which templates
CREATE TABLE IF NOT EXISTS task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES task_templates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(template_id, user_id)
);

-- Enable RLS for task_assignments
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for task_assignments
DROP POLICY IF EXISTS "task_assignments_select_all" ON task_assignments;
DROP POLICY IF EXISTS "task_assignments_insert_all" ON task_assignments;
DROP POLICY IF EXISTS "task_assignments_delete_all" ON task_assignments;

CREATE POLICY "task_assignments_select_all" ON task_assignments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "task_assignments_insert_all" ON task_assignments
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "task_assignments_delete_all" ON task_assignments
  FOR DELETE TO authenticated
  USING (true);

-- Create function to get day of week from date
CREATE OR REPLACE FUNCTION get_day_of_week(date_val DATE)
RETURNS TEXT AS $$
DECLARE
  day_name TEXT;
BEGIN
  SELECT CASE EXTRACT(DOW FROM date_val)
    WHEN 0 THEN 'SUNDAY'
    WHEN 1 THEN 'MONDAY'
    WHEN 2 THEN 'TUESDAY'
    WHEN 3 THEN 'WEDNESDAY'
    WHEN 4 THEN 'THURSDAY'
    WHEN 5 THEN 'FRIDAY'
    WHEN 6 THEN 'SATURDAY'
  END INTO day_name;
  
  RETURN day_name;
END;
$$ LANGUAGE plpgsql;

-- Verify the migration
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'task_templates' 
  AND column_name IN ('due_days_of_week', 'due_time');

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'task_instances' 
  AND column_name = 'due_time';

SELECT COUNT(*) as assignment_count FROM task_assignments;
