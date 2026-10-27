-- Create site_settings table for SuperAdmin customization
CREATE TABLE IF NOT EXISTS public.site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  site_name TEXT NOT NULL DEFAULT 'D.E.N.N.I.S.',
  site_description TEXT NOT NULL DEFAULT 'Digital Ecosystem for Navigation, Notifications, Information, and Schedules',
  logo_url TEXT DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default settings
INSERT INTO public.site_settings (id, site_name, site_description, logo_url)
VALUES (1, 'D.E.N.N.I.S.', 'Digital Ecosystem for Navigation, Notifications, Information, and Schedules', '')
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Only super admins can update site settings" ON public.site_settings;

-- Allow anyone to read site settings (for public display)
CREATE POLICY "Anyone can read site settings"
  ON public.site_settings
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only super admins can update site settings
CREATE POLICY "Only super admins can update site settings"
  ON public.site_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'SUPER_ADMIN'
    )
  );

-- Allow only super admins to insert (in case table is empty)
CREATE POLICY "Only super admins can insert site settings"
  ON public.site_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'SUPER_ADMIN'
    )
  );

-- Verify the table was created
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'site_settings';

-- Verify the policies
SELECT policyname, cmd, roles
FROM pg_policies 
WHERE tablename = 'site_settings';
