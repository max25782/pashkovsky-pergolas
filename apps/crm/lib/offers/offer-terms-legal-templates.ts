import type { PdfLocale } from '@/lib/pdf/pdf-locale'

export interface OfferTermsLegalLocaleBlock {
  introTitle: string
  introSubtitle: string
  executionTitle: string
  executionItems: string[]
  scheduleTitle: string
  scheduleItems: string[]
  paymentTitle: string
  paymentIntro: string
  paymentOptions: string
  paymentRefund: string
  licensingTitle: string
  licensingItems: string[]
  warrantyTitle: string
  warrantyNote: string
  footerLine: string
}

export type OfferTermsLegalBlocks = Record<'he' | 'en' | 'ru', OfferTermsLegalLocaleBlock>

export function buildOfferTermsLegalBlocks(params: {
  advancePercent: number
  remainingPercent: number
  workingDaysFromAdvance: number
}): OfferTermsLegalBlocks {
  const { advancePercent, remainingPercent, workingDaysFromAdvance: d } = params

  const he: OfferTermsLegalLocaleBlock = {
    introTitle: 'תנאים כלליים — הצעת מחיר',
    introSubtitle: 'Pashkovsky Group · פתרונות אלומיניום',
    executionTitle: '1. תנאי ביצוע',
    executionItems: [
      'תחילת ייצור מותנית בביצוע מדידות סופיות בשטח, לאחר סיום טיח, חיפוי וריצוף בנקודות העיגון.',
      'באחריות המזמין לספק חשמל קבוע או זמני ותאורה מספקת באזור ההתקנה, וכן גישה נוחה ובטוחה לפריקת סחורה.',
      'העלאת סחורה לקומות, שימוש במנוף או עגורן, ואספקת פיגומים תקניים — באחריות המזמין ועל חשבונו.',
      'אזור ההתקנה יימסר נקי מפסולת בניין ופנוי מעבודות קבלנים אחרים.',
      'בפרגולות חשמליות ותאורה — הבאת נקודת חשמל וחיבור ללוח הם באחריות חשמלאי מוסמך מטעם המזמין.',
      'המחירים כוללים אספקה והתקנה, אלא אם צוין אחרת במפורש.',
    ],
    scheduleTitle: '2. לוח זמנים ואספקה',
    scheduleItems: [
      `זמן אספקה והתקנה: עד ${d} ימי עבודה ממועד אישור תוכניות סופי, לאחר מוכנות השטח וקבלת המקדמה — המאוחר מביניהם.`,
      'החברה לא תישא באחריות לעיכובים הנובעים מכוח עליון, מלחמה, עיכובי נמל, שביתות, או אי-מוכנות האתר מצד המזמין.',
      'שינויים בהזמנה לאחר אישורה עשויים לגרור עדכון מחיר ולוח זמנים, ויאושרו בכתב בלבד.',
    ],
    paymentTitle: '3. תנאי תשלום',
    paymentIntro: 'התשלום מחולק לשני שלבים:',
    paymentOptions:
      'אופציות תשלום: העברה בנקאית · אשראי · שיקים · הוראת קבע — בהתאם למדיניות החברה.',
    paymentRefund: 'לאחר תחילת ייצור מוצר המותאם אישית לפי מידות הלקוח — לא יינתן החזר כספי.',
    licensingTitle: '4. רישוי ואחריות משפטית',
    licensingItems: [
      'אחריות על היתרי בנייה ואישורי קונסטרוקטור לעומסי המבנה ולנקודות העיגון — חלה על המזמין בלבד.',
      'Pashkovsky Group אינה אחראית לנושאי רישוי מול הרשות המקומית. המזמין מתחייב לבצע את כל הבירורים הנדרשים.',
      'החברה אינה אחראית לנזקים בלתי צפויים כגון: פיצוצי צנרת, נזקי מים, גז, חשמל — באחריות המזמין להודיע מראש על מצבים אלו.',
      'על המזמין להודיע לחברת הביטוח שלו על התקנת מוצרי החברה, על מנת שיכוסו בפוליסת הביטוח.',
      'הצעה זו מהווה הערכה בלבד ואינה מחייבת עד לחתימה על הזמנה רשמית.',
    ],
    warrantyTitle: '5. אחריות על המוצרים',
    warrantyNote:
      'האחריות חלה על פגמי ייצור וחומר בלבד. אינה כוללת נזקי מזג אוויר חריג, שימוש לא נכון, או שינויים שבוצעו על-ידי צד שלישי.',
    footerLine: 'Pashkovsky Group · פתרונות אלומיניום · 052-449-4848 · office@pashkovskygroup.com',
  }

  const en: OfferTermsLegalLocaleBlock = {
    introTitle: 'General terms — commercial offer',
    introSubtitle: 'Pashkovsky Group · aluminum solutions',
    executionTitle: '1. Execution conditions',
    executionItems: [
      'Production starts only after final on-site measurements, once plaster, cladding and flooring are finished at anchoring points.',
      'The client must provide permanent or temporary power and adequate lighting at the installation area, plus safe and convenient access for unloading.',
      'Hoisting to upper floors, crane/lift use, and compliant scaffolding — client’s responsibility and cost.',
      'The installation area must be clear of construction waste and free of other contractors’ work.',
      'For electric pergolas and lighting — bringing power to the board is the responsibility of a licensed electrician appointed by the client.',
      'Prices include supply and installation unless explicitly stated otherwise.',
    ],
    scheduleTitle: '2. Schedule and delivery',
    scheduleItems: [
      `Supply and installation: up to ${d} working days from approval of final drawings, after site readiness and receipt of deposit — whichever is later.`,
      'The company is not liable for delays due to force majeure, war, port delays, strikes, or site unreadiness on the client’s side.',
      'Changes after order approval may require price and schedule updates and must be approved in writing only.',
    ],
    paymentTitle: '3. Payment terms',
    paymentIntro: 'Payment is in two stages:',
    paymentOptions:
      'Payment options: bank transfer · credit card · checks · standing order — per company policy.',
    paymentRefund:
      'After production begins of a product custom-made to the client’s measurements — no monetary refund.',
    licensingTitle: '4. Permits and legal liability',
    licensingItems: [
      'Building permits and structural engineer approvals for loads and anchor points — client’s sole responsibility.',
      'Pashkovsky Group is not responsible for licensing with the local authority. The client undertakes to perform all required checks.',
      'The company is not liable for unforeseen damage such as plumbing bursts, water, gas, or electrical damage — the client must report such conditions in advance.',
      'The client must inform their insurer about installation of the company’s products so they are covered by the policy.',
      'This offer is an estimate only and is not binding until a formal order is signed.',
    ],
    warrantyTitle: '5. Product warranty',
    warrantyNote:
      'Warranty covers manufacturing and material defects only. It excludes extreme weather damage, improper use, or modifications by a third party.',
    footerLine: 'Pashkovsky Group · aluminum solutions · 052-449-4848 · office@pashkovskygroup.com',
  }

  const ru: OfferTermsLegalLocaleBlock = {
    introTitle: 'Общие условия — коммерческое предложение',
    introSubtitle: 'Pashkovsky Group · алюминиевые решения',
    executionTitle: '1. Условия выполнения работ',
    executionItems: [
      'Запуск производства возможен только после финальных замеров на объекте, по завершении штукатурки, облицовки и напольного покрытия в точках крепления.',
      'Заказчик обеспечивает постоянное или временное электроснабжение и достаточное освещение зоны монтажа, а также удобный и безопасный подъезд для разгрузки.',
      'Подъём материала на этажи, работа крана/лифта и выставление нормативных лесов — за счёт и под ответственность заказчика.',
      'Площадка монтажа передаётся без строительного мусора и свободной от работ других подрядчиков.',
      'Для электрических пергол и освещения — подвод силы и подключение к щиту выполняет уполномоченный электрик заказчика.',
      'Цены включают поставку и монтаж, если иное явно не оговорено.',
    ],
    scheduleTitle: '2. Сроки и поставка',
    scheduleItems: [
      `Срок поставки и монтажа: до ${d} рабочих дней с даты утверждения финальных чертежей, после готовности объекта и получения предоплаты — по более поздней дате.`,
      'Компания не отвечает за задержки из-за форс-мажора, военных действий, задержек в порту, забастовок или неготовности объекта со стороны заказчика.',
      'Изменения заказа после утверждения могут повлечь пересмотр цены и сроков и допускаются только в письменной форме.',
    ],
    paymentTitle: '3. Условия оплаты',
    paymentIntro: 'Оплата в два этапа:',
    paymentOptions:
      'Способы оплаты: банковский перевод · карта · чеки · постоянное поручение — по политике компании.',
    paymentRefund:
      'После начала производства изделия по индивидуальным размерам заказчика денежный возврат не производится.',
    licensingTitle: '4. Разрешения и юридическая ответственность',
    licensingItems: [
      'Разрешения на строительство и заключения инженера по нагрузкам и точкам крепления — только обязанность заказчика.',
      'Pashkovsky Group не отвечает за согласования с местными органами власти. Заказчик обязуется выполнить все необходимые проверки.',
      'Компания не несёт ответственности за непредвиденные повреждения (прорыв трубопровода, вода, газ, электрика) — заказчик заранее информирует о таких условиях.',
      'Заказчик обязан уведомить свою страховую компанию об установке продукции, чтобы она была включена в полис.',
      'Настоящее предложение носит оценочный характер и обязательно только после подписания официального заказа.',
    ],
    warrantyTitle: '5. Гарантия на продукцию',
    warrantyNote:
      'Гарантия распространяется только на дефекты производства и материала. Не покрывает экстремальную погоду, неправильное использование или вмешательство третьих лиц.',
    footerLine: 'Pashkovsky Group · алюминиевые решения · 052-449-4848 · office@pashkovskygroup.com',
  }

  void advancePercent
  void remainingPercent
  return { he, en, ru }
}

export function pickOfferTermsLegalBlock(
  locale: PdfLocale,
  blocks: OfferTermsLegalBlocks,
): OfferTermsLegalLocaleBlock {
  if (locale === 'he') return blocks.he
  if (locale === 'ru') return blocks.ru
  return blocks.en
}
