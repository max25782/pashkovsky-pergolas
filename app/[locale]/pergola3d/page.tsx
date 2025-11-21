import type { Locale } from '@/lib/locales'
import dynamic from 'next/dynamic'
import React from 'react'

const Pergola3D = dynamic(() => import('@/components/pergola-configurator/Pergola3D'), { ssr: false })

export default function Page({ params }: { params: { locale: Locale } }) {
  return (
    <main className="w-full">
      <Pergola3D locale={params.locale} />
    </main>
  )
}
