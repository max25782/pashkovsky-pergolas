"use client"
import { useRef, useState } from 'react'
import { RotatingImage } from './rotating-image'
import { ModelLightbox } from '@/components/dgamim/model-lightbox'
import dgamim from '@/data/gallery/dgamim.json'
import { dgamimInfo } from '@/data/dgamim-info'

interface DgamimItem { type: string; degem: string; images: string[] }

export function DgamimCarousel(){
  const items = (dgamim as { items: DgamimItem[] }).items
  if (!items?.length) return null

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragState = useRef<{ startX:number; scrollLeft:number }|null>(null)
  const [lightbox, setLightbox] = useState<{ open:boolean; images:string[]; start:number }>({ open:false, images:[], start:0 })

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        dir="rtl"
        className={`${isDragging ? 'cursor-grabbing' : 'cursor-grab'} select-none flex gap-4 overflow-x-auto scrollbar-hide pb-4 snap-x snap-mandatory`}
        onMouseDown={(e)=>{
          const el = containerRef.current
          if (!el) return
          setIsDragging(true)
          dragState.current = { startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft }
        }}
        onMouseLeave={()=>{ setIsDragging(false); dragState.current = null }}
        onMouseUp={()=>{ setIsDragging(false); dragState.current = null }}
        onMouseMove={(e)=>{
          const el = containerRef.current
          if (!el || !dragState.current) return
          e.preventDefault()
          const x = e.pageX - el.offsetLeft
          const walk = (x - dragState.current.startX) * 2
          el.scrollLeft = dragState.current.scrollLeft - walk
        }}
        onWheel={(e)=>{
          const el = containerRef.current
          if (!el) return
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY
        }}
      >
        {items
          .slice()
          .sort((a, b) => {
            const ai = dgamimInfo[a.degem.toLowerCase()]
            const bi = dgamimInfo[b.degem.toLowerCase()]
            const ap = ai?.price ? parseInt(ai.price.replace(/[^0-9]/g, '')) : Number.MAX_SAFE_INTEGER
            const bp = bi?.price ? parseInt(bi.price.replace(/[^0-9]/g, '')) : Number.MAX_SAFE_INTEGER
            return ap - bp
          })
          .map((item, i)=>{
          const info = dgamimInfo[item.degem.toLowerCase()] || {
            title: item.degem,
            description: item.type,
            price: ''
          }
          return (
            <div key={`${item.type}-${item.degem}-${i}`} className="flex-none w-[85%] sm:w-[70%] md:w-1/2 lg:w-1/3 rounded-2xl overflow-hidden border border-white/10 bg-white/5">
              <div className="relative h-[50vh] sm:h-[60vh] lg:h-[70vh] bg-gray-800">
                <button aria-label="Open images" className="absolute inset-0 z-10" onClick={()=> setLightbox({ open:true, images:item.images, start:0 })} />
                <RotatingImage sources={item.images} alt={`${item.type} - ${item.degem}`} intervalMs={1000} priority={i < 2} />
              </div>
              <div className="p-4 text-right">
                <div className="font-extrabold">{info.title}</div>
                <div className="text-sm text-white/70 mt-1 leading-relaxed">{info.description}</div>
                {info.price && <div className="mt-2 text-sm font-bold text-white/90">{info.price}</div>}
              </div>
            </div>
          )
        })}
        <ModelLightbox open={lightbox.open} images={lightbox.images} startIndex={lightbox.start} onClose={()=> setLightbox({ open:false, images:[], start:0 })} />
      </div>
    </div>
  )
}
