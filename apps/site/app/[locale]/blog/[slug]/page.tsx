import type { Locale } from "@/lib/locales";
import { notFound } from "next/navigation";
import Link from "next/link";
import fs from 'fs';
import path from 'path';

interface ArticlePageProps {
  params: Promise<{
    locale: Locale;
    slug: string;
  }>;
}

export async function generateStaticParams() {
  try {
    const articlesPath = path.join(process.cwd(), 'public', 'data', 'articles.json');
    const articlesData = JSON.parse(fs.readFileSync(articlesPath, 'utf-8'));
    const locales: Locale[] = ['he', 'ru', 'en'];
    const params = [];
    
    for (const locale of locales) {
      for (const article of articlesData.articles) {
        params.push({
          locale,
          slug: article.slug,
        });
      }
    }
    
    return params;
  } catch (error) {
    console.error('Error generating static params for blog:', error)
    return []
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { locale, slug } = await params
  
  const articlesPath = path.join(process.cwd(), 'public', 'data', 'articles.json');
  const articlesData = JSON.parse(fs.readFileSync(articlesPath, 'utf-8'));
  const article = articlesData.articles.find((a: any) => a.slug === slug);

  if (!article) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900 text-white">
      <div className="max-w-4xl mx-auto px-6 py-20">
        {/* Back button */}
        <Link 
          href={`/${locale}/blog`}
          className="inline-flex items-center text-white/70 hover:text-white mb-8 transition-colors"
        >
          ← {locale === 'he' ? 'חזרה למאמרים' : locale === 'ru' ? 'Назад к статьям' : 'Back to Articles'}
        </Link>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
          {article.title[locale]}
        </h1>

        {/* Summary */}
        <p className="text-xl text-white/80 mb-12 leading-relaxed">
          {article.summary[locale]}
        </p>

        {/* Sections */}
        <div className="space-y-12">
          {article.sections.map((section: any, index: number) => (
            <section key={index} className="bg-white/5 rounded-2xl p-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                {section.heading[locale]}
              </h2>
              <div className="text-white/80 text-lg leading-relaxed whitespace-pre-line">
                {section.body[locale]}
              </div>
            </section>
          ))}
        </div>

        {/* Back to blog */}
        <div className="mt-16 text-center">
          <Link 
            href={`/${locale}/blog`}
            className="inline-block px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            {locale === 'he' ? 'חזרה למאמרים' : locale === 'ru' ? 'Назад к статьям' : 'Back to Articles'}
          </Link>
        </div>
      </div>
    </main>
  );
}

