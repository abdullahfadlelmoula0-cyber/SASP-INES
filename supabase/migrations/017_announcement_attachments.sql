-- ================================================================
-- Migration 017: Announcement Cover Images & Attachments
-- ================================================================
-- Adds support for:
-- - Cover images (one per announcement)
-- - Multiple file attachments per announcement
-- - Private storage buckets with RLS matching parent announcement visibility
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
  file_type        TEXT NOT NULL,      -- MIME type, e.g. "application/pdf"
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

-- SELECT: Match parent announcement visibility exactly
-- Reuse the same logic as announcements_select_admin and announcements_select_student
CREATE POLICY "attachments_select_matches_parent"
  ON public.announcement_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_attachments.announcement_id
      AND (
        -- Admin can see all
        public.is_admin()
        OR
        -- Student can see if announcement is visible to them
        (
          -- Must not be expired (NULL = never expires)
          (a.expires_at IS NULL OR a.expires_at > now())
          AND
          -- Must match academic profile (NULL = global, no restriction)
          (
            -- Global announcement (all fields NULL)
            (a.department IS NULL AND a.program IS NULL AND a.year_of_study IS NULL AND a.academic_year IS NULL)
            OR
            -- Matches student's profile using the helper function
            public.matches_academic_profile(
              (SELECT department FROM public.profiles WHERE id = auth.uid()),
              (SELECT program FROM public.profiles WHERE id = auth.uid()),
              (SELECT year_of_study FROM public.profiles WHERE id = auth.uid()),
              (SELECT academic_year FROM public.profiles WHERE id = auth.uid()),
              a.department,
              a.program,
              a.year_of_study,
              a.academic_year
            )
          )
        )
      )
    )
  );

-- INSERT/UPDATE/DELETE: Only admins can manage attachments
CREATE POLICY "attachments_write_admin"
  ON public.announcement_attachments FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── 4. Grant table permissions ─────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_attachments TO authenticated;


-- ── 5. Storage buckets ─────────────────────────────────────────

-- Cover images bucket (one image per announcement)
-- Path: {announcement_id}/{filename}
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-covers', 'announcement-covers', false)
ON CONFLICT (id) DO NOTHING;

-- Attachments bucket (multiple files per announcement)
-- Path: {announcement_id}/{filename}
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-attachments', 'announcement-attachments', false)
ON CONFLICT (id) DO NOTHING;


-- ── 6. Storage RLS Policies ────────────────────────────────────

-- Helper function to check if user can see an announcement
-- (reuses the exact same logic as the table policies above)
CREATE OR REPLACE FUNCTION public.announcement_visible_to_user(p_announcement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = p_announcement_id
    AND (
      -- Admin can see all
      public.is_admin()
      OR
      -- Student can see if announcement is visible to them
      (
        -- Must not be expired (NULL = never expires)
        (a.expires_at IS NULL OR a.expires_at > now())
        AND
        -- Must match academic profile (NULL = global, no restriction)
        (
          -- Global announcement (all fields NULL)
          (a.department IS NULL AND a.program IS NULL AND a.year_of_study IS NULL AND a.academic_year IS NULL)
          OR
          -- Matches student's profile
          public.matches_academic_profile(
            (SELECT department FROM public.profiles WHERE id = auth.uid()),
            (SELECT program FROM public.profiles WHERE id = auth.uid()),
            (SELECT year_of_study FROM public.profiles WHERE id = auth.uid()),
            (SELECT academic_year FROM public.profiles WHERE id = auth.uid()),
            a.department,
            a.program,
            a.year_of_study,
            a.academic_year
          )
        )
      )
    )
  );
$$;

COMMENT ON FUNCTION public.announcement_visible_to_user IS
  'True if the CURRENT authenticated user (auth.uid()) can see the given announcement. '
  'Reused by storage policies for announcement-covers and announcement-attachments.';


-- ── Cover Images Storage Policies ──────────────────────────────

DROP POLICY IF EXISTS "announcement_covers_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "announcement_covers_select_user" ON storage.objects;

-- Admin: Full access
CREATE POLICY "announcement_covers_admin_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'announcement-covers' AND public.is_admin())
  WITH CHECK (bucket_id = 'announcement-covers' AND public.is_admin());

-- Users: Read access if they can see the parent announcement
-- Path format: {announcement_id}/{filename}
CREATE POLICY "announcement_covers_select_user"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'announcement-covers'
    AND public.announcement_visible_to_user((split_part(name, '/', 1))::uuid)
  );


-- ── Attachments Storage Policies ───────────────────────────────

DROP POLICY IF EXISTS "announcement_attachments_admin_all" ON storage.objects;
DROP POLICY IF EXISTS "announcement_attachments_select_user" ON storage.objects;

-- Admin: Full access
CREATE POLICY "announcement_attachments_admin_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'announcement-attachments' AND public.is_admin())
  WITH CHECK (bucket_id = 'announcement-attachments' AND public.is_admin());

-- Users: Read access if they can see the parent announcement
-- Path format: {announcement_id}/{filename}
CREATE POLICY "announcement_attachments_select_user"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'announcement-attachments'
    AND public.announcement_visible_to_user((split_part(name, '/', 1))::uuid)
  );


-- ================================================================
-- VERIFICATION QUERIES (run these to confirm)
-- ================================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='announcements' ORDER BY ordinal_position;
--
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='announcement_attachments' ORDER BY ordinal_position;
--
-- SELECT policyname, cmd, qual FROM pg_policies
-- WHERE schemaname='public' AND tablename='announcement_attachments';
-- ================================================================
