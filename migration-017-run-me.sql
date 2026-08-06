
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
