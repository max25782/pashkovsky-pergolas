-- This script migrates existing "won" leads to deals table
-- Run this AFTER creating the deals table

-- Migrate all existing leads with status 'won' to deals table
INSERT INTO deals (
  lead_id,
  customer_name,
  customer_phone,
  customer_email,
  customer_city,
  source,
  deal_status,
  notes,
  created_at
)
SELECT 
  id as lead_id,
  name as customer_name,
  phone as customer_phone,
  CASE 
    WHEN notes LIKE '%Email:%' THEN 
      TRIM(SUBSTRING(notes FROM 'Email:\s*([^\n]+)'))
    ELSE NULL
  END as customer_email,
  CASE 
    WHEN notes LIKE '%Email:%' THEN 
      NULL
    ELSE 
      TRIM(SPLIT_PART(notes, E'\n', 1))
  END as customer_city,
  COALESCE(source, 'website') as source,
  'in_progress' as deal_status,
  'Migrated from won lead' || E'\n' || COALESCE(notes, '') as notes,
  created_at
FROM leads
WHERE status = 'won'
  AND id NOT IN (SELECT lead_id FROM deals WHERE lead_id IS NOT NULL);

-- Show how many deals were created
SELECT COUNT(*) as migrated_deals_count FROM deals WHERE notes LIKE 'Migrated from won lead%';



