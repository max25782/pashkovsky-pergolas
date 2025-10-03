"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { uiStore } from "@/stores/ui-store";
import dynamic from "next/dynamic";
import fences from "@/data/gallery/fancy.json";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

        {/* Videos grid: 2 per row on sm+ */}
        {videos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 mb-6">
            {videos.map((v, idx) => (
              <div key={`vid-${idx}`} className="relative w-full h-[65vh] sm:h-[70vh] lg:h-[80vh] overflow-hidden rounded-2xl">
                <VideoReel src={v.src} />
              </div>
            ))}
          </div>
        )}

        {/* Images grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                quality={80}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                priority={idx < 3}
                placeholder="blur"
                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABBAEAW9JTEQAAAABJRU5ErkJggg=="
                loading={idx < 3 ? 'eager' : 'lazy'}
              />
            </button>
          ))}
        </div>
      </div>

      <Dialog open={uiStore.lightbox.open} onOpenChange={(v)=> v ? null : uiStore.closeLightbox()}>
        <DialogContent className="max-w-[90vw] md:max-w-[80vw] w-full p-0 bg-[#0b1220] text-white border border-white/10">
          <DialogTitle className="sr-only">Fancy gallery lightbox</DialogTitle>
          <DialogDescription className="sr-only">View fancy image in lightbox</DialogDescription>
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
                <ModalImage src={src} alt={`Fence ${i + 1}`} />
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

function VideoReel({ src }: { src: string }){
  const ref = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    el.muted = true
    el.playsInline = true
    el.loop = true

    const onLeave = () => { el.pause(); el.currentTime = 0; setIsPlaying(false) }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) onLeave()
      })
    }, { threshold: 0.4 })

    io.observe(el)
    return () => { io.disconnect(); onLeave() }
  }, [])

  function handlePlay(){
    const el = ref.current
    if (!el) return
    el.play().then(() => setIsPlaying(true)).catch(() => {})
  }

  return (
    <div className="absolute inset-0">
      <video
        ref={ref}
        src={src}
        preload="metadata"
        className="w-full h-full object-cover"
        onClick={() => {
          const el = ref.current
          if (!el) return
          if (isPlaying) {
            el.pause()
            el.currentTime = 0
            setIsPlaying(false)
          }
        }}
      />
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button type="button" onClick={handlePlay} className="rounded-full bg-black/60 hover:bg-black/70 text-white w-16 h-16 flex items-center justify-center text-3xl">
          ▶
        </button>
      </div>
    </div>
  )
}

function ModalImage({ src, alt }: { src: string; alt: string }){
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="relative w-full h-full flex items-center justify-center p-4 bg-black/20">
      {!loaded && (
        <div className="absolute inset-4 rounded-xl bg-gradient-to-br from-white/5 to-white/10 animate-pulse backdrop-blur-md" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className="transition-opacity duration-300"
        style={{
          maxWidth: '100%',
          maxHeight: '76vh',
          width: loaded ? 'auto' : 0,
          height: loaded ? 'auto' : 0,
          opacity: loaded ? 1 : 0,
          objectFit: 'contain'
        }}
      />
    </div>
  )
}
