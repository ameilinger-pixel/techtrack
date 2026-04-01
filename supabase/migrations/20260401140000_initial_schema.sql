-- TechTrack / Base44 migration — Supabase schema
-- Run via Supabase CLI or paste into SQL Editor

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Profiles (replaces Base44 User + app role)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student', 'director')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_email_idx ON public.profiles (lower(email));
CREATE INDEX profiles_role_idx ON public.profiles (role);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Generic entity pattern: body jsonb + generated columns for filters/sorts
CREATE TABLE public.shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  director_email text GENERATED ALWAYS AS (NULLIF(body->>'director_email', '')) STORED,
  director_name text GENERATED ALWAYS AS (NULLIF(body->>'director_name', '')) STORED,
  title text GENERATED ALWAYS AS (NULLIF(body->>'title', '')) STORED
);

CREATE TRIGGER shows_updated_at BEFORE UPDATE ON public.shows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX shows_director_email_idx ON public.shows (lower(director_email));
CREATE INDEX shows_updated_at_idx ON public.shows (updated_at DESC);

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  full_name text GENERATED ALWAYS AS (NULLIF(body->>'full_name', '')) STORED,
  email text GENERATED ALWAYS AS (NULLIF(body->>'email', '')) STORED
);

CREATE TRIGGER students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX students_full_name_idx ON public.students (lower(full_name));
CREATE INDEX students_updated_at_idx ON public.students (updated_at DESC);

CREATE TABLE public.tech_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  director_email text GENERATED ALWAYS AS (NULLIF(body->>'director_email', '')) STORED,
  status text GENERATED ALWAYS AS (NULLIF(body->>'status', '')) STORED,
  show_title text GENERATED ALWAYS AS (NULLIF(body->>'show_title', '')) STORED
);

CREATE TRIGGER tech_assignments_updated_at BEFORE UPDATE ON public.tech_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX tech_assignments_director_email_idx ON public.tech_assignments (lower(director_email));
CREATE INDEX tech_assignments_updated_at_idx ON public.tech_assignments (updated_at DESC);
CREATE INDEX tech_assignments_status_idx ON public.tech_assignments (status);

CREATE TABLE public.tech_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TRIGGER tech_applications_updated_at BEFORE UPDATE ON public.tech_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX tech_applications_updated_at_idx ON public.tech_applications (updated_at DESC);

CREATE TABLE public.directors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  email text GENERATED ALWAYS AS (NULLIF(body->>'email', '')) STORED
);

CREATE TRIGGER directors_updated_at BEFORE UPDATE ON public.directors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX directors_email_idx ON public.directors (lower(email));

CREATE TABLE public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean GENERATED ALWAYS AS (
    CASE
      WHEN jsonb_typeof(body->'active') = 'boolean' THEN (body->>'active')::boolean
      ELSE true
    END
  ) STORED
);

CREATE TRIGGER equipment_updated_at BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX equipment_active_idx ON public.equipment (active);

CREATE TABLE public.equipment_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TRIGGER equipment_reservations_updated_at BEFORE UPDATE ON public.equipment_reservations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TRIGGER resources_updated_at BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TRIGGER email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.pending_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TRIGGER pending_emails_updated_at BEFORE UPDATE ON public.pending_emails FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX pending_emails_created_at_idx ON public.pending_emails (created_at DESC);

CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TRIGGER badges_updated_at BEFORE UPDATE ON public.badges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.badge_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TRIGGER badge_enrollments_updated_at BEFORE UPDATE ON public.badge_enrollments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TRIGGER trainings_updated_at BEFORE UPDATE ON public.trainings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.training_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TRIGGER training_enrollments_updated_at BEFORE UPDATE ON public.training_enrollments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auth: create profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1), 'User'),
    'student'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_enrollments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

-- Profiles: read (authenticated + anon admin emails for legacy notify flow)
CREATE POLICY profiles_select_auth ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY profiles_select_anon_admin ON public.profiles
  FOR SELECT TO anon USING (role = 'admin');

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      id = auth.uid()
      AND role = (SELECT p2.role FROM public.profiles p2 WHERE p2.id = auth.uid())
    )
  );

CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- Entity tables: full access for any logged-in user (internal tool; tighten later)
CREATE POLICY shows_auth_all ON public.shows FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY students_auth_all ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY directors_auth_all ON public.directors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY equipment_auth_all ON public.equipment FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY equipment_reservations_auth_all ON public.equipment_reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY resources_auth_all ON public.resources FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY email_templates_auth_all ON public.email_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pending_emails_auth_all ON public.pending_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY badges_auth_all ON public.badges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY badge_enrollments_auth_all ON public.badge_enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY trainings_auth_all ON public.trainings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY training_enrollments_auth_all ON public.training_enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tech assignments: public read for /apply flow; authenticated full CRUD
CREATE POLICY tech_assignments_anon_select ON public.tech_assignments
  FOR SELECT TO anon USING (true);

CREATE POLICY tech_assignments_auth_all ON public.tech_assignments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Applications: public insert (apply form); authenticated manage
CREATE POLICY tech_applications_anon_insert ON public.tech_applications
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY tech_applications_auth_all ON public.tech_applications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for uploads (create bucket in dashboard or SQL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY uploads_select_public ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'uploads');

CREATE POLICY uploads_insert_auth ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'uploads');

CREATE POLICY uploads_update_auth ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'uploads') WITH CHECK (bucket_id = 'uploads');

CREATE POLICY uploads_delete_auth ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'uploads');
