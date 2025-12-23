import Image from 'next/image'
import fs from 'fs'
import path from 'path'
import ContactSection from '@/components/contact-section'
import { getImageUrl } from '@/lib/image-url'

export default function ProfilesPage() {
  // CRM pages use Hebrew by default
  
  // Читаем метаданные из JSON (изображения теперь в S3)
  const profilesJsonPath = path.join(process.cwd(), 'public', 'data', 'profiles.json')
  let profilesMeta: Array<any> = []
  try {
    const profilesData = JSON.parse(fs.readFileSync(profilesJsonPath, 'utf-8'))
    profilesMeta = Array.isArray(profilesData?.profiles) ? profilesData.profiles : []
  } catch {}

  // Используем только данные из JSON (изображения уже в S3)
  const items = profilesMeta.map((meta: any) => {
    const imagePath = meta?.image || ''
    return {
      id: meta?.id || path.basename(imagePath, path.extname(imagePath)),
      image: imagePath ? getImageUrl(imagePath) : '',
      name: meta?.name?.he || '',
      dimensions: meta?.dimensions || '',
      description: meta?.description?.he || '',
    }
  }).filter((item: any) => item.image) // Фильтруем только те, у которых есть изображение

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900 text-white py-20">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6">
            פרופילים אלומיניום
          </h1>
          <p className="text-xl text-white/70 max-w-3xl mx-auto">
            מגוון רחב של פרופילי אלומיניום איכותיים לכל צורך - מפרגולות ומעקות ועד תאורה ועיצוב
          </p>
        </div>

        {/* Profiles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {items.map((profile: any) => (
            <div
              key={profile.id}
              className="group bg-white/5 rounded-2xl overflow-hidden hover:bg-white/10 transition-all duration-300 hover:-translate-y-2"
            >
              {/* Image */}
              <div className="relative w-full h-48 bg-white/10 flex items-center justify-center">
                <Image
                  src={profile.image}
                  alt={profile.name}
                  width={300}
                  height={200}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  className="object-contain max-h-full max-w-full p-4"
                  loading="lazy"
                  unoptimized
                />
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">{profile.name}</h3>
                {profile.dimensions && (
                  <p className="text-blue-400 text-sm font-semibold mb-3">{profile.dimensions}</p>
                )}
                {profile.description?.trim() && (
                  <p className="text-white/70 text-sm leading-relaxed">{profile.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <ContactSection locale="he" />
      </div>
    </main>
  )
}

