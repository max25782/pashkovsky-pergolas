-- Deal Templates & Contractor support
-- Adds customer_type, pricing_model, contractor_payment_profile to deals

-- A) Add customer_type
ALTER TABLE public.deals 
  ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'private'
  CHECK (customer_type IN ('private', 'contractor'));

-- B) Add pricing_model
ALTER TABLE public.deals 
  ADD COLUMN IF NOT EXISTS pricing_model TEXT NOT NULL DEFAULT 'fixed'
  CHECK (pricing_model IN ('fixed', 'per_meter', 'per_sqm', 'custom'));

-- C) Add contractor_payment_profile (JSONB for stage percentages / notes)
ALTER TABLE public.deals 
  ADD COLUMN IF NOT EXISTS contractor_payment_profile JSONB NULL;

-- D) Add optional columns to deal_railings_details (railing_type, material)
ALTER TABLE public.deal_railings_details 
  ADD COLUMN IF NOT EXISTS railing_type TEXT NULL;

ALTER TABLE public.deal_railings_details 
  ADD COLUMN IF NOT EXISTS material TEXT NULL;
