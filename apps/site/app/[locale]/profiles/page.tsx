import Image from 'next/image'
import fs from 'fs'
import path from 'path'
import ContactSection from '@/components/contact-section'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import type { Locale } from '@/lib/locales'

interface ProfilesPageProps {
  params: Promise<{
    locale: Locale
  }>
}

const S3_BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME
const S3_REGION = process.env.NEXT_PUBLIC_AWS_S3_REGION || 'eu-north-1'

function getS3Client() {
  if (!S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return null
  }
  
  return new S3Client({
    region: S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
}

async function getProfilesImages(): Promise<Map<string, string>> {
  const s3Client = getS3Client()
  const imageMap = new Map<string, string>()
  
  if (!S3_BUCKET || !s3Client) {
    console.log('[Profiles] S3 not configured')
    return imageMap
  }

  try {
    const prefix = 'images/profiles/'
    console.log(`[Profiles] Fetching from S3: bucket=${S3_BUCKET}, region=${S3_REGION}, prefix=${prefix}`)
    
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
    })

    const response = await s3Client.send(command)
    const contents = response.Contents || []
    
    console.log(`[Profiles] S3 response: ${contents.length} total objects`)
    
    // Create map: filename -> full S3 URL
    contents.forEach(item => {
      const key = item.Key || ''
      if (/\.(webp|jpg|jpeg|png|gif)$/i.test(key)) {
        const filename = path.basename(key)
        const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`
        imageMap.set(filename, url)
        // Also map without extension for flexibility
        const nameWithoutExt = path.basename(key, path.extname(key))
        imageMap.set(nameWithoutExt, url)
      }
    })
    
    console.log(`[Profiles] Mapped ${imageMap.size} images from S3`)
  } catch (error: any) {
    console.error('[Profiles] Error fetching from S3:', {
      message: error.message,
      code: error.Code || error.code,
      name: error.name,
    })
  }
  
  return imageMap
}

export default async function ProfilesPage({ params }: ProfilesPageProps) {
  const { locale } = await params
  
  // Fetch images directly from S3 (like railings page)
  const s3ImageMap = await getProfilesImages()
  
  // Read metadata from JSON
  const profilesJsonPath = path.join(process.cwd(), 'public', 'data', 'profiles.json')
  let profilesMeta: Array<any> = []
  try {
    const profilesData = JSON.parse(fs.readFileSync(profilesJsonPath, 'utf-8'))
    profilesMeta = Array.isArray(profilesData?.profiles) ? profilesData.profiles : []
  } catch {}

  // Match JSON metadata with S3 images
  const items = profilesMeta
    .map((meta: any, index: number) => {
      const imagePath = meta?.image || ''
      let s3Url = ''
      
      if (imagePath) {
        // Try to find image in S3 map
        const filename = path.basename(imagePath)
        const nameWithoutExt = path.basename(imagePath, path.extname(imagePath))
        
        // Try exact filename match
        s3Url = s3ImageMap.get(filename) || ''
        
        // Try without -300x200 suffix
        if (!s3Url && filename.includes('-300x200')) {
          const baseName = filename.replace('-300x200', '')
          s3Url = s3ImageMap.get(baseName) || s3ImageMap.get(path.basename(baseName, path.extname(baseName))) || ''
        }
        
        // Try name without extension
        if (!s3Url) {
          s3Url = s3ImageMap.get(nameWithoutExt) || ''
        }
      }
      
      return {
        id: meta?.id || path.basename(imagePath, path.extname(imagePath)),
        uniqueKey: `profile-${index}-${meta?.id || 'unknown'}`,
        image: s3Url,
        name: meta?.name?.[locale] || meta?.name?.he || '',
        dimensions: meta?.dimensions || '',
        description: meta?.description?.[locale] || meta?.description?.he || '',
      }
    })
    .filter((item: any) => item.image) // Only include items with valid S3 URLs

  const t = {
    he: {
      title: 'פרופילים אלומיניום',
      subtitle: 'מגוון רחב של פרופילי אלומיניום איכותיים לכל צורך - מפרגולות ומעקות ועד תאורה ועיצוב'
    },
    ru: {
      title: 'Алюминиевые профили',
      subtitle: 'Широкий ассортимент качественных алюминиевых профилей для любых нужд - от пергол и ограждений до освещения и дизайна'
    },
    en: {
      title: 'Aluminum Profiles',
      subtitle: 'Wide range of quality aluminum profiles for any need - from pergolas and railings to lighting and design'
    }
  }

  return (
    <main 
      className="min-h-screen text-white py-20"
      style={{
        background: 'linear-gradient(180deg, rgba(10, 10, 10, 1) 21%, rgba(23, 23, 23, 0.5) 100%)',
        backgroundColor: 'rgba(0, 0, 0, 1)'
      }}
    >
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6">
            {t[locale].title}
          </h1>
          <p className="text-xl text-white/70 max-w-3xl mx-auto">
            {t[locale].subtitle}
          </p>
        </div>

        {/* Profiles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {items.map((profile: any) => (
            <div
              key={profile.uniqueKey}
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
        <ContactSection locale={locale} />
      </div>
    </main>
  )
}

