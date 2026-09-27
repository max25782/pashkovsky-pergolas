-- =============================================================================
-- Back-fill: assign lead_owner_id to all leads that have no owner yet.
-- Runs AFTER migration 052. Safe to re-run (only touches NULL rows).
--
-- Strategy: for each company, find the user with role 'owner' in
-- company_members; if no owner exists, fall back to the oldest 'admin'.
-- =============================================================================

WITH company_owners AS (
  SELECT DISTINCT ON (company_id)
    company_id,
    user_id
  FROM public.company_members
  WHERE role IN ('owner', 'admin')
  ORDER BY
    company_id,
    CASE role WHEN 'owner' THEN 0 ELSE 1 END,  -- owner preferred
    created_at ASC                              -- oldest first as tiebreak
)
UPDATE public.leads l
SET    lead_owner_id = co.user_id
FROM   company_owners co
WHERE  co.company_id = l.company_id
  AND  l.lead_owner_id IS NULL;

-- Verify
SELECT
  COUNT(*) FILTER (WHERE lead_owner_id IS NULL) AS still_null,
  COUNT(*) FILTER (WHERE lead_owner_id IS NOT NULL) AS assigned
FROM public.leads;
