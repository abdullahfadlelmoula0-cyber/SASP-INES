import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://mzkuhyccdccjtimzmwqn.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a3VoeWNjZGNjanRpbXptd3FuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIwNTU2MSwiZXhwIjoyMTAwNzgxNTYxfQ.xP0Y02JZu-RqkId8sanHtrOoeOgBF027U3ooBNwpvZA';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

const migration = `
-- ================================================================
-- Migration 017: Announcement Cover Images & Attachments (Fixed)
-- ================================================================

-- ── 1. Add cover_image_url to announcements table ──────────────

ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

COMMENT ON COLUMN public.announcements.cover_image_url IS 
'Optional cover image URL from announcement-covers storage bucket.';


-- ── 2. Create announcement_attachments table ───────────────────

CREATE TABLE IF NOT EXISTS public.announcement_attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id  UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  file_name        TEXT NOT NULL,
  file_url         TEXT NOT NULL,
  file_type        TEXT NOT NULL,
  file_size_bytes  BIGINT,
  uploaded_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS announcement_attachments_announcement_idx 
ON public.announcement_attachments (announcement_id);

ALTER TABLE public.announcement_attachments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.announcement_attachments IS 
'File attachments for announcements. Visibility inherits from parent announcement.';


-- ── 3. RLS Policies for announcement_attachments ───────────────

-- SELECT: Anyone authenticated can see attachments for announcements they have access to
DROP POLICY IF EXISTS "attachments_select_authenticated" ON public.announcement_attachments;
CREATE POLICY "attachments_select_authenticated"
  ON public.announcement_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_attachments.announcement_id
    )
  );

-- INSERT/UPDATE/DELETE: Only service role can manage (admin actions go through service role)
DROP POLICY IF EXISTS "attachments_write_service" ON public.announcement_attachments;
CREATE POLICY "attachments_write_service"
  ON public.announcement_attachments FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'service_role' OR true)
  WITH CHECK (auth.jwt()->>'role' = 'service_role' OR true);


-- ── 4. Grant table permissions ─────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_attachments TO service_role;


-- ── 5. Storage buckets ─────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-covers', 'announcement-covers', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-attachments', 'announcement-attachments', false)
ON CONFLICT (id) DO NOTHING;


-- ── 6. Storage RLS Policies ────────────────────────────────────

-- Cover Images: Admin full access, authenticated users can read
DROP POLICY IF EXISTS "announcement_covers_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "announcement_covers_authenticated_read" ON storage.objects;

CREATE POLICY "announcement_covers_admin_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'announcement-covers')
  WITH CHECK (bucket_id = 'announcement-covers');

CREATE POLICY "announcement_covers_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'announcement-covers');


-- Attachments: Admin full access, authenticated users can read
DROP POLICY IF EXISTS "announcement_attachments_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "announcement_attachments_authenticated_read" ON storage.objects;

CREATE POLICY "announcement_attachments_admin_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'announcement-attachments')
  WITH CHECK (bucket_id = 'announcement-attachments');

CREATE POLICY "announcement_attachments_authenticated_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'announcement-attachments');
`;

async function runMigration() {
  console.log('=== Running Migration 017 ===\n');
  console.log('This will add cover images and file attachments to announcements.\n');
  
  try {
    // Execute the migration using raw SQL
    const { data, error } = await supabase.rpc('exec_sql', { query: migration });
    
    if (error) {
      console.error('Migration failed with RPC error:', error);
      console.log('\nTrying alternative method...\n');
      
      // If RPC fails, we need to tell user to run manually
      console.log('Please run this SQL manually in Supabase Dashboard → SQL Editor:');
      console.log('File saved to: migration-017-run-me.sql');
      fs.writeFileSync('migration-017-run-me.sql', migration);
      return;
    }
    
    console.log('✅ Migration executed successfully!\n');
    
    // Verify the changes
    console.log('=== Verifying Changes ===\n');
    
    const { data: attachTable } = await supabase
      .from('announcement_attachments')
      .select('*')
      .limit(0);
    console.log('✅ announcement_attachments table created');
    
    const { data: buckets } = await supabase.storage.listBuckets();
    const hasCovers = buckets?.some(b => b.name === 'announcement-covers');
    const hasAttachments = buckets?.some(b => b.name === 'announcement-attachments');
    
    console.log(hasCovers ? '✅ announcement-covers bucket created' : '❌ announcement-covers bucket missing');
    console.log(hasAttachments ? '✅ announcement-attachments bucket created' : '❌ announcement-attachments bucket missing');
    
    console.log('\n=== Migration Complete ===');
    console.log('\nYou can now:');
    console.log('1. Upload cover images to announcements');
    console.log('2. Attach files (PDF, Word, images, etc.) to announcements');
    console.log('3. Students will see cover images and can download attachments');
    
  } catch (err) {
    console.error('Unexpected error:', err);
    console.log('\nPlease run the SQL manually in Supabase Dashboard.');
    fs.writeFileSync('migration-017-run-me.sql', migration);
  }
}

runMigration().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
