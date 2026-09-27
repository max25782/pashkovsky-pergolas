-- Locale of the last generated offer PDF (UI or company default). Used to reuse S3 cache when unchanged.
ALTER TABLE public.offers
ADD COLUMN IF NOT EXISTS pdf_locale text;

COMMENT ON COLUMN public.offers.pdf_locale IS 'PDF copy locale when pdf_url was written: he|ru|en|sr';
