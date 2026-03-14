import { getRequestConfig } from 'next-intl/server'

export default getRequestConfig(async () => {
  // Default locale for server-side rendering; client switches via NextIntlClientProvider
  const locale = 'he'
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: 'Asia/Jerusalem',
    now: new Date(),
  }
})
