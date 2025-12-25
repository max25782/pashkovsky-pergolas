"use client";
import { useState } from "react";
import videos from "@/data/gallery/videos.json";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlayButton, GradientOverlay } from "@/components/ui/play-overlay";

interface Item { src: string; poster?: string | null }

export function VideoGallery(){
  const items = (videos as { items: Item[] }).items
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<Item | null>(null)

  function openVideo(item: Item){ setCurrent(item); setOpen(true) }

  return (
    <section className="py-16">
      <div className="container">
        <h2 className="text-2xl font-bold mb-6">וידאו שלנו</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it, i) => (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={()=> openVideo(it)}
              onKeyDown={(e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openVideo(it) } }}
              aria-label="Play video"
              className="relative w-full h-[60vh] sm:h-[70vh] lg:h-[80vh] rounded-2xl overflow-hidden group bg-black/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
            >
              {it.poster ? (
                <img src={it.poster} alt="poster" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-white/60">No poster</div>
              )}
              <GradientOverlay />
              <div className="absolute inset-0 flex items-center justify-center">
                <PlayButton />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={(v)=> setOpen(v)}>
        <DialogContent className="max-w-[95vw] md:max-w-[90vw] w-full p-0 bg-black text-white border border-white/10">
          <DialogTitle className="sr-only">Video player</DialogTitle>
          <DialogDescription className="sr-only">Watch video</DialogDescription>
          {open && current && (
            <div className="w-full h-[85vh] flex items-center justify-center bg-black">
              <video src={current.src} autoPlay controls className="max-w-full max-h-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}


