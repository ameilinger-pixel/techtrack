-- Phase 1 ops hardening
-- Adds immutable activity event stream for audit and operational troubleshooting.

CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TRIGGER activity_events_updated_at
  BEFORE UPDATE ON public.activity_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS activity_events_created_at_idx
  ON public.activity_events (created_at DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_events_auth_all ON public.activity_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
