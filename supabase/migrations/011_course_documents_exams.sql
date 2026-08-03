-- ============================================================
-- SASP-INES Migration 011 — Course Documents & Exams
-- Run this AFTER 010_structured_course_visibility.sql.
--
-- WHAT THIS ADDS:
--   - documents: files attached to a specific course (lecture notes,
--     syllabus, handbooks, forms, etc.)
--   - exams: files attached to a specific course, categorized by
--     exam_type — "assignment" IS an exam_type here (matches the
--     ExamType union already defined in types/index.ts), so there is
--     deliberately no separate assignments table.
--   - A shared course_visible_to_student() helper so the visibility
--     rule (same one from migration 010's courses_select_student)
--     isn't duplicated three times across courses/documents/exams.
--   - Two private Storage buckets with matching RLS on storage.objects.
--
-- FILE PATH CONVENTION (enforced by the Storage policies below):
--   course-documents/{course_id}/{filename}
--   course-exams/{course_id}/{filename}
--   The {course_id} segment is how the Storage policy knows which
--   course a file belongs to, and therefore who may read it.
-- ============================================================


-- ── 1. Shared visibility helper ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.course_visible_to_student(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = p_course_id
      AND c.is_active = true
      AND (
        (
          c.academic_plan_id IS NULL
          AND public.matches_academic_profile(c.department, c.program, c.year_of_study, c.academic_year)
        )
        OR
        (
          c.academic_plan_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.academic_plan_id = c.academic_plan_id
              AND p.year_of_study = c.year_number
              AND (c.specialization_id IS NULL OR c.specialization_id = p.specialization_id)
          )
        )
      )
  );
$$;

COMMENT ON FUNCTION public.course_visible_to_student IS
  'True if the CURRENT authenticated user (auth.uid()) can see the '
  'given course as a student — same rule as courses_select_student '
  '(migration 010). Reused by documents/exams RLS so the rule lives '
  'in exactly one place.';


-- ── 2. Documents table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       UUID        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  description     TEXT,
  category        TEXT        NOT NULL DEFAULT 'other'
                              CHECK (category IN ('lecture_notes','syllabus','handbook','form','other')),
  file_url        TEXT        NOT NULL,
  file_name       TEXT        NOT NULL,
  file_size_bytes BIGINT,
  uploaded_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_course_idx ON public.documents (course_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_select_admin"   ON public.documents;
DROP POLICY IF EXISTS "documents_select_student" ON public.documents;
DROP POLICY IF EXISTS "documents_write_admin"    ON public.documents;

CREATE POLICY "documents_select_admin"
  ON public.documents FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "documents_select_student"
  ON public.documents FOR SELECT TO authenticated
  USING (NOT public.is_admin() AND public.course_visible_to_student(course_id));

CREATE POLICY "documents_write_admin"
  ON public.documents FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ── 3. Exams table (covers "previous exams" AND "assignments") ────
CREATE TABLE IF NOT EXISTS public.exams (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       UUID        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  exam_type       TEXT        NOT NULL
                              CHECK (exam_type IN ('midterm','final','quiz','assignment')),
  academic_year   TEXT        NOT NULL,
  file_url        TEXT        NOT NULL,
  file_name       TEXT        NOT NULL,
  file_size_bytes BIGINT,
  uploaded_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS exams_course_idx ON public.exams (course_id);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exams_select_admin"   ON public.exams;
DROP POLICY IF EXISTS "exams_select_student" ON public.exams;
DROP POLICY IF EXISTS "exams_write_admin"    ON public.exams;

CREATE POLICY "exams_select_admin"
  ON public.exams FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "exams_select_student"
  ON public.exams FOR SELECT TO authenticated
  USING (NOT public.is_admin() AND public.course_visible_to_student(course_id));

CREATE POLICY "exams_write_admin"
  ON public.exams FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ── 4. Table-level grants (RLS alone is not enough — see 004) ─────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams      TO authenticated;


-- ── 5. Storage buckets ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-documents', 'course-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('course-exams', 'course-exams', false)
ON CONFLICT (id) DO NOTHING;


-- ── 6. Storage RLS ─────────────────────────────────────────────────
-- Path convention: {course_id}/{filename} — the first path segment
-- IS the course_id, which is how these policies decide visibility.

DROP POLICY IF EXISTS "course_documents_admin_all"     ON storage.objects;
DROP POLICY IF EXISTS "course_documents_select_student" ON storage.objects;
DROP POLICY IF EXISTS "course_exams_admin_all"          ON storage.objects;
DROP POLICY IF EXISTS "course_exams_select_student"     ON storage.objects;

CREATE POLICY "course_documents_admin_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'course-documents' AND public.is_admin())
  WITH CHECK (bucket_id = 'course-documents' AND public.is_admin());

CREATE POLICY "course_documents_select_student"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-documents'
    AND NOT public.is_admin()
    AND public.course_visible_to_student((split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "course_exams_admin_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'course-exams' AND public.is_admin())
  WITH CHECK (bucket_id = 'course-exams' AND public.is_admin());

CREATE POLICY "course_exams_select_student"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-exams'
    AND NOT public.is_admin()
    AND public.course_visible_to_student((split_part(name, '/', 1))::uuid)
  );


-- ============================================================
-- NEXT STEPS (frontend, not covered by this migration)
-- ============================================================
--   1. In the course edit modal (or a new "Manage Materials" tab),
--      let the admin upload a file to
--      course-documents/{course.id}/{filename} or
--      course-exams/{course.id}/{filename}, then INSERT a matching
--      row into public.documents / public.exams with the returned
--      file_url.
--   2. On the student course-details page, fetch and list rows from
--      documents/exams filtered by course_id — RLS already ensures
--      they only ever see rows for courses they're allowed to see.
-- ============================================================
