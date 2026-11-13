-- Per-firm contact data: website, WhatsApp number and greeting template.
--
-- NOT APPLIED. Review, then apply by hand. Reversible: rollbacks/064_company_firm_profile_down.sql.
--
-- ORDER MATTERS: apply this BEFORE (or together with) deploying the code that reads it. The code
-- no longer carries the first customer's phone, WhatsApp number or VAT id, so until the seed
-- below has run, that firm's PDF header would lack them and its WhatsApp buttons would be hidden.
-- (Other firms are not affected by the order: they have no such data either way.)
--
-- Seed: the first customer's values that were typed into the code are written to its own row,
-- one to one, and only where the field is still empty. Nothing changes for that firm:
--   phone            052-449-4848                       (offer PDF header, success page, warranty)
--   primary_email    office@pashkovsky-group.com        (already set; kept)
--   website          www.pashkovsky-group.com
--   whatsapp_number  972524494848                       (was the hardcoded fallback in OffersList)
--   whatsapp_template  the Hebrew lead greeting that messages/he.json applied to every firm
--   vat_number       320807068                          (was typed into the offer PDF header)
-- Other firms get empty values and therefore no WhatsApp buttons until they enter a number.

BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS whatsapp_template text;

COMMENT ON COLUMN public.companies.whatsapp_number IS
  'International digits, e.g. 972524494848. NULL/empty: every WhatsApp button and link is hidden for the firm.';
COMMENT ON COLUMN public.companies.whatsapp_template IS
  'Lead greeting. Placeholders: {name}, {company}, {website}. NULL: neutral default.';

UPDATE public.companies
SET
  phone = COALESCE(NULLIF(btrim(phone), ''), '052-449-4848'),
  primary_email = COALESCE(NULLIF(btrim(primary_email), ''), 'office@pashkovsky-group.com'),
  website = COALESCE(NULLIF(btrim(website), ''), 'www.pashkovsky-group.com'),
  whatsapp_number = COALESCE(NULLIF(btrim(whatsapp_number), ''), '972524494848'),
  whatsapp_template = COALESCE(
    NULLIF(btrim(whatsapp_template), ''),
    $tpl$שלום {name}! שמי מקסים מחברת פשקובסקי גרופ (פרגולות). השארת לנו פרטים בפייסבוק. איך אני יכול לעזור לך? https://www.pashkovsky-group.com/he$tpl$
  ),
  vat_number = COALESCE(NULLIF(btrim(vat_number), ''), '320807068')
WHERE id = '6998295e-89ae-4e3d-afd2-8c2b0333eac2';

COMMIT;
