"use client";

import Image from "next/image";
import { useState } from "react";
import { observer } from "mobx-react-lite";
import { uiStore } from "@/stores/ui-store";
import dynamic from "next/dynamic";
import fences from "@/data/gallery/fancy.json";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
// Lazy-load Swiper only when used (client-only)
const Swiper = dynamic(() => import("swiper/react").then(m => m.Swiper), { ssr: false });
const SwiperSlide = dynamic(() => import("swiper/react").then(m => m.SwiperSlide), { ssr: false });
import { Navigation, Pagination } from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

function FencesGalleryImpl() {
  const [open, setOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);
  const items = (fences as { items: { src: string; type: string }[] }).items;
  const videos = items.filter(i => i.type === 'video');
  const images = items
    .filter(i => i.type === "image" && i.src.toLowerCase().endsWith(".webp"))
    .map(i => i.src);

  return (
    <section className="py-24 bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          גלריית גדרות האלומיניום שלנו
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Videos first as reels */}
          {videos.map((v, idx) => (
            <div key={`vid-${idx}`} className="relative w-full h-[65vh] sm:h-[70vh] lg:h-[80vh] overflow-hidden rounded-2xl">
              <video
                src={v.src}
                muted
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
                onMouseEnter={e => e.currentTarget.play()}
                onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                onTouchStart={e => (e.currentTarget as HTMLVideoElement).play()}
              />
            </div>
          ))}

          {/* Then images */}
          {images.map((src, idx) => (
            <button
              key={idx}
              onClick={() => uiStore.openLightbox(idx)}
              className="relative w-full h-64 overflow-hidden rounded-2xl hover:scale-105 transition-transform duration-300"
            >
              <Image
                src={src}
                alt={`Fence ${idx + 1}`}
                fill
                className="object-cover"
                quality={75}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                placeholder="blur"
                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>

      <Dialog open={uiStore.lightbox.open} onOpenChange={(v)=> v ? null : uiStore.closeLightbox()}>
        <DialogContent className="max-w-[90vw] md:max-w-[80vw] w-full p-0 bg-[#0b1220] text-white border border-white/10">
          <DialogTitle className="sr-only">Fancy gallery lightbox</DialogTitle>
          {uiStore.lightbox.open && (
          <Swiper
            modules={[Navigation, Pagination]}
            navigation
            pagination={{ clickable: true }}
            initialSlide={uiStore.lightbox.startIndex}
            className="w-full h-[80vh]"
          >
            {images.map((src, i) => (
              <SwiperSlide key={i}>
                <div className="relative w-full h-full">
                  <Image
                    src={src}
                    alt={`Fence ${i + 1}`}
                    fill
                    className="object-contain"
                    quality={80}
                    sizes="(max-width: 1024px) 100vw, 80vw"
                    placeholder="blur"
                    blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                    loading="lazy"
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default observer(FencesGalleryImpl);
