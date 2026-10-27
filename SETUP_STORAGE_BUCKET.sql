-- Create site-assets storage bucket for logo uploads
-- Run this in Supabase SQL Editor

-- Enable storage if not already enabled
-- Note: This must be done via Supabase Dashboard → Storage → New Bucket

-- Storage bucket setup instructions:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "New bucket"
-- 3. Name: site-assets
-- 4. Check "Public bucket"
-- 5. Max file size: 2097152 (2MB)
-- 6. Allowed MIME types: image/png, image/jpeg, image/jpg, image/webp, image/svg+xml

-- RLS Policies for site-assets bucket
-- These policies allow authenticated users to upload and anyone to read

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads to site-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'site-assets');

-- Policy: Allow anyone to read files (public bucket)
CREATE POLICY "Allow public read access to site-assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'site-assets');

-- Policy: Allow authenticated users to update their files
CREATE POLICY "Allow authenticated updates to site-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'site-assets');

-- Policy: Allow authenticated users to delete their files
CREATE POLICY "Allow authenticated deletes from site-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'site-assets');

-- Verify policies
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%site-assets%';
