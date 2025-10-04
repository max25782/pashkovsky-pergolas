"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { uiStore } from "@/stores/ui-store";
import fences from "@/data/gallery/fancy.json";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlayButton, GradientOverlay } from "@/components/ui/play-overlay";

function FencesGalleryImpl() {
  const [open, setOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);
  const [videoModal, setVideoModal] = useState<{ open: boolean; index: number | null }>({ open: false, index: null });
  const items = (fences as { items: { src: string; type: string }[] }).items;
  const videos = items.filter(i => i.type === 'video');
  const images = items
    .filter(i => i.type === "image" && i.src.toLowerCase().endsWith(".webp"))
    .map(i => i.src);

  return (
    <section className="py-24 bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-white">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          {/* i18n minimal: no locale param here, keep HE as default text */}
          גלריית גדרות האלומיניום שלנו
        </h2>

        {/* Videos grid: 2 per row on sm+ */}
        {videos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 mb-6">
            {videos.map((v, idx) => (
              <div key={`vid-${idx}`} className="relative w-full h-[65vh] sm:h-[70vh] lg:h-[80vh] overflow-hidden rounded-2xl">
                <VideoReel src={v.src} poster={v.src.replace(/\.(mp4|webm)$/i, '.webp')} onOpen={()=> setVideoModal({ open:true, index: idx })} />
              </div>
            ))}
          </div>
        )}

        {/* Images grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((src, idx) => (
            <div
              key={idx}
              role="button"
              tabIndex={0}
              onClick={() => uiStore.openLightbox(idx)}
              onKeyDown={(e)=>{ if (e.key==='Enter'||e.key===' ') { e.preventDefault(); uiStore.openLightbox(idx) } }}
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
            </div>
          ))}
        </div>
      </div>

      <Dialog open={uiStore.lightbox.open} onOpenChange={(v)=> v ? null : uiStore.closeLightbox()}>
        <DialogContent className="max-w-[90vw] md:max-w-[80vw] w-full p-0 bg-[#0b1220] text-white border border-white/10">
          <DialogTitle className="sr-only">Fancy gallery lightbox</DialogTitle>
          <DialogDescription className="sr-only">View fancy image in lightbox</DialogDescription>
          {uiStore.lightbox.open && images.length > 0 && (
            <CustomLightbox images={images} startIndex={uiStore.lightbox.startIndex} />
          )}
        </DialogContent>
      </Dialog>

      {/* Video fullscreen modal */}
      <Dialog open={videoModal.open} onOpenChange={(v)=> setVideoModal(v ? videoModal : { open:false, index:null })}>
        <DialogContent className="max-w-[95vw] md:max-w-[90vw] w-full p-0 bg-black text-white border border-white/10">
          <DialogTitle className="sr-only">Video player</DialogTitle>
          <DialogDescription className="sr-only">Watch video in fullscreen modal</DialogDescription>
          {videoModal.open && videoModal.index !== null && videos[videoModal.index] && (
            <div className="relative w-full h-[85vh] flex items-center justify-center bg-black select-none">
              <button aria-label="Prev" onClick={()=> setVideoModal(s=>({ open:true, index: ((s.index ?? 0) - 1 + videos.length) % videos.length }))} className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white text-4xl z-20">‹</button>
              <button aria-label="Next" onClick={()=> setVideoModal(s=>({ open:true, index: ((s.index ?? 0) + 1) % videos.length }))} className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white text-4xl z-20">›</button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/70 z-20">{((videoModal.index ?? 0) + 1)} / {videos.length}</div>
              <video src={videos[videoModal.index].src} autoPlay controls className="max-w-full max-h-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default observer(FencesGalleryImpl);

function CustomLightbox({ images, startIndex }: { images: string[]; startIndex: number }){
  const [idx, setIdx] = useState(startIndex)
  useEffect(()=>{ setIdx(startIndex) }, [startIndex])

  function prev(){ setIdx(i => (i - 1 + images.length) % images.length) }
  function next(){ setIdx(i => (i + 1) % images.length) }

  if (images.length === 1){
    return (
      <div className="relative w-full h-[80vh] flex items-center justify-center">
        <ModalImage src={images[0]} alt="Fence" eager />
      </div>
    )
  }

  const current = images[idx]
  return (
    <div className="relative w-full h-[80vh] flex items-center justify-center select-none">
      <button aria-label="Prev" onClick={prev} className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white text-4xl z-20">‹</button>
      <button aria-label="Next" onClick={next} className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white text-4xl z-20">›</button>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/70 z-20">{idx + 1} / {images.length}</div>
      <ModalImage src={current} alt={`Fence ${idx + 1}`} eager />
    </div>
  )
}

function VideoReel({ src, poster, onOpen }: { src: string; poster?: string; onOpen?: (src:string)=>void }){
  const ref = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)

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
    }, { threshold: 0.5 })

    io.observe(el)
    return () => { io.disconnect(); onLeave() }
  }, [])

  function handlePlay(){
    const el = ref.current
    if (!el) return
    if (onOpen){ onOpen(src); return }
    if (!videoSrc) {
      setVideoSrc(src)
      // дождаться привязки src, затем загрузить и воспроизвести
      requestAnimationFrame(() => {
        const v = ref.current
        if (!v) return
        v.load()
        v.play().then(() => setIsPlaying(true)).catch(() => {})
      })
    } else {
      el.play().then(() => setIsPlaying(true)).catch(() => {})
    }
  }

  return (
    <div className="absolute inset-0">
      <video
        ref={ref}
        src={videoSrc ?? undefined}
        preload="none"
        poster={poster}
        className="w-full h-full object-cover"
        disablePictureInPicture
        controls={false}
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
      <GradientOverlay />
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <PlayButton onClick={handlePlay} />
      </div>
    </div>
  )
}

function ModalImage({ src, alt, eager = false }: { src: string; alt: string; eager?: boolean }){
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="relative w-full h-full flex items-center justify-center p-4 bg-black/20">
      {!loaded && (
        <div className="absolute inset-4 z-0 rounded-xl bg-gradient-to-br from-white/5 to-white/10 animate-pulse backdrop-blur-md" />
      )}
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className="relative z-10 transition-opacity duration-300"
        style={{
          maxWidth: '100%',
          maxHeight: '76vh',
          width: 'auto',
          height: 'auto',
          opacity: loaded ? 1 : 0,
          objectFit: 'contain'
        }}
      />
    </div>
  )
}
