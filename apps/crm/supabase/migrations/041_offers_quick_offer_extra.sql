-- Persist Quick Offer product kind (pergola / railings / fence) and line-item fields for PDFs and exports.
ALTER TABLE public.offers
ADD COLUMN IF NOT EXISTS quick_offer_extra JSONB DEFAULT NULL;

COMMENT ON COLUMN public.offers.quick_offer_extra IS 'Quick Offer: { quickProduct, quickRailings?, quickFence? } when product is not pergola-only.';
