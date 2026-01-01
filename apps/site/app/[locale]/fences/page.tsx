import FencesGallery from "@/components/fences/FencesGallery";
import ArticleModal from "@/components/articleModal";
import type { Locale } from "@/lib/locales";

export default function FencesPage({ params }: { params: { locale: Locale } }) {
  const locale = params.locale || "he";
  return (
    <>
      <ArticleModal articleSlug="fences-gates" lang={locale} />
      <FencesGallery />
    </>
  );
}
