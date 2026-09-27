-- Per-company sequential offer numbers (e.g. 2026-0001)

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS offer_number text;

CREATE UNIQUE INDEX IF NOT EXISTS offers_company_offer_number_unique
  ON public.offers (company_id, offer_number)
  WHERE offer_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.offer_number_counters (
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  year integer NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, year)
);

CREATE OR REPLACE FUNCTION public.allocate_offer_number(p_company_id uuid, p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq integer;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company_id) THEN
    RAISE EXCEPTION 'unknown company_id %', p_company_id;
  END IF;

  INSERT INTO public.offer_number_counters (company_id, year, last_value)
  VALUES (p_company_id, p_year, 1)
  ON CONFLICT (company_id, year)
  DO UPDATE SET last_value = public.offer_number_counters.last_value + 1
  RETURNING last_value INTO v_seq;

  RETURN p_year::text || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- SECURITY DEFINER: no membership check inside the function — only that company_id exists.
-- Safe only while EXECUTE is granted exclusively to service_role (API passes company_id from auth).
-- Granting EXECUTE to authenticated would let any user allocate numbers for arbitrary company_ids.
REVOKE ALL ON FUNCTION public.allocate_offer_number(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_offer_number(uuid, integer) TO service_role;
