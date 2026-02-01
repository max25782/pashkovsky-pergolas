import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import projects from '@/data/gallery/pergulot.json'
import Image from 'next/image'
import { getImageUrl, getOgImageUrl } from '@/lib/image-url'

type Locale = 'he' | 'ru' | 'en'

interface Project {
  id: string
  title: { he: string; ru: string; en: string }
  desc: { he: string; ru: string; en: string }
  images: string[]
}

// Allow dynamic params for projects that might not exist
export const dynamicParams = true

function getAllProjects(): Project[] {
  return (projects as { projects: Project[] }).projects
}

function getProjectById(id: string): Project | undefined {
  return getAllProjects().find(p => p.id === id)
}

export async function generateStaticParams() {
  try {
    const locales: Locale[] = ['he','ru','en']
    const projects = getAllProjects()
    const ids = projects
      .filter(p => p && p.id && p.images && p.images.length > 0) // Only valid projects
      .map(p => p.id)
    return locales.flatMap(locale => ids.map(id => ({ locale, id })))
  } catch (error) {
    console.error('Error generating static params for pergulas:', error)
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string; locale: Locale }> }): Promise<Metadata> {
  const { id, locale } = await params
  try {
    const pergola = getProjectById(id)
    if (!pergola) {
      return {
        title: 'Project Not Found | Pashkovski Group',
        description: '',
      }
    }
    
    const titleHe = pergola.title.he ?? id
    const descHe = pergola.desc.he ?? ''
    const coverPath = pergola.images?.[0]
    const cover = coverPath ? getOgImageUrl(coverPath) : undefined
    const canonical = `https://pashkovsky-group.com/${locale}/pergulas/${id}`

    return {
      title: `פרגולת ${titleHe} | Pashkovski Group` as any,
      description: descHe,
      alternates: {
        canonical,
        languages: {
          'he': `https://pashkovsky-group.com/he/pergulas/${id}`,
          'ru': `https://pashkovsky-group.com/ru/pergulas/${id}`,
          'en': `https://pashkovsky-group.com/en/pergulas/${id}`,
        },
      },
      openGraph: {
        title: `פרגולת ${titleHe}`,
        description: descHe,
        images: cover ? [{ url: cover, width: 1200, height: 630 }] : undefined,
        url: canonical,
      },
      twitter: {
        card: 'summary_large_image',
        title: `פרגולת ${titleHe}`,
        description: descHe,
        images: cover ? [cover] : undefined,
      },
    }
  } catch (error) {
    console.error('Error generating metadata for pergula:', id, error)
    return {
      title: 'Project | Pashkovski Group',
      description: '',
    }
  }
}

export default async function PergulaProjectPage({ params }: { params: Promise<{ id: string; locale: Locale }> }){
  const { id, locale: localeParam } = await params
  const project = getProjectById(id)
  
  if (!project) {
    notFound()
  }
  
  const locale = localeParam
  const title = project.title[locale] ?? project.title.he
  const desc = project.desc[locale] ?? project.desc.he

  return (
    <Suspense fallback={<main className="container py-12"><div className="h-64 rounded-xl bg-white/5" /></main>}>
      <main className="container py-12">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-4 text-white">{title}</h1>
        <p className="text-white/80 mb-8">{desc}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {project.images && project.images.length > 0 ? (
            project.images.map((src, index) => {
              if (!src) return null
              try {
                const imageUrl = getImageUrl(src)
                return (
                  <div key={`${src}-${index}`} className="relative w-full aspect-[4/3] rounded-xl overflow-hidden">
                    <Image 
                      src={imageUrl} 
                      alt={`${title} - Image ${index + 1}`} 
                      fill 
                      className="object-cover" 
                      sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                      loading="lazy"
                      unoptimized
                    />
                  </div>
                )
              } catch (error) {
                console.error(`Error loading image ${src}:`, error)
                return null
              }
            })
          ) : (
            <div className="col-span-full text-center text-white/60 py-8">
              No images available
            </div>
          )}
        </div>
      </main>
    </Suspense>
  )
}


