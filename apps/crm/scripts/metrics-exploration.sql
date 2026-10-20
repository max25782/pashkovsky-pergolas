-- language: pgsql
-- =============================================================================
-- Process-duration metrics — exploration only (SELECT). PostgreSQL / Supabase.
-- Unqualified table names (leads, not schema.leads). Do not run against
-- production from an agent session.
-- Bind :company_id and :n_days before executing.
--
-- What exists:
--   leads.created_at                 — lead created
--   leads.status                     — current kanban column only (no history)
--   leads.last_message_at            — last inbound/message stamp if ever written
--   lead_touches.touched_at          — dated actions (call/message/visit/note)
--   deals.lead_id + offers.deal_id   — link lead → offer (deal_id is text)
--   offers.created_at / updated_at   — draft created / last overwrite
--   offers.pdf_created_at            — last PDF generate (not send)
--   offers.approved_at               — client signed (after send, if they sign)
--
-- What does not exist:
--   sent_at, first_opened_at, status_changed_at, offer version/edit count
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Time from lead created → first recorded action
--    Action = earliest lead_touches.touched_at.
--    last_message_at is a weaker leftover field (creation paths do not set it).
-- -----------------------------------------------------------------------------
SELECT
  l.company_id,
  l.id AS lead_id,
  l.created_at,
  MIN(t.touched_at) AS first_touch_at,
  EXTRACT(EPOCH FROM MIN(t.touched_at) - l.created_at) / 3600.0 AS hours_to_first_touch
FROM leads l
JOIN lead_touches t ON t.lead_id = l.id
WHERE l.company_id = :company_id
GROUP BY l.company_id, l.id, l.created_at;

-- Company-level distribution (hours)
WITH first_touch AS (
  SELECT lead_id, MIN(touched_at) AS first_touch_at
  FROM lead_touches
  GROUP BY lead_id
)
SELECT
  percentile_cont(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM first_touch.first_touch_at - l.created_at) / 3600.0
  ) AS p50_hours,
  percentile_cont(0.9) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM first_touch.first_touch_at - l.created_at) / 3600.0
  ) AS p90_hours,
  COUNT(*) AS leads_with_a_touch,
  (SELECT COUNT(*) FROM leads WHERE company_id = :company_id) AS leads_total
FROM leads l
JOIN first_touch ON first_touch.lead_id = l.id
WHERE l.company_id = :company_id;

-- Weak proxy used by lib/analytics/aggregators.ts (NOT first action; last stamp only)
SELECT
  l.id AS lead_id,
  l.created_at,
  l.last_message_at,
  EXTRACT(EPOCH FROM l.last_message_at - l.created_at) / 3600.0 AS hours_created_to_last_message
FROM leads l
WHERE l.company_id = :company_id
  AND l.last_message_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Time from lead created → first offer draft (NOT send)
--    True "sent offer" cannot be computed — no sent_at.
--    This is create-lead → first linked offer.created_at.
--    Join: leads.id = deals.lead_id AND offers.deal_id = deals.id::text
--    Offers from quick_offer often have deals with lead_id IS NULL — they
--    will not appear here.
-- -----------------------------------------------------------------------------
SELECT
  l.id AS lead_id,
  l.created_at AS lead_created_at,
  MIN(o.created_at) AS first_offer_created_at,
  EXTRACT(EPOCH FROM MIN(o.created_at) - l.created_at) / 3600.0 AS hours_lead_to_first_offer
FROM leads l
JOIN deals d ON d.lead_id = l.id
JOIN offers o ON o.deal_id = d.id::text
WHERE l.company_id = :company_id
GROUP BY l.id, l.created_at;

-- Same metric using first PDF generate as a "ready to send" proxy
SELECT
  l.id AS lead_id,
  l.created_at AS lead_created_at,
  MIN(o.pdf_created_at) AS first_pdf_at,
  EXTRACT(EPOCH FROM MIN(o.pdf_created_at) - l.created_at) / 3600.0 AS hours_lead_to_first_pdf
FROM leads l
JOIN deals d ON d.lead_id = l.id
JOIN offers o ON o.deal_id = d.id::text
WHERE l.company_id = :company_id
  AND o.pdf_created_at IS NOT NULL
GROUP BY l.id, l.created_at;

-- Same metric using client signature (happens after a send, if they sign)
SELECT
  l.id AS lead_id,
  l.created_at AS lead_created_at,
  MIN(o.approved_at) AS first_approved_at,
  EXTRACT(EPOCH FROM MIN(o.approved_at) - l.created_at) / 3600.0 AS hours_lead_to_first_approval
FROM leads l
JOIN deals d ON d.lead_id = l.id
JOIN offers o ON o.deal_id = d.id::text
WHERE l.company_id = :company_id
  AND o.approved_at IS NOT NULL
GROUP BY l.id, l.created_at;

-- -----------------------------------------------------------------------------
-- 3. Time from offer created → "sent"
--    No sent_at. Proxies only.
-- -----------------------------------------------------------------------------
SELECT
  o.company_id,
  o.id AS offer_id,
  o.created_at,
  o.pdf_created_at,
  o.approved_at,
  EXTRACT(EPOCH FROM o.pdf_created_at - o.created_at) / 3600.0 AS hours_create_to_pdf,
  EXTRACT(EPOCH FROM o.approved_at - o.created_at) / 3600.0 AS hours_create_to_approved
FROM offers o
WHERE o.company_id = :company_id;

-- -----------------------------------------------------------------------------
-- 4. Number of offer edits
--    Cannot count. Binary proxy: updated after create (trigger sets updated_at).
-- -----------------------------------------------------------------------------
SELECT
  o.id AS offer_id,
  o.created_at,
  o.updated_at,
  (EXTRACT(EPOCH FROM o.updated_at - o.created_at) > 2) AS was_updated_after_create
FROM offers o
WHERE o.company_id = :company_id;

SELECT
  COUNT(CASE WHEN EXTRACT(EPOCH FROM o.updated_at - o.created_at) > 2 THEN 1 END) AS offers_edited_at_least_once,
  COUNT(*) AS offers_total
FROM offers o
WHERE o.company_id = :company_id;

-- -----------------------------------------------------------------------------
-- 5. Time on each kanban stage
--    CANNOT be computed. leads.status is the current column only.
--    No status history, no status_entered_at.
--    Snapshot of current column (not duration):
-- -----------------------------------------------------------------------------
SELECT
  COALESCE(l.status, 'waiting') AS current_status,
  COUNT(*) AS lead_count
FROM leads l
WHERE l.company_id = :company_id
GROUP BY COALESCE(l.status, 'waiting')
ORDER BY lead_count DESC;

-- -----------------------------------------------------------------------------
-- 6. Stuck longer than N days
--    Age since created_at, not time on the current column.
--    Closed lead statuses used here: not_relevant, not_interested, lost_contact
--    plus leftover won/lost from older code.
-- -----------------------------------------------------------------------------
SELECT
  l.id AS lead_id,
  l.status,
  l.created_at,
  EXTRACT(EPOCH FROM now() - l.created_at) / 86400.0 AS age_days
FROM leads l
WHERE l.company_id = :company_id
  AND COALESCE(l.status, 'waiting') NOT IN (
    'not_relevant', 'not_interested', 'lost_contact', 'won', 'lost'
  )
  AND EXTRACT(EPOCH FROM now() - l.created_at) / 86400.0 > :n_days;

SELECT
  COUNT(*) AS stuck_open_leads
FROM leads l
WHERE l.company_id = :company_id
  AND COALESCE(l.status, 'waiting') NOT IN (
    'not_relevant', 'not_interested', 'lost_contact', 'won', 'lost'
  )
  AND EXTRACT(EPOCH FROM now() - l.created_at) / 86400.0 > :n_days;

-- Offers not signed, older than N days (unsigned ≠ unsent)
SELECT
  o.id AS offer_id,
  o.created_at,
  o.pdf_created_at,
  o.approved,
  EXTRACT(EPOCH FROM now() - o.created_at) / 86400.0 AS age_days
FROM offers o
WHERE o.company_id = :company_id
  AND (o.approved = 0 OR o.approved IS NULL)
  AND EXTRACT(EPOCH FROM now() - o.created_at) / 86400.0 > :n_days;

SELECT
  COUNT(*) AS stuck_unsigned_offers
FROM offers o
WHERE o.company_id = :company_id
  AND (o.approved = 0 OR o.approved IS NULL)
  AND EXTRACT(EPOCH FROM now() - o.created_at) / 86400.0 > :n_days;
