import type { ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'

interface PlayButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg'
}

export function PlayButton({ size = 'md', className, ...props }: PlayButtonProps){
  const dim = size === 'sm' ? 'w-12 h-12' : size === 'lg' ? 'w-20 h-20' : 'w-16 h-16'
  const icon = size === 'sm' ? 18 : size === 'lg' ? 26 : 22
  return (
    <button
      aria-label={props['aria-label'] ?? 'Play'}
      {...props}
      className={clsx('relative inline-flex items-center justify-center rounded-full bg-white/90 text-black shadow-2xl transition-transform duration-300 hover:scale-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40', dim, className)}
    >
      <span className="absolute inline-flex h-full w-full rounded-full bg-white/60 opacity-40 blur-[1px] animate-ping" />
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="currentColor" className="relative">
        <path d="M8 5v14l11-7z" />
      </svg>
    </button>
  )
}

export function GradientOverlay(){
  return <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent pointer-events-none" />
}


