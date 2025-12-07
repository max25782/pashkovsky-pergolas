import type { Locale } from '@/lib/locales'
import Image from 'next/image'
import fs from 'fs'
import path from 'path'
import ContactSection from '@/components/contact-section'
import { getImageUrl } from '@/lib/image-url'

export default function ProfilesPage({ params }: { params: { locale: Locale } }) {
  const locale = params.locale || 'he'
  
  // Читаем метаданные (если есть)
  const profilesJsonPath = path.join(process.cwd(), 'public', 'data', 'profiles.json')
  let profilesMeta: Array<any> = []
  try {
    const profilesData = JSON.parse(fs.readFileSync(profilesJsonPath, 'utf-8'))
    profilesMeta = Array.isArray(profilesData?.profiles) ? profilesData.profiles : []
  } catch {}

  // Сканы папки с изображениями, чтобы показать ВСЕ картинки
  const dir = path.join(process.cwd(), 'public', 'images', 'profiles')
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .sort()

  // Индексация метаданных по имени файла (basename)
  const metaByBasename = new Map<string, any>()
  for (const m of profilesMeta) {
    const base = m?.image ? path.basename(m.image) : undefined
    if (base) metaByBasename.set(base, m)
  }

  const items = files.map((file) => {
    const meta = metaByBasename.get(file)
    const fallbackName = file.replace(/\.[^.]+$/, '')
    return {
      id: meta?.id || fallbackName,
      image: getImageUrl(`/images/profiles/${file}`),
      name: meta?.name || { he: fallbackName, ru: fallbackName, en: fallbackName },
      dimensions: meta?.dimensions || '',
      description:
        meta?.description || { he: '', ru: '', en: '' },
    }
  })

  const t = (he: string, ru: string, en: string) => {
    if (locale === 'ru') return ru
    if (locale === 'en') return en
    return he
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900 text-white py-20">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6">
            {t('פרופילים אלומיניום', 'Алюминиевые профили', 'Aluminum Profiles')}
          </h1>
          <p className="text-xl text-white/70 max-w-3xl mx-auto">
            {t(
              'מגוון רחב של פרופילי אלומיניום איכותיים לכל צורך - מפרגולות ומעקות ועד תאורה ועיצוב',
              'Широкий выбор качественных алюминиевых профилей для любых нужд - от пергол и перил до освещения и дизайна',
              'Wide range of quality aluminum profiles for every need - from pergolas and railings to lighting and design'
            )}
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
                  alt={profile.name[locale]}
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
                <h3 className="text-xl font-bold mb-2">{profile.name[locale]}</h3>
                {profile.dimensions && (
                  <p className="text-blue-400 text-sm font-semibold mb-3">{profile.dimensions}</p>
                )}
                {profile.description?.[locale]?.trim() && (
                  <p className="text-white/70 text-sm leading-relaxed">{profile.description[locale]}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <ContactSection locale={locale} />
      </div>
    </main>
  )
}

