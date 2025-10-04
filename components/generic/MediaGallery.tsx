"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PlayButton, GradientOverlay } from "@/components/ui/play-overlay";

export interface MediaItem { src: string; type: "image" | "video" }

interface MediaGalleryProps {
  title: string
  items: MediaItem[]
}

export function MediaGallery({ title, items }: MediaGalleryProps){
  const videos = items.filter(i => i.type === 'video')
  const images = items.filter(i => i.type === 'image').map(i => i.src)

  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [startIndex, setStartIndex] = useState(0)
  const [videoModal, setVideoModal] = useState<{ open:boolean; index:number|null }>({ open:false, index:null })

  function openImage(idx:number){ setStartIndex(idx); setLightboxOpen(true) }

  return (
      <section className="py-24 text-white"
    style={{
      background: 'bg-gradient-to-br from-zinc-900 to-zinc-700)'
    }}
    >
      <div className="container mx-auto px-4">
        {videos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {videos.map((v, idx) => (
              <div key={`vid-${idx}`} className="relative w-full h-[65vh] sm:h-[70vh] lg:h-[80vh] overflow-hidden rounded-2xl">
                <VideoReel src={v.src} poster={v.src.replace(/\.(mp4|webm)$/i, '.webp')} onOpen={()=> setVideoModal({ open:true, index: idx })} />
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((src, idx) => (
            <div key={idx} role="button" tabIndex={0} onClick={()=> openImage(idx)} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openImage(idx) } }} className="relative w-full h-64 overflow-hidden rounded-2xl hover:scale-105 transition-transform duration-300">
              <Image
                src={src}
                alt={`Image ${idx+1}`}
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

      {/* Image lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={(v)=> setLightboxOpen(v)}>
        <DialogContent className="max-w-[90vw] md:max-w-[80vw] w-full p-0 bg-[#0b1220] text-white border border-white/10">
          <DialogTitle className="sr-only">Gallery lightbox</DialogTitle>
          <DialogDescription className="sr-only">View image</DialogDescription>
          {lightboxOpen && images.length>0 && (
            <CustomLightbox images={images} startIndex={startIndex} />
          )}
        </DialogContent>
      </Dialog>

      {/* Video fullscreen modal */}
      <Dialog open={videoModal.open} onOpenChange={(v)=> setVideoModal(v ? videoModal : { open:false, index:null })}>
        <DialogContent className="max-w-[95vw] md:max-w-[90vw] w-full p-0 bg-black text-white border border-white/10">
          <DialogTitle className="sr-only">נגן וידאו • Видеоплеер • Video player</DialogTitle>
          <DialogDescription className="sr-only">צפייה במסך מלא • Просмотр на весь экран • Fullscreen playback</DialogDescription>
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
  )
}

function CustomLightbox({ images, startIndex }: { images: string[]; startIndex: number }){
  const [idx, setIdx] = useState(startIndex)
  useEffect(()=>{ setIdx(startIndex) }, [startIndex])
  function prev(){ setIdx(i => (i - 1 + images.length) % images.length) }
  function next(){ setIdx(i => (i + 1) % images.length) }
  if (images.length === 1){
    return (
      <div className="relative w-full h-[80vh] flex items-center justify-center">
        <ModalImage src={images[0]} alt="Image" eager />
      </div>
    )
  }
  const current = images[idx]
  return (
    <div className="relative w-full h-[80vh] flex items-center justify-center select-none">
      <button aria-label="Prev" onClick={prev} className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white text-4xl z-20">‹</button>
      <button aria-label="Next" onClick={next} className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white text-4xl z-20">›</button>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/70 z-20">{idx + 1} / {images.length}</div>
      <ModalImage src={current} alt={`Image ${idx + 1}`} eager />
    </div>
  )
}

function VideoReel({ src, poster, onOpen }: { src: string; poster?: string; onOpen?: (src:string)=>void }){
  const ref = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    el.muted = true; el.playsInline = true; el.loop = true
    const onLeave = () => { el.pause(); el.currentTime = 0; setIsPlaying(false) }
    const io = new IntersectionObserver((entries) => { entries.forEach(entry => { if (!entry.isIntersecting) onLeave() }) }, { threshold: 0.5 })
    io.observe(el); return () => { io.disconnect(); onLeave() }
  }, [])
  function handlePlay(){ if (onOpen){ onOpen(src); return } }
  return (
    <div className="absolute inset-0">
      <video ref={ref} src={videoSrc ?? undefined} preload="none" poster={poster} className="w-full h-full object-cover" />
      <GradientOverlay />
      <div className={`absolute inset-0 flex items-center justify-center`}>
        <PlayButton onClick={handlePlay} />
      </div>
    </div>
  )
}

function ModalImage({ src, alt, eager = false }: { src: string; alt: string; eager?: boolean }){
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="relative w-full h-full flex items-center justify-center p-4 bg-black/20">
      {!loaded && (<div className="absolute inset-4 z-0 rounded-xl bg-gradient-to-br from-white/5 to-white/10 animate-pulse backdrop-blur-md" />)}
      <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} className="relative z-10 transition-opacity duration-300" style={{ maxWidth:'100%', maxHeight:'76vh', width:'auto', height:'auto', opacity: loaded ? 1 : 0, objectFit:'contain' }} />
    </div>
  )
}


