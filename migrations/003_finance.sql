BEGIN;

CREATE TABLE IF NOT EXISTS public.falcon_finance_documents (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  document jsonb NOT NULL
    CHECK (jsonb_typeof(document) = 'object')
    CHECK (document ->> 'schemaVersion' = '1')
    CHECK (document ->> 'isSample' = 'false')
    CHECK (jsonb_typeof(document -> 'records') = 'array')
    CHECK (jsonb_typeof(document -> 'activities') = 'array')
    CHECK (octet_length(document::text) <= 524288),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.falcon_finance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.falcon_finance_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS falcon_finance_documents_owner ON public.falcon_finance_documents;
CREATE POLICY falcon_finance_documents_owner
  ON public.falcon_finance_documents
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON TABLE public.falcon_finance_documents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.falcon_finance_documents TO authenticated;

COMMIT;
