-- Grant admin role to specific NTPA users by email.
-- 1) Backfill existing profiles.
UPDATE public.profiles
SET role = 'admin'
WHERE lower(email) IN ('gmcknight@ntpa.org', 'aevans@ntpa.org');

-- 2) Ensure future signups for these emails are auto-promoted to admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1), 'User'),
    CASE
      WHEN lower(COALESCE(NEW.email, '')) IN ('gmcknight@ntpa.org', 'aevans@ntpa.org') THEN 'admin'
      ELSE 'student'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
