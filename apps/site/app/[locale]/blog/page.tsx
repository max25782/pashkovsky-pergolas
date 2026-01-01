import type { Locale } from "@/lib/locales";
import fs from 'fs';
import path from 'path';

export default function BlogPage({ params }: { params: { locale: Locale } }) {
  const locale = params.locale || "he";
  
  // Читаем статьи на сервере
  const articlesPath = path.join(process.cwd(), 'public', 'data', 'articles.json');
  const articlesData = JSON.parse(fs.readFileSync(articlesPath, 'utf-8'));
  const articles = articlesData.articles;

  return (
    <div className="max-w-4xl mx-auto p-6 py-20">
      <h1 className="text-4xl font-bold mb-12 text-center text-white">
        {locale === 'he' ? 'מאמרים' : locale === 'ru' ? 'Статьи' : 'Articles'}
      </h1>
      <div className="space-y-8">
        {articles.map((article: any) => (
          <div key={article.slug} className="bg-white/5 rounded-2xl p-8 hover:bg-white/10 transition-colors">
            <h2 className="text-3xl font-bold mb-4 text-white">{article.title[locale]}</h2>
            <p className="text-white/70 text-lg leading-relaxed mb-6">
              {article.summary[locale]}
            </p>
            <a 
              href={`/${locale}/blog/${article.slug}`} 
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              {locale === 'he' ? 'קרא עוד →' : locale === 'ru' ? 'Читать далее →' : 'Read more →'}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
