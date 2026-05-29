import { Locale } from '@/lib/locales'
import { getOgImageUrl } from '@/lib/image-url'
import { OG_IMAGE_PATH, SITE_URL } from '@/lib/site-url'

interface StructuredDataProps {
  locale: Locale
}

export function StructuredData({ locale }: StructuredDataProps) {
  const baseUrl = SITE_URL
  const ogImageUrl = getOgImageUrl(OG_IMAGE_PATH)
  
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Pashkovsky Group',
    url: baseUrl,
    logo: `${baseUrl}/icon.svg`,
    description: locale === 'ru' 
      ? 'Специализация на производстве и установке пергол, перил и экранов высочайшего качества в Израиле с 2019 года'
      : locale === 'en'
      ? 'Specializing in manufacturing and installation of pergolas, railings and screens of the highest quality in Israel since 2019'
      : 'מאז 2019 מתמחה בייצור והתקנה של פרגולות, מעקות ומסתורים באיכות הגבוהה ביותר בישראל',
    foundingDate: '2019',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'IL',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      availableLanguage: ['Hebrew', 'Russian', 'English'],
    },
    sameAs: [],
  }

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${baseUrl}#organization`,
    name: 'Pashkovsky Group',
    image: ogImageUrl,
    url: baseUrl,
    telephone: '',
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'IL',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 31.7683,
      longitude: 35.2137,
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
      ],
      opens: '08:00',
      closes: '18:00',
    },
  }

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Pashkovsky Group',
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
    </>
  )
}
