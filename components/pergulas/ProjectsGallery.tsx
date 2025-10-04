"use client";

import Image from "next/image";
import { useCallback, useMemo, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { uiStore } from "@/stores/ui-store";
import projects from "@/data/gallery/pergulot.json";

type Locale = "he" | "en" | "ru";

interface ProjectNormalized {
  id: string;
  title: { he: string; en: string; ru: string };
  desc: { he: string; en: string; ru: string };
  images: string[];
}

function ProjectsGalleryImpl({ locale = "he" }: { locale?: Locale }) {
  const raw = (projects as { projects: any[] }).projects;

  const data: ProjectNormalized[] = useMemo(() => {
    return raw.map((p: any, idx: number) => {
      const id: string = p.id ?? p.slug ?? String(idx);
      const images: string[] = Array.isArray(p.images)
        ? p.images
        : Array.isArray(p.media)
          ? p.media.filter((m: any) => m.type === "image").map((m: any) => m.src)
          : [];
      const titleValue = typeof p.title === 'string' ? p.title : (p.title?.he ?? id);
      const descValue = typeof p.desc === 'string' ? p.desc : (p.desc?.he ?? '');
      return {
        id,
        title: {
          he: p.title?.he ?? titleValue,
          en: p.title?.en ?? titleValue,
          ru: p.title?.ru ?? titleValue,
        },
        desc: {
          he: p.desc?.he ?? descValue,
          en: p.desc?.en ?? descValue,
          ru: p.desc?.ru ?? descValue,
        },
        images,
      } as ProjectNormalized;
    });
  }, [raw]);

  const currentProject = useMemo(() => {
    return data.find(p => p.id === uiStore.projects.projectId) || null;
  }, [data, uiStore.projects.projectId]);

  const title = useMemo(() => {
    switch (locale) {
      case "en":
        return "A selection of projects we've completed across the country – top-quality, custom-made aluminum pergolas.";
      case "ru":
        return "Подборка проектов по всему Израилю — алюминиевые перголы высшего качества, изготовленные под заказ.";
      default:
        return "מדגם הפרויקטים שביצענו ברחבי הארץ – פרגולות באיכות הגבוהה ביותר בהתאמה אישית.";
    }
  }, [locale]);

  const openModal = useCallback((project: ProjectNormalized, index = 0) => {
    uiStore.openProject(project.id, index);
  }, []);

  const closeModal = useCallback(() => {
    uiStore.closeProject();
  }, []);

  const nextImage = useCallback(() => {
    const total = currentProject?.images?.length ?? 0;
    uiStore.nextProjectImage(total);
  }, [currentProject?.images?.length]);

  const prevImage = useCallback(() => {
    const total = currentProject?.images?.length ?? 0;
    uiStore.prevProjectImage(total);
  }, [currentProject?.images?.length]);

  useEffect(() => {
    if (!uiStore.projects.open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
      if (e.key === "ArrowLeft") nextImage();
      if (e.key === "ArrowRight") prevImage();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [uiStore.projects.open, nextImage, prevImage, closeModal]);

  return (
    <section className="py-24 text-white"
    style={{
      background: 'bg-gradient-to-br from-zinc-900 to-zinc-700)'
    }}
    >
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-extrabold mb-4 text-center">
          {locale === "en"
            ? "Our Projects"
            : locale === "ru"
            ? "Наши проекты"
            : "הפרויקטים שלנו"}
        </h2>
        <p className="text-center max-w-3xl mx-auto text-sm md:text-base opacity-90 mb-14">
          {title}
        </p>

        {/* Grid 3 / 2 / 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {data.map((p, idx) => {
            const cityText = p.title?.[locale] ?? p.title?.he;
            const descText = p.desc?.[locale] ?? p.desc?.he;
            const cover = chooseCover(p.images);

            return (
              <button
                key={p.id ?? idx}
                onClick={() => openModal(p, 0)}
                className="group text-left rounded-3xl overflow-hidden bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all duration-300 shadow-lg hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <div className="relative w-full h-56">
                  {cover && (
                    <Image
                      src={cover}
                      alt={cityText}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      quality={80}
                      priority={idx < 3}
                      loading={idx < 3 ? 'eager' : 'lazy'}
                      placeholder="blur"
                      blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABBAEAW9JTEQAAAABJRU5ErkJggg=="
                    />
                  )}
                  {/* subtle gradient overlay for readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
                </div>

                <div
                  className={`p-6 ${
                    locale === "he" ? "text-right" : "text-left"
                  }`}
                >
                  <h3 className="text-2xl font-semibold mb-2">{cityText}</h3>
                  <p className="text-white/80 text-sm leading-relaxed line-clamp-3">
                    {descText}
                  </p>
                  <div
                    className={`mt-4 text-sm font-medium text-blue-300 group-hover:text-blue-200 transition-colors ${
                      locale === "he" ? "text-right" : "text-left"
                    }`}
                  >
                    {locale === "en"
                      ? "View project →"
                      : locale === "ru"
                      ? "Смотреть проект →"
                      : "לצפייה בפרויקט →"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Simple Modal */}
      {uiStore.projects.open && currentProject && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 bg-[#0b1220]/80 border-b border-white/10">
            <div className={locale === "he" ? "text-right" : "text-left"}>
              <h2 className="text-2xl md:text-3xl font-bold">
                {currentProject.title?.[locale] ?? currentProject.title?.he}
              </h2>
              <p className="text-white/80 text-sm md:text-base mt-1">
                {currentProject.desc?.[locale] ?? currentProject.desc?.he}
              </p>
            </div>
            <button
              onClick={closeModal}
              className="text-white/90 hover:text-white text-3xl ml-4"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Image Area */}
          <div className="flex-1 relative flex items-center justify-center p-4">
            {currentProject.images[uiStore.projects.currentIndex] && (
              <img
                src={currentProject.images[uiStore.projects.currentIndex]}
                alt={`${currentProject.title?.[locale] ?? ""} – ${
                  uiStore.projects.currentIndex + 1
                }`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '75vh',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain'
                }}
              />
            )}

            {/* Navigation Arrows */}
            <button
              onClick={prevImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white text-5xl z-10 bg-black/30 hover:bg-black/50 rounded-full w-14 h-14 flex items-center justify-center"
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              onClick={nextImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white text-5xl z-10 bg-black/30 hover:bg-black/50 rounded-full w-14 h-14 flex items-center justify-center"
              aria-label="Next"
            >
              ›
            </button>
          </div>

          {/* Footer - Counter */}
          <div className="text-center py-4 text-white/70 text-sm bg-[#0b1220]/80 border-t border-white/10">
            {uiStore.projects.currentIndex + 1} / {currentProject.images.length}
          </div>
        </div>
      )}
    </section>
  );
}
function useCurrentProject(projectsList: ProjectNormalized[], projectId: string | null) {
  return useMemo(() => projectsList.find(p => p.id === projectId) || null, [projectsList, projectId]);
}

function chooseCover(images: string[]) {
  const preferred = images.find(src => src.toLowerCase().endsWith('.webp'));
  return preferred ?? images[0] ?? null;
}

function cryptoRandomId(seed: any) {
  try {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? (crypto as any).randomUUID() : String(seed ?? Math.random());
  } catch {
    return String(seed ?? Math.random());
  }
}

export default observer(ProjectsGalleryImpl);
