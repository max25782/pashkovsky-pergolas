-- Extend work_type to include gates, facade
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_work_type_check;
ALTER TABLE public.deals ADD CONSTRAINT deals_work_type_check
  CHECK (work_type IN ('pergola', 'railings', 'gates', 'facade', 'other'));
