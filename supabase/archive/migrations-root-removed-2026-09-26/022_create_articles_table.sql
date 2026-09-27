-- Create articles table for CRM
-- Stores blog posts and knowledge base articles

CREATE TABLE IF NOT EXISTS public.articles (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title JSONB NOT NULL DEFAULT '{"he":"","ru":"","en":""}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{"he":"","ru":"","en":""}'::jsonb,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS articles_slug_idx ON public.articles(slug);
CREATE INDEX IF NOT EXISTS articles_company_id_idx ON public.articles(company_id);
CREATE INDEX IF NOT EXISTS articles_published_idx ON public.articles(published) WHERE published = true;
CREATE INDEX IF NOT EXISTS articles_published_at_idx ON public.articles(published_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_updated_at_trigger
  BEFORE UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION update_articles_updated_at();

-- Comments
COMMENT ON TABLE public.articles IS 'Blog posts and knowledge base articles';
COMMENT ON COLUMN public.articles.slug IS 'URL-friendly identifier';
COMMENT ON COLUMN public.articles.title IS 'Article title in multiple languages: {he, ru, en}';
COMMENT ON COLUMN public.articles.summary IS 'Article summary/excerpt in multiple languages';
COMMENT ON COLUMN public.articles.sections IS 'Array of sections with heading and body in multiple languages';

-- Sample data (optional)
-- INSERT INTO public.articles (slug, title, summary, sections, published, company_id) VALUES
-- ('welcome-to-crm', 
--  '{"he":"ברוכים הבאים","ru":"Добро пожаловать","en":"Welcome"}'::jsonb,
--  '{"he":"מדריך התחלה מהירה","ru":"Краткое руководство","en":"Quick start guide"}'::jsonb,
--  '[{"heading":{"he":"התחלה","ru":"Начало","en":"Getting Started"},"body":{"he":"זהו מדריך...","ru":"Это руководство...","en":"This is a guide..."}}]'::jsonb,
--  true,
--  '6998295e-89ae-4e3d-afd2-8c2b0333eac2'); -- Your Pashkovsky Group ID

-- Verify
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'articles'
ORDER BY ordinal_position;

