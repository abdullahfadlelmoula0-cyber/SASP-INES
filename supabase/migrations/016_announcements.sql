-- ================================================================
-- Migration 016: Announcements Table
-- ================================================================
-- Creates the announcements table with:
-- - Partial academic targeting (nullable fields)
-- - Priority levels and pinning
-- - Expiration control (forever, 1 week, 1 month, custom)
-- - Row Level Security for admin CRUD and student read access
-- ================================================================

-- ── 1. Create announcements table ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
  body TEXT NOT NULL CHECK (char_length(body) >= 10),
  
  -- Priority and visibility
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  
  -- Expiration control
  -- NULL = display forever
  -- Set to future timestamp for timed expiration
  expires_at TIMESTAMPTZ,
  
  -- Academic targeting (nullable = global)
  -- NULL on any dimension means "no restriction"
  department TEXT,
  program TEXT,
  year_of_study SMALLINT CHECK (year_of_study >= 1 AND year_of_study <= 10),
  academic_year TEXT,
  
  -- Author tracking
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Indexes for performance ─────────────────────────────────

-- Filter by expiration and priority
CREATE INDEX idx_announcements_expires_at ON public.announcements(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_announcements_priority ON public.announcements(priority);
CREATE INDEX idx_announcements_is_pinned ON public.announcements(is_pinned) WHERE is_pinned = true;

-- Academic targeting indexes
CREATE INDEX idx_announcements_department ON public.announcements(department) WHERE department IS NOT NULL;
CREATE INDEX idx_announcements_program ON public.announcements(program) WHERE program IS NOT NULL;
CREATE INDEX idx_announcements_year ON public.announcements(year_of_study) WHERE year_of_study IS NOT NULL;
CREATE INDEX idx_announcements_academic_year ON public.announcements(academic_year) WHERE academic_year IS NOT NULL;

-- Sort by creation date
CREATE INDEX idx_announcements_created_at ON public.announcements(created_at DESC);

-- ── 3. Enable Row Level Security ───────────────────────────────

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS Policies ────────────────────────────────────────────

-- Admin: Full CRUD access
CREATE POLICY announcements_select_admin
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY announcements_insert_admin
  ON public.announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY announcements_update_admin
  ON public.announcements
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY announcements_delete_admin
  ON public.announcements
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Students: Read access to non-expired, academically-targeted announcements
CREATE POLICY announcements_select_student
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    -- Must not be expired (NULL = never expires)
    (expires_at IS NULL OR expires_at > now())
    AND
    -- Must match academic profile (NULL = global, no restriction)
    (
      -- Global announcement (all fields NULL)
      (department IS NULL AND program IS NULL AND year_of_study IS NULL AND academic_year IS NULL)
      OR
      -- Matches student's profile using the helper function
      matches_academic_profile(
        (SELECT department FROM public.profiles WHERE id = auth.uid()),
        (SELECT program FROM public.profiles WHERE id = auth.uid()),
        (SELECT year_of_study FROM public.profiles WHERE id = auth.uid()),
        (SELECT academic_year FROM public.profiles WHERE id = auth.uid()),
        department,
        program,
        year_of_study,
        academic_year
      )
    )
  );

-- ── 5. Trigger for updated_at ──────────────────────────────────

CREATE TRIGGER set_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- ── 6. Grant permissions ───────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT ON public.announcements TO anon;

-- ── 7. Comments ────────────────────────────────────────────────

COMMENT ON TABLE public.announcements IS 
'Platform-wide announcements with optional academic targeting. NULL targeting fields = global visibility.';

COMMENT ON COLUMN public.announcements.expires_at IS 
'Optional expiration timestamp. NULL = display forever. Set to future date for timed visibility.';

COMMENT ON COLUMN public.announcements.department IS 
'Optional department filter. NULL = visible to all departments.';

COMMENT ON COLUMN public.announcements.is_pinned IS 
'Pinned announcements appear at the top of the feed.';
