-- Create personal_bookmarks table for user-specific resource links
CREATE TABLE IF NOT EXISTS public.personal_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'General',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_personal_bookmarks_user_id ON public.personal_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_bookmarks_category ON public.personal_bookmarks(category);
CREATE INDEX IF NOT EXISTS idx_personal_bookmarks_created_at ON public.personal_bookmarks(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.personal_bookmarks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "users_view_own_bookmarks" ON public.personal_bookmarks;
DROP POLICY IF EXISTS "users_insert_own_bookmarks" ON public.personal_bookmarks;
DROP POLICY IF EXISTS "users_update_own_bookmarks" ON public.personal_bookmarks;
DROP POLICY IF EXISTS "users_delete_own_bookmarks" ON public.personal_bookmarks;

-- Users can only view their own bookmarks
CREATE POLICY "users_view_own_bookmarks"
  ON public.personal_bookmarks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can only insert their own bookmarks
CREATE POLICY "users_insert_own_bookmarks"
  ON public.personal_bookmarks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own bookmarks
CREATE POLICY "users_update_own_bookmarks"
  ON public.personal_bookmarks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own bookmarks
CREATE POLICY "users_delete_own_bookmarks"
  ON public.personal_bookmarks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Verify the table was created
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'personal_bookmarks';

-- Verify indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'personal_bookmarks';

-- Verify policies
SELECT policyname, cmd, roles
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'personal_bookmarks';
