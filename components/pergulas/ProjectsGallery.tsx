"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import projects from "@/data/gallery/pergulot.json";

// shadcn/ui dialog
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// swiper
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Keyboard, Zoom, A11y } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/zoom";

type Locale = "he" | "en" | "ru";

type Project = {
  id: string;
  title: { he: string; en: string; ru: string };
  desc: { he: string; en: string; ru: string };
  images: string[];
};

export default function ProjectsGallery({ locale = "he" }: { locale?: Locale }) {
  const data = (projects as { projects: Project[] }).projects;

  const [open, setOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [startIndex, setStartIndex] = useState<number>(0);

  const title = useMemo(() => {
    switch (locale) {
      case "en":
        return "A selection of projects we’ve completed across the country – top-quality, custom-made aluminum pergolas.";
      case "ru":
        return "Подборка проектов по всему Израилю — алюминиевые перголы высшего качества, изготовленные под заказ.";
      default:
        return "מדגם הפרויקטים שביצענו ברחבי הארץ – פרגולות באיכות הגבוהה ביותר בהתאמה אישית.";
    }
  }, [locale]);

  const openModal = useCallback((project: Project, index = 0) => {
    setActiveProject(project);
    setStartIndex(index);
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setTimeout(() => {
      setActiveProject(null);
      setStartIndex(0);
    }, 200);
  }, []);

  return (
    <section className="py-24 bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
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
            const cover = p.images?.[0];

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
                      quality={100}
                      priority={idx === 0}
                      loading={idx === 0 ? 'eager' : 'lazy'}
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

      {/* Modal with Swiper */}
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeModal())}>
        <DialogContent
          className="max-w-[90vw] md:max-w-[80vw] w-full p-0 bg-[#0b1220] text-white border border-white/10"
          // scale-in effect
        >
          <DialogHeader
            className={`px-6 pt-6 ${
              locale === "he" ? "text-right" : "text-left"
            }`}
          >
            <DialogTitle className="text-2xl md:text-3xl font-bold">
              {activeProject ? activeProject.title?.[locale] ?? activeProject.title?.he : ""}
            </DialogTitle>
            <DialogDescription
              className="!mt-2 text-white/80 text-sm md:text-base"
              asChild
            >
              <p>
                {activeProject
                  ? activeProject.desc?.[locale] ?? activeProject.desc?.he
                  : ""}
              </p>
            </DialogDescription>
          </DialogHeader>

          {/* Swiper area */}
          <div className="relative w-full h-[50vh] md:h-[65vh] mt-4 mb-6">
            {activeProject && (
              <Swiper
                modules={[Navigation, Pagination, Keyboard, Zoom, A11y]}
                navigation
                pagination={{ clickable: true }}
                keyboard={{ enabled: true }}
                zoom={{ maxRatio: 2 }}
                initialSlide={startIndex}
                className="w-full h-full"
              >
                {activeProject.images.map((src, i) => (
                  <SwiperSlide key={i}>
                    <div className="swiper-zoom-container w-full h-full flex items-center justify-center bg-black/20 relative">
                      <Image
                        src={src}
                        alt={`${activeProject.title?.[locale] ?? ""} – ${i + 1}`}
                        fill
                        sizes="100vw"
                        className="object-contain"
                        quality={100}
                        loading="eager"
                        unoptimized={false}
                      />
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
