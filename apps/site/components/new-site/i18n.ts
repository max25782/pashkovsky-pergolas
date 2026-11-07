import type { Lang, Localized } from '@/config/siteTypes'

export type { Lang, Localized }

/** Pick the string for the active language. */
export function t(text: Localized, lang: Lang): string {
  return text[lang]
}

function L(he: string, en: string): Localized {
  return { he, en }
}

/** UI strings of the /new site (Hebrew default, English). Content data lives in config/. */
export const copy = {
  skip: L('דלג לתוכן הראשי', 'Skip to main content'),
  nav: {
    main: L('ניווט ראשי', 'Main navigation'),
    models: L('דגמים', 'Models'),
    works: L('עבודות', 'Work'),
    reviews: L('המלצות', 'Reviews'),
    contact: L('צור קשר', 'Contact'),
    quote: L('הצעת מחיר', 'Get a quote'),
    language: L('שפה', 'Language'),
    theme: L('החלפת ערכת צבעים', 'Switch light or dark theme'),
    call: L('התקשרו', 'Call us'),
  },
  hero: {
    title: L('פרגולות אלומיניום שנבנות בדיוק עבורכם', 'Aluminum pergolas built exactly for you'),
    sub: L('תכנון, ייצור והתקנה. הצעת מחיר אחרי שתי דקות.', 'Design, fabrication, installation. A quote in two minutes.'),
    cta1: L('חשבו מחיר ב־2 דקות', 'Get a price in 2 minutes'),
    cta2: L('לעבודות שלנו', 'See our work'),
    pause: L('עצירת הסרטון', 'Pause the video'),
    play: L('הפעלת הסרטון', 'Play the video'),
    mute: L('השתקת הסרטון', 'Mute the video'),
    unmute: L('הפעלת קול', 'Turn the sound on'),
    slot: L('חריץ וידאו: הגדירו siteMedia.hero.video', 'Video slot: set siteMedia.hero.video'),
  },
  sample: L('(דוגמה)', '(sample)'),
  models: {
    kick: L('דגמים', 'Models'),
    title: L('פרגולות לכל בית', 'A pergola for every home'),
    sub: L(
      'עברו עם העכבר או הקישו על תמונה כדי לפתוח אותה. גררו או השתמשו בחצים כדי לדפדף.',
      'Hover or tap a photo to open it. Drag or use the arrows to browse.',
    ),
    region: L('קרוסלת דגמים', 'Models carousel'),
    prev: L('הקודם', 'Previous'),
    next: L('הבא', 'Next'),
    pause: L('עצירת הגלילה האוטומטית', 'Pause automatic scrolling'),
    play: L('הפעלת גלילה אוטומטית', 'Resume automatic scrolling'),
  },
  works: {
    kick: L('עבודות', 'Work'),
    title: L('הפרויקטים שלנו', 'Our projects'),
    filter: L('סינון עבודות', 'Filter projects'),
    all: L('הכל', 'All'),
    pergola: L('פרגולות', 'Pergolas'),
    rail: L('מעקות', 'Railings'),
    fence: L('גדרות', 'Fences'),
    glass: L('זכוכית', 'Glass'),
  },
  reviews: {
    kick: L('המלצות', 'Reviews'),
    title: L('מה הלקוחות אומרים', 'What clients say'),
    play: L('הפעלת סרטון המלצה', 'Play review video'),
    noVideo: L('אין סרטון עדיין', 'No video yet'),
  },
  process: {
    kick: L('תהליך', 'Process'),
    title: L('מהמדידה ועד ההתקנה', 'From measuring to installing'),
    steps: [
      { title: L('מדידה', 'Measure'), text: L('מגיעים אליכם ומודדים.', 'We visit and measure the site.') },
      { title: L('תכנון והצעה', 'Plan and quote'), text: L('שרטוט ומחיר ברור.', 'A drawing and a clear price.') },
      { title: L('ייצור', 'Fabricate'), text: L('חיתוך מדויק לפי תוכנית.', 'Precise cutting from the plan.') },
      { title: L('התקנה', 'Install'), text: L('התקנה, בדיקה ואחריות.', 'Installation, checks, warranty.') },
    ],
  },
  calc: {
    kick: L('מחשבון', 'Calculator'),
    title: L('כמה תעלה הפרגולה שלכם?', 'What will your pergola cost?'),
    sub: L('הערכה ראשונית בלבד. מחיר סופי אחרי מדידה בשטח.', 'A first estimate only. The final price comes after an on-site measurement.'),
    type: L('סוג פרגולה', 'Pergola type'),
    width: L('רוחב', 'Width'),
    depth: L('עומק', 'Depth'),
    area: L('שטח', 'Area'),
    posts: L('עמודים (בערך)', 'Posts (approx.)'),
    louvers: L('למלות (בערך)', 'Louvers (approx.)'),
    span: L('מוטה מקסימלית', 'Max span'),
    results: L('תוצאות החישוב', 'Estimate results'),
    sampleNote: L(
      'טווח מחיר לדוגמה. ערכי המחיר באתר האמיתי יוגדרו על ידכם.',
      'Sample price range. Real rates are set by you.',
    ),
    finalNote: L('הערכה בלבד, לא הצעת מחיר מחייבת.', 'An estimate only, not a binding quote.'),
    whatsapp: L('שלחו לנו בוואטסאפ', 'Send us on WhatsApp'),
    askAi: L('שאלו את ה־AI', 'Ask the AI'),
    waMessage: (typeName: string, w: string, d: string): Localized => ({
      he: `שלום, אני מעוניין בהצעת מחיר: ${typeName}, ${w} × ${d} מ׳`,
      en: `Hello, I would like a quote: ${typeName}, ${w} x ${d} m`,
    }),
  },
  warranty: {
    kick: L('אחריות ותעודות', 'Warranty and certificates'),
    title: L('אחריות שאפשר לסמוך עליה', 'A warranty you can rely on'),
    sampleSub: L('הנתונים בדוגמה. התנאים הסופיים יוגדרו על ידכם.', 'Sample content. Final terms are set by you.'),
    period: L('תקופת אחריות', 'Warranty period'),
    periodText: L('מתחילה ביום ההתקנה ומתועדת בכתב.', 'Starts on the installation day and is issued in writing.'),
    covered: L('מה מכוסה', 'What is covered'),
    notCovered: L('מה לא מכוסה', 'What is not covered'),
    certs: L('תעודות והסמכות', 'Certificates'),
    slot: L('חריץ', 'slot'),
  },
  partners: {
    kick: L('שותפים', 'Partners'),
    title: L('החברות שאנחנו עובדים איתן', 'Companies we work with'),
    region: L('לוגואים של שותפים', 'Partner logos'),
  },
  lead: {
    kick: L('יצירת קשר', 'Contact'),
    title: L('בואו נתכנן את הפרויקט שלכם', "Let's plan your project"),
    sub: L(
      'השאירו פרטים ונחזור אליכם בהקדם. ככל שתספרו יותר, ההצעה תהיה מדויקת יותר.',
      'Leave your details and we will get back to you. The more you tell us, the more accurate the quote.',
    ),
    askAi: L('שאלו את ה־AI', 'Ask the AI'),
    firstName: L('שם פרטי', 'First name'),
    lastName: L('שם משפחה', 'Last name'),
    phone: L('טלפון', 'Phone'),
    city: L('עיר מגורים', 'City'),
    email: L('אימייל', 'Email'),
    optional: L('(אופציונלי)', '(optional)'),
    service: L('במה אתם מעוניינים?', 'What do you need?'),
    message: L('פרטים נוספים', 'More details'),
    consent: L(
      'אני מאשר/ת שתיצרו איתי קשר ותשמרו את הפרטים שמסרתי לצורך כך.',
      'I agree to be contacted and for my details to be stored for that purpose.',
    ),
    send: L('שלחו לי הצעה', 'Send my request'),
    sending: L('שולח…', 'Sending…'),
    ok: L('תודה! קיבלנו את הפרטים ונחזור אליכם בהקדם.', 'Thank you! We received your details and will get back to you soon.'),
    demoNote: L('(הדגמה: שום דבר לא נשלח)', '(demo: nothing was sent)'),
    fail: L('לא הצלחנו לשלוח. נסו שוב או כתבו לנו בוואטסאפ.', 'We could not send it. Try again or write to us on WhatsApp.'),
    errors: {
      required: L('שדה חובה', 'Required'),
      short: L('לפחות 2 תווים', 'At least 2 characters'),
      phone: L('מספר טלפון לא תקין', 'Invalid phone number'),
      email: L('כתובת אימייל לא תקינה', 'Invalid email address'),
      number: L('הזינו מספר בין 0.3 ל־100', 'Enter a number between 0.3 and 100'),
      consent: L('יש לאשר כדי שנוכל לחזור אליכם', 'Please confirm so we can contact you'),
    },
  },
  footer: {
    nav: L('ניווט תחתון', 'Footer navigation'),
    social: L('רשתות חברתיות', 'Social networks'),
    legal: L('מידע משפטי', 'Legal'),
    accessibility: L('נגישות', 'Accessibility'),
    privacy: L('פרטיות', 'Privacy'),
  },
  a11yPanel: {
    open: L('תפריט נגישות', 'Accessibility menu'),
    inc: L('הגדל טקסט', 'Larger text'),
    dec: L('הקטן טקסט', 'Smaller text'),
    contrast: L('ניגודיות גבוהה', 'High contrast'),
    underline: L('קו תחתון לקישורים', 'Underline links'),
    still: L('עצור אנימציות', 'Stop animations'),
    statement: L('הצהרת נגישות', 'Accessibility statement'),
  },
  whatsapp: L('וואטסאפ', 'WhatsApp'),
  chat: {
    open: L('פתיחת צ׳אט AI', 'Open AI chat'),
    close: L('סגירת הצ׳אט', 'Close chat'),
    title: L('עוזר AI של Pashkovsky', 'Pashkovsky AI assistant'),
    demo: L('הדגמה: עוד לא מחובר למודל', 'demo: not connected to a model yet'),
    welcome: L(
      'שלום! אני העוזר של Pashkovsky. אפשר לשאול על מחירים, אחריות, זמנים או דגמים.',
      'Hi! I am the Pashkovsky assistant. Ask about prices, warranty, timelines or models.',
    ),
    input: L('כתבו הודעה…', 'Type a message…'),
    inputLabel: L('הודעה', 'Message'),
    send: L('שלח', 'Send'),
    log: L('שיחה', 'Conversation'),
  },
  a11yPage: {
    back: L('← חזרה לאתר', '← Back to the site'),
    title: L('הצהרת נגישות', 'Accessibility statement'),
    intro: L(
      'אנחנו רוצים שכל אדם יוכל לגלוש באתר, לקרוא אותו ולהזמין שירות, גם עם מוגבלות.',
      'We want everyone to be able to browse this site, read it and order a service, including people with disabilities.',
    ),
    doneTitle: L('התאמות שבוצעו', 'What we did'),
    done: [
      L('ניווט מלא במקלדת ומצב פוקוס גלוי', 'Full keyboard navigation and visible focus'),
      L(
        'הגדלת טקסט, ניגודיות גבוהה, קו תחתון לקישורים ועצירת אנימציות (כפתור הנגישות בפינה)',
        'Larger text, high contrast, underlined links and stopping animations (accessibility button in the corner)',
      ),
      L('תמיכה בעברית מימין לשמאל ובאנגלית', 'Hebrew right-to-left and English support'),
      L('כיבוד ההעדפה של המשתמש להפחתת תנועה', "Respect for the user's reduced-motion setting"),
    ],
    standardTitle: L('תקן', 'Standard'),
    standard: L(
      'היעד הוא עמידה בתקן הישראלי ת״י 5568 (WCAG 2.1 ברמה AA). הנוסח הסופי ייבדק על ידי יועץ נגישות.',
      'The target is the Israeli standard SI 5568 (WCAG 2.1 level AA). The final text must be reviewed by an accessibility consultant.',
    ),
    problemTitle: L('נתקלתם בבעיה?', 'Found a problem?'),
    coordinator: L('פנו לרכז הנגישות:', 'Contact the accessibility coordinator:'),
    updated: L('עודכן לאחרונה:', 'Last updated:'),
  },
} as const
