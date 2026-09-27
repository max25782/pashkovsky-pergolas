ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS terms_snapshot jsonb;

COMMENT ON COLUMN public.offers.terms_snapshot IS
  'Frozen commercial terms at offer creation (payment %, lead time, warranty table). PDF reads this; not updated on PATCH.';
