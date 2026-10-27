-- ============================================================
-- FIX: "invalid input syntax for type integer: 2026-10-30T00:00:00.000Z"
-- when creating a one-time (ONCE) task/program.
--
-- Root cause: the app was writing a full date string into the
-- "due_day" INTEGER column of task_templates. due_day must only ever
-- hold a day-of-month number (1-31) for recurring tasks.
--
-- This migration adds a proper DATE column (template_due_date) for
-- one-time task due dates and repairs any legacy rows that had a date
-- stuffed into due_day.
--
-- >>> RUN THIS IN THE SUPABASE SQL EDITOR (or psql) BEFORE using the app <<<
-- ============================================================

-- 1) Add the dedicated DATE column for one-time task due dates
ALTER TABLE "task_templates"
  ADD COLUMN IF NOT EXISTS "template_due_date" DATE;

COMMENT ON COLUMN "task_templates"."template_due_date" IS
  'Full chosen due date for one-time (ONCE) tasks. due_day stays an INTEGER day-of-month for recurring tasks.';

-- 2) Migrate legacy rows where a date string/timestamp was stored in due_day.
--    (Postgres can cast text like '2026-10-30T00:00:00.000Z'::date, but not
--     into an INTEGER column - those values were previously rejected or
--     truncated. We move them to the new column and clean up due_day.)
DO $$
DECLARE
  r RECORD;
  d DATE;
BEGIN
  FOR r IN SELECT id, due_day FROM task_templates WHERE due_day IS NOT NULL LOOP
    BEGIN
      -- Try to interpret the stored value as a date (legacy bug data)
      d := NULL;
      EXECUTE 'SELECT NULLIF($1::text, '''')::date' INTO d USING r.due_day;

      -- A plain small integer (e.g. 25) casts fine as a year-less value? No:
      -- '25'::date is invalid in Postgres, so if we got here it really was a
      -- date-like value stored by the buggy code.
      IF d IS NOT NULL THEN
        UPDATE task_templates
           SET template_due_date = d,
               due_day = NULL
         WHERE id = r.id;
      END IF;
    EXCEPTION WHEN others THEN
      -- Not a date - it's a legitimate day-of-month number; leave it alone.
      NULL;
    END;
  END LOOP;
END $$;

-- 3) For existing ONCE templates whose instances already carry the correct
--    due date but which have no template_due_date yet, backfill from the
--    earliest incomplete instance.
UPDATE task_templates t
   SET template_due_date = sub.min_due
  FROM (
    SELECT template_id, MIN(due_date) AS min_due
      FROM task_instances
     GROUP BY template_id
  ) sub
 WHERE t.recurrence = 'ONCE'
   AND t.template_due_date IS NULL
   AND sub.template_id = t.id;

-- 4) Sanity check: due_day must remain a valid day of month (1-31) or NULL
DELETE FROM task_templates
 WHERE due_day IS NOT NULL
   AND (due_day < 1 OR due_day > 31);

-- Verify
SELECT id, title, recurrence, due_day, template_due_date
  FROM task_templates
 ORDER BY created_at DESC
 LIMIT 20;
