-- Add AI Director (Bedrock) feature to Pro and Enterprise plans
-- This makes AI Director a premium feature

UPDATE public.subscription_plans
SET 
  features = CASE 
    WHEN features::text LIKE '%AI Director%' THEN features
    ELSE features || '["AI Director (Bedrock)"]'::jsonb
  END
WHERE plan_key IN ('pro', 'enterprise');

-- Verify update
SELECT 
  plan_key,
  display_name->>'ru' as plan_name_ru,
  features
FROM public.subscription_plans
WHERE plan_key IN ('pro', 'enterprise');

