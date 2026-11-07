-- Run once with the database owner on the selected FalconEye Supabase project.
-- No application data is deleted. Re-running is safe for this initial schema.
BEGIN;

CREATE TABLE IF NOT EXISTS public.falcon_interest (
  id serial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  channel text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.falcon_visits (
  id serial PRIMARY KEY,
  channel text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now()
);

-- No public Data API policies: browser clients must use the registration API.
-- The server connects as the database owner; no secret database key goes to the UI.
ALTER TABLE public.falcon_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.falcon_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.falcon_interest, public.falcon_visits FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.falcon_interest_id_seq, public.falcon_visits_id_seq FROM PUBLIC;

-- These roles exist on Supabase but may not exist in a local PostgreSQL database.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.falcon_interest, public.falcon_visits FROM anon;
    REVOKE ALL ON SEQUENCE public.falcon_interest_id_seq, public.falcon_visits_id_seq FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.falcon_interest, public.falcon_visits FROM authenticated;
    REVOKE ALL ON SEQUENCE public.falcon_interest_id_seq, public.falcon_visits_id_seq FROM authenticated;
  END IF;
END $$;

COMMIT;
