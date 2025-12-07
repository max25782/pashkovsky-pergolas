import type { Metadata } from 'next'
import { Suspense } from 'react'
import projects from '@/data/gallery/pergulot.json'
import Image from 'next/image'
import { getImageUrl } from '@/lib/image-url'

type Locale = 'he' | 'ru' | 'en'

interface Project {
  id: string
  title: { he: string; ru: string; en: string }
  desc: { he: string; ru: string; en: string }
  images: string[]
}

function getAllProjects(): Project[] {
  return (projects as { projects: Project[] }).projects
}

function getProjectById(id: string): Project | undefined {
  return getAllProjects().find(p => p.id === id)
}

export async function generateStaticParams() {
  const locales: Locale[] = ['he','ru','en']
  const ids = getAllProjects().map(p => p.id)
  return locales.flatMap(locale => ids.map(id => ({ locale, id })))
}

export async function generateMetadata({ params }: { params: { id: string; locale: Locale } }): Promise<Metadata> {
  const pergola = getProjectById(params.id)
  const titleHe = pergola?.title.he ?? params.id
  const descHe = pergola?.desc.he ?? ''
  const cover = pergola?.images?.[0] ? getImageUrl(pergola.images[0]) : undefined
  const canonical = `https://pashkovsky-group.com/${params.locale}/pergulas/${params.id}`

  return {
    title: `פרגולת ${titleHe} | Pashkovski Group` as any,
    description: descHe,
    alternates: { canonical },
    openGraph: {
      title: `פרגולת ${titleHe}`,
      description: descHe,
      images: cover ? [{ url: cover }] : undefined,
      url: canonical,
    },
  }
}

export default function PergulaProjectPage({ params }: { params: { id: string; locale: Locale } }){
  const project = getProjectById(params.id)
  if (!project) return null
  const locale = params.locale
  const t = (he: string, ru: string, en: string) => (locale === 'he' ? he : locale === 'ru' ? ru : en)
  const title = project.title[locale] ?? project.title.he
  const desc = project.desc[locale] ?? project.desc.he

  return (
    <Suspense fallback={<main className="container py-12"><div className="h-64 rounded-xl bg-white/5" /></main>}>
      <main className="container py-12">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-4 text-white">{title}</h1>
        <p className="text-white/80 mb-8">{desc}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {project.images.map((src) => (
            <div key={src} className="relative w-full aspect-[4/3] rounded-xl overflow-hidden">
              <Image src={getImageUrl(src)} alt={title} fill className="object-cover" sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw" />
            </div>
          ))}
        </div>
      </main>
    </Suspense>
  )
}


