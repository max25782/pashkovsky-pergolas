'use client'
import Image from 'next/image'
import type { ImageData } from '@/types/images'

export default function Carousel({ images }: { images: ImageData[] }){
  return (
    <div className="w-full">
      <div 
        className="flex gap-4 pb-4 overflow-x-auto"
        style={{
          scrollbarWidth: 'thin',
          cursor: 'grab',
          userSelect: 'none'
        }}
        onMouseDown={(e) => {
          const ele = e.currentTarget
          ele.style.cursor = 'grabbing'
          const startX = e.pageX - ele.offsetLeft
          const scrollLeft = ele.scrollLeft

          const handleMouseMove = (e: MouseEvent) => {
            const x = e.pageX - ele.offsetLeft
            const walk = (x - startX) * 2
            ele.scrollLeft = scrollLeft - walk
          }

          const handleMouseUp = () => {
            ele.style.cursor = 'grab'
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
          }

          document.addEventListener('mousemove', handleMouseMove)
          document.addEventListener('mouseup', handleMouseUp)
        }}
      >
        {images.map((img, i)=>(
          <div 
            key={i} 
            className="flex-none w-[85%] sm:w-[70%] md:w-1/2 lg:w-1/3 rounded-2xl overflow-hidden border border-white/10 bg-white/5"
            draggable="false"
          >
            <div className="relative w-full h-[60vh] sm:h-[70vh] lg:h-[80vh]">
              <Image 
                src={img.src} 
                alt={img.title || 'Pergola'} 
                fill 
                className="object-cover pointer-events-none"
                sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 85vw"
                unoptimized
                draggable="false"
              />
            </div>
            {(img.title || img.desc) && (
              <div className="p-4">
                <div className="font-bold">{img.title}</div>
                {img.desc && <div className="text-sm text-white/70 mt-1">{img.desc}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
