"use client"
import * as React from 'react'
import clsx from 'clsx'
export function Button({ className, variant='default', ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default'|'primary' }){
  return (
    <button
      className={clsx(
        'px-5 py-3 rounded-xl font-extrabold border transition shadow',
        variant==='primary'
          ? 'bg-gradient-to-br from-brand-blue to-blue-600 text-white border-transparent hover:opacity-95'
          : 'bg-white/10 text-white border-white/10 hover:bg-white/15',
        className
      )}
      {...props}
    />
  )
}
