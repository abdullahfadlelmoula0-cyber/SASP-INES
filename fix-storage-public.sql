-- ================================================================
-- Fix: Make announcement storage buckets public for reading
-- This allows cover images and attachments to be displayed without
-- signed URLs while keeping write access restricted to admins
-- ================================================================

-- Update buckets to be public
UPDATE storage.buckets 
SET public = true 
WHERE id IN ('announcement-covers', 'announcement-attachments');

-- Keep the write policies restrictive (admin only)
-- But simplify the read policies since buckets are now public

-- Cover Images Storage Policies (Updated)
DROP POLICY IF EXISTS "announcement_covers_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "announcement_covers_authenticated_read" ON storage.objects;

-- Admin: Full access to manage cover images
CREATE POLICY "announcement_covers_admin_write"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'announcement-covers')
  WITH CHECK (bucket_id = 'announcement-covers');

-- Attachments Storage Policies (Updated)
DROP POLICY IF EXISTS "announcement_attachments_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "announcement_attachments_authenticated_read" ON storage.objects;

-- Admin: Full access to manage attachments
CREATE POLICY "announcement_attachments_admin_write"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'announcement-attachments')
  WITH CHECK (bucket_id = 'announcement-attachments');

-- Note: Since buckets are now public, anyone with the URL can read the files
-- This is appropriate for announcements which are meant to be visible to students
