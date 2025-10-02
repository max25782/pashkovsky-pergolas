'use client'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
export function ThemeToggle(){
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(()=> setMounted(true), [])
  if(!mounted) return null
  return (
    <button onClick={()=> setTheme(theme === 'dark' ? 'light' : 'dark')} className="ml-2 px-3 py-2 rounded-xl border border-white/20 hover:bg-white/10 text-sm font-bold">
      {theme==='dark'?'☀︎':'☾'}
    </button>
  )
}
