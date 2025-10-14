"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Article {
  slug: string;
  title: { he: string; ru: string; en: string };
  summary: { he: string; ru: string; en: string };
  sections: Array<{
    heading: { he: string; ru: string; en: string };
    body: { he: string; ru: string; en: string };
  }>;
}

export default function ArticleModal({ articleSlug, lang = "he" }: { articleSlug: string; lang?: "he" | "ru" | "en" }) {
  const [open, setOpen] = useState(false);
  const [article, setArticle] = useState<Article | null>(null);

  useEffect(() => {
    // Загружаем статью
    fetch('/data/articles.json')
      .then(res => res.json())
      .then(data => {
        const foundArticle = data.articles.find((a: any) => a.slug === articleSlug);
        setArticle(foundArticle || null);
      })
      .catch(err => console.error('Error loading article:', err));

    // Проверяем, показывали ли уже модалку на этой странице
    const pageKey = `viewed-${articleSlug}-${typeof window !== 'undefined' ? window.location.pathname : ''}`;
    const viewed = sessionStorage.getItem(pageKey);
    if (!viewed) {
      setTimeout(() => setOpen(true), 3000);
      sessionStorage.setItem(pageKey, "true");
    }
  }, [articleSlug]);

  if (!article) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white text-gray-900">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold mb-4">{article.title[lang]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <p className="text-lg text-gray-700 leading-relaxed">{article.summary[lang]}</p>
          {article.sections.map((section: any, index: number) => (
            <div key={index} className="border-t pt-4">
              <h3 className="text-xl font-semibold mb-3">{section.heading[lang]}</h3>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{section.body[lang]}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
