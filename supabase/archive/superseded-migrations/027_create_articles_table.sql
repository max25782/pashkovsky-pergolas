-- ==========================================
-- Create articles table for blog management
-- ==========================================

CREATE TABLE IF NOT EXISTS public.articles (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title JSONB NOT NULL, -- {"he": "...", "ru": "...", "en": "..."}
  summary JSONB NOT NULL, -- {"he": "...", "ru": "...", "en": "..."}
  sections JSONB NOT NULL, -- [{"heading": {...}, "body": {...}}]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_articles_slug ON public.articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON public.articles(created_at DESC);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_articles_updated_at ON public.articles;
CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION update_articles_updated_at();

-- Insert initial articles from site
INSERT INTO public.articles (slug, title, summary, sections) VALUES
(
  'pergolas-aluminum',
  '{"he": "פרגולות אלומיניום – עמידות, עיצוב ונוחות", "en": "Aluminum Pergolas – Durability, Design, and Comfort", "ru": "Алюминиевые перголы — надёжность, стиль и комфорт"}',
  '{"he": "פרגולה מודרנית מאלומיניום הופכת כל מרפסת או חצר למרחב מוצל, פונקציונלי ומעוצב – עם תחזוקה מינימלית ועמידות מקסימלית.", "en": "A modern aluminum pergola transforms any terrace or yard into a shaded, functional, and stylish space with minimal maintenance and maximum durability.", "ru": "Современная алюминиевая пергола превращает террасу или двор в функциональное теневое пространство с минимальным уходом и максимальной долговечностью."}',
  '[
    {"heading": {"he": "מהי פרגולה ולמה היא נדרשת", "en": "What Is a Pergola and Why It Matters", "ru": "Что такое пергола и зачем она нужна"}, "body": {"he": "פרגולה היא מערכת הצללה/כיסוי קבועה או צמודת-קיר, שמספקת צל, הגנה חלקית מגשם, תחושת אינטימיות ותוספת עיצובית לחלל החוץ.", "en": "A pergola is a fixed or wall-attached shading structure that provides shade, partial rain protection, privacy, and a distinctive architectural accent.", "ru": "Пергола — это стационарная или пристенная система тени, которая даёт укрытие от солнца и частично от дождя."}},
    {"heading": {"he": "למה אלומיניום", "en": "Why Aluminum", "ru": "Почему алюминий"}, "body": {"he": "אלומיניום אינו מחליד, קל יחסית אך חזק, ואינו דורש צביעה תחזוקתית.", "en": "Aluminum doesnt rust, is light yet strong, and requires no maintenance repainting.", "ru": "Алюминий не ржавеет, лёгкий и прочный, не требует регулярной покраски."}}
  ]'::jsonb
),
(
  'glass-railings',
  '{"he": "מעקות אלומיניום בשילוב זכוכית – יופי ובטיחות לפי תקן", "en": "Aluminum + Glass Railings – Beauty and Safety by Standard", "ru": "Стеклянные перила с алюминием — красота и безопасность по стандарту"}',
  '{"he": "שילוב של פרופילי אלומיניום וזכוכית יוצר מראה יוקרתי ופתוח, תוך שמירה על בטיחות ועמידה בתקן.", "en": "Combining aluminum profiles with glass delivers a luxurious open look while meeting safety standards.", "ru": "Сочетание алюминиевых профилей и стекла даёт лёгкий премиальный вид при соблюдении всех требований безопасности."}',
  '[
    {"heading": {"he": "הערך העיצובי והפרקטי", "en": "Design and Practical Value", "ru": "Дизайн и практичность"}, "body": {"he": "מעקה זכוכית מאפשר שקיפות, אור ונוף נקי; האלומיניום מספק קשיחות ודיוק בקווים.", "en": "Glass railings provide transparency, light, and unobstructed views; aluminum adds rigidity and precise lines.", "ru": "Стекло даёт свет, прозрачность и чистый вид; алюминий обеспечивает жёсткость и точные линии."}}
  ]'::jsonb
),
(
  'fences-gates',
  '{"he": "גדרות ושערי אלומיניום – הגנה, פרטיות ועיצוב", "en": "Aluminum Fences & Gates – Protection, Privacy, Design", "ru": "Алюминиевые заборы и ворота — защита, приватность, дизайн"}',
  '{"he": "אלומיניום לא מחליד, קל לתחזוקה ומתאים לאקלים הישראלי. פתרון מושלם לגדרות ושערים עמידים ואלגנטיים.", "en": "Aluminum doesnt rust and suits Israels climate — the perfect solution for durable, elegant fences and gates.", "ru": "Алюминий не ржавеет и идеально подходит для климата Израиля — лучшее решение для долговечных и стильных заборов и ворот."}',
  '[
    {"heading": {"he": "למה אלומיניום עדיף על ברזל/עץ", "en": "Why Aluminum over Iron/Wood", "ru": "Почему алюминий лучше железа/дерева"}, "body": {"he": "ברזל מחליד ודורש צביעה קבועה; עץ דוהה ומתעוות. אלומיניום עמיד, קל, לא דורש צביעה שוטפת ושומר על מראה חדש שנים.", "en": "Iron rusts and needs constant painting; wood fades/warps. Aluminum is durable, light, maintenance-free, and looks new for years.", "ru": "Железо ржавеет и требует покраски; дерево выцветает и ведёт. Алюминий долговечен, лёгок, не требует ухода и годами выглядит как новый."}}
  ]'::jsonb
),
(
  'windows-installation',
  '{"he": "חלונות אלומיניום – הדיוק שעושה את ההבדל", "en": "Aluminum Windows – Precision That Makes the Difference", "ru": "Алюминиевые окна — точность, которая решает всё"}',
  '{"he": "גם חלון איכותי יאכזב אם יותקן לא נכון. מדידה, עיגון ואיטום מקצועיים קובעים בידוד, שקט ועמידות לשנים.", "en": "Even premium windows disappoint if installed poorly. Professional measurement, anchoring, and sealing ensure insulation, silence, and longevity.", "ru": "Даже премиальные окна разочаруют при неправильном монтаже. Профессиональные замер, крепление и герметизация дают тепло-, шумоизоляцию и долговечность."}',
  '[
    {"heading": {"he": "מדידה מקצועית", "en": "Professional Survey", "ru": "Профессиональный замер"}, "body": {"he": "בדיקת גאומטריית הפתח, עובי קיר, בידוד קיים וכיווני שמש/רוח.", "en": "Check opening geometry, wall thickness, existing insulation, sun/wind directions.", "ru": "Проверка геометрии проёма, толщины стен, существующей изоляции, направлений солнца/ветра."}}
  ]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Success message
DO $$
DECLARE
  article_count INT;
BEGIN
  SELECT COUNT(*) INTO article_count FROM public.articles;
  RAISE NOTICE '✅ Articles table created';
  RAISE NOTICE '✅ Inserted % articles', article_count;
END $$;






