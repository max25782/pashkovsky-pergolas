import { getTranslations } from 'next-intl/server'
import { ACCESSIBILITY_COORDINATOR, ACCESSIBILITY_LAST_UPDATED } from '@/lib/accessibility'

export default async function AccessibilityStatement() {
  const t = await getTranslations('accessibility')

  const measures = [
    t('measure1'),
    t('measure2'),
    t('measure3'),
    t('measure4'),
    t('measure5'),
    t('measure6'),
  ]

  const limitations = [t('limitation1'), t('limitation2'), t('limitation3')]

  return (
    <main id="main-content" className="min-h-screen bg-[#0c0c14] text-white pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold mb-8 font-syne">{t('title')}</h1>

        <div className="space-y-8 text-text-2">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4 font-syne">{t('section1Title')}</h2>
            <p className="leading-relaxed">{t('section1Body')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4 font-syne">{t('section2Title')}</h2>
            <p className="leading-relaxed">{t('section2Body')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4 font-syne">{t('section3Title')}</h2>
            <ul className="space-y-2">
              <li><strong className="text-white">{t('coordinatorName')}:</strong> {ACCESSIBILITY_COORDINATOR.name}</li>
              <li><strong className="text-white">{t('coordinatorRole')}:</strong> {ACCESSIBILITY_COORDINATOR.role}</li>
              <li>
                <strong className="text-white">{t('coordinatorPhone')}:</strong>{' '}
                <a href={`tel:${ACCESSIBILITY_COORDINATOR.phone}`} className="text-violet-300 hover:text-violet-200 underline">
                  {ACCESSIBILITY_COORDINATOR.phone}
                </a>
              </li>
              <li>
                <strong className="text-white">{t('coordinatorEmail')}:</strong>{' '}
                <a href={`mailto:${ACCESSIBILITY_COORDINATOR.email}`} className="text-violet-300 hover:text-violet-200 underline">
                  {ACCESSIBILITY_COORDINATOR.email}
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4 font-syne">{t('section4Title')}</h2>
            <p className="leading-relaxed">{t('section4Body')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4 font-syne">{t('section5Title')}</h2>
            <ul className="list-disc list-inside space-y-2">
              {measures.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4 font-syne">{t('section6Title')}</h2>
            <ul className="list-disc list-inside space-y-2">
              {limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4 font-syne">{t('section7Title')}</h2>
            <p className="leading-relaxed">{t('section7Body')}</p>
          </section>

          <div className="pt-8 border-t border-white/10">
            <p className="text-sm text-text-2">{t('lastUpdated', { date: ACCESSIBILITY_LAST_UPDATED })}</p>
          </div>
        </div>
      </div>
    </main>
  )
}
