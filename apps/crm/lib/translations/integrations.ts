/**
 * Website Integration Translations
 * All UI text in EN / HE / RU
 */

export const integrationsTranslations = {
  en: {
    // Page titles
    title: 'Website Integration',
    subtitle: 'Automatically receive leads from your website',
    instructionsTitle: 'Integration Instructions',
    
    // Status labels
    status: {
      not_connected: 'Not Connected',
      pending_payment: 'Pending Payment',
      active: 'Active',
      suspended: 'Suspended',
    },
    
    // Buttons
    connectWebsite: 'Connect Website',
    requestSetup: 'Request Setup',
    viewInstructions: 'View Instructions',
    testConnection: 'Test Connection',
    disconnect: 'Disconnect',
    copyToken: 'Copy Token',
    copyUrl: 'Copy URL',
    testWebhook: 'Test Webhook',
    markAsPaid: 'Mark as Paid & Activate',
    suspend: 'Suspend',
    reactivate: 'Reactivate',
    rotateSecret: 'Rotate Secret',
    close: 'Close',
    submit: 'Submit',
    
    // Messages
    availableOnPaid: 'Available on paid plans',
    oneTimeFee: 'One-time setup fee',
    setupRequested: 'Your integration request has been received',
    notAvailableForTrial: 'Website integration is available after plan activation',
    activateToSeeSecret: 'Activate integration to see the webhook secret',
    integrationNotFound: 'Integration not found',
    
    // Form labels
    websiteUrl: 'Website URL',
    formPlugin: 'Form Plugin',
    notes: 'Additional Notes',
    paymentMethod: 'Payment Method',
    
    // Form placeholders
    websiteUrlPlaceholder: 'https://example.com',
    formPluginPlaceholder: 'Contact Form 7, Elementor, Other',
    notesPlaceholder: 'Any specific requirements...',
    
    // Payment methods
    paymentMethods: {
      bit: 'Bit',
      paybox: 'PayBox',
      bank: 'Bank Transfer',
    },
    
    // Package names
    packages: {
      basic: {
        name: 'Basic Integration',
        price: '₪500',
        description: 'Simple websites and standard lead forms',
        features: [
          '1 website',
          'Lead reception',
          'Basic webhook',
          'Standard fields (name, phone, email, message)',
        ],
      },
      advanced: {
        name: 'Advanced Integration',
        price: '₪1,200',
        description: 'Complex forms, file uploads and custom workflows',
        features: [
          'Multiple forms',
          'File uploads',
          'Custom fields',
          'Field mapping',
          'Advanced logic',
        ],
      },
      custom: {
        name: 'Custom Integration',
        price: 'Quote',
        description: 'Multiple websites, custom logic, legacy systems',
        features: [
          'Unlimited websites',
          'Custom integration',
          'Full API access',
          'Dedicated support',
          'Legacy system support',
        ],
      },
    },
    
    // Instructions page
    instructions: {
      webhookUrl: 'Webhook URL',
      webhookSecret: 'Webhook Secret',
      requiredHeaders: 'Required Headers',
      examplePayload: 'Example Payload (JSON)',
      signatureGeneration: 'How to Generate Signature',
      signatureExplanation: 'Use HMAC-SHA256 with your webhook secret to sign the JSON body',
      testSuccess: 'Test successful! Lead received.',
      testError: 'Test failed. Please check your setup.',
    },
    
    // Payment instructions
    payment: {
      title: 'Payment Instructions',
      bitPhone: 'Bit Phone Number',
      payboxLink: 'PayBox Payment Link',
      bankDetails: 'Bank Transfer Details',
      bankName: 'Bank Name',
      accountNumber: 'Account Number',
      branch: 'Branch',
      paymentNote: 'Payment Note',
      noteTemplate: 'Write your company name in the transfer note',
    },
    
    // SuperAdmin
    superadmin: {
      title: 'Integration Management',
      filterAll: 'All Statuses',
      companyName: 'Company',
      websiteUrl: 'Website',
      type: 'Type',
      lastEvent: 'Last Event',
      actions: 'Actions',
      noIntegrations: 'No integrations found',
    },
    
    // Misc
    lastLeadReceived: 'Last lead received',
    never: 'Never',
    ago: 'ago',
  },
  
  he: {
    // כותרות עמודים
    title: 'אינטגרציה לאתר',
    subtitle: 'קבלו לידים אוטומטית מהאתר שלכם',
    instructionsTitle: 'הוראות אינטגרציה',
    
    // סטטוסים
    status: {
      not_connected: 'לא מחובר',
      pending_payment: 'ממתין לתשלום',
      active: 'פעיל',
      suspended: 'מושהה',
    },
    
    // כפתורים
    connectWebsite: 'חבר אתר',
    requestSetup: 'בקש התקנה',
    viewInstructions: 'צפה בהוראות',
    testConnection: 'בדוק חיבור',
    disconnect: 'נתק',
    copyToken: 'העתק טוקן',
    copyUrl: 'העתק URL',
    testWebhook: 'בדוק Webhook',
    markAsPaid: 'סמן כשולם והפעל',
    suspend: 'השהה',
    reactivate: 'הפעל מחדש',
    rotateSecret: 'חדש סוד',
    close: 'סגור',
    submit: 'שלח',
    
    // הודעות
    availableOnPaid: 'זמין בתוכניות בתשלום',
    oneTimeFee: 'תשלום חד-פעמי להתקנה',
    setupRequested: 'בקשת האינטגרציה שלך התקבלה',
    notAvailableForTrial: 'אינטגרציית אתר זמינה לאחר הפעלת תוכנית בתשלום',
    activateToSeeSecret: 'הפעל את האינטגרציה כדי לראות את ה-webhook secret',
    integrationNotFound: 'אינטגרציה לא נמצאה',
    
    // תוויות טופס
    websiteUrl: 'כתובת אתר',
    formPlugin: 'פלאגין טפסים',
    notes: 'הערות נוספות',
    paymentMethod: 'אמצעי תשלום',
    
    // מקומנים לטופס
    websiteUrlPlaceholder: 'https://example.co.il',
    formPluginPlaceholder: 'Contact Form 7, Elementor, אחר',
    notesPlaceholder: 'דרישות ספציפיות...',
    
    // אמצעי תשלום
    paymentMethods: {
      bit: 'Bit',
      paybox: 'PayBox',
      bank: 'העברה בנקאית',
    },
    
    // חבילות
    packages: {
      basic: {
        name: 'אינטגרציה בסיסית',
        price: '₪500',
        description: 'אתרים פשוטים וטפסי ליד סטנדרטיים',
        features: [
          'אתר אחד',
          'קבלת לידים',
          'Webhook בסיסי',
          'שדות סטנדרטיים (שם, טלפון, אימייל, הודעה)',
        ],
      },
      advanced: {
        name: 'אינטגרציה מתקדמת',
        price: '₪1,200',
        description: 'טפסים מורכבים, העלאת קבצים וזרימות מותאמות אישית',
        features: [
          'מספר טפסים',
          'העלאת קבצים',
          'שדות מותאמים',
          'מיפוי שדות',
          'לוגיקה מתקדמת',
        ],
      },
      custom: {
        name: 'אינטגרציה מותאמת אישית',
        price: 'הצעת מחיר',
        description: 'מספר אתרים, לוגיקה מותאמת, מערכות מורשת',
        features: [
          'אתרים ללא הגבלה',
          'אינטגרציה מותאמת',
          'גישה מלאה ל-API',
          'תמיכה ייעודית',
          'תמיכה במערכות מורשת',
        ],
      },
    },
    
    // עמוד הוראות
    instructions: {
      webhookUrl: 'Webhook URL',
      webhookSecret: 'Webhook Secret',
      requiredHeaders: 'כותרות נדרשות',
      examplePayload: 'דוגמת Payload (JSON)',
      signatureGeneration: 'כיצד ליצור חתימה',
      signatureExplanation: 'השתמש ב-HMAC-SHA256 עם ה-webhook secret שלך כדי לחתום על ה-JSON body',
      testSuccess: 'הבדיקה הצליחה! ליד התקבל.',
      testError: 'הבדיקה נכשלה. אנא בדוק את ההגדרות.',
    },
    
    // הוראות תשלום
    payment: {
      title: 'הוראות תשלום',
      bitPhone: 'מספר טלפון Bit',
      payboxLink: 'קישור תשלום PayBox',
      bankDetails: 'פרטי העברה בנקאית',
      bankName: 'שם הבנק',
      accountNumber: 'מספר חשבון',
      branch: 'סניף',
      paymentNote: 'הערת תשלום',
      noteTemplate: 'רשום את שם החברה שלך בהערת ההעברה',
    },
    
    // SuperAdmin
    superadmin: {
      title: 'ניהול אינטגרציות',
      filterAll: 'כל הסטטוסים',
      companyName: 'חברה',
      websiteUrl: 'אתר',
      type: 'סוג',
      lastEvent: 'אירוע אחרון',
      actions: 'פעולות',
      noIntegrations: 'לא נמצאו אינטגרציות',
    },
    
    // שונות
    lastLeadReceived: 'ליד אחרון התקבל',
    never: 'אף פעם',
    ago: 'לפני',
  },
  
  ru: {
    // Заголовки страниц
    title: 'Интеграция с сайтом',
    subtitle: 'Автоматически получайте лиды с вашего сайта',
    instructionsTitle: 'Инструкции по интеграции',
    
    // Статусы
    status: {
      not_connected: 'Не подключено',
      pending_payment: 'Ожидает оплаты',
      active: 'Активно',
      suspended: 'Приостановлено',
    },
    
    // Кнопки
    connectWebsite: 'Подключить сайт',
    requestSetup: 'Запросить подключение',
    viewInstructions: 'Посмотреть инструкции',
    testConnection: 'Тест подключения',
    disconnect: 'Отключить',
    copyToken: 'Скопировать токен',
    copyUrl: 'Скопировать URL',
    testWebhook: 'Тест Webhook',
    markAsPaid: 'Отметить оплаченным и активировать',
    suspend: 'Приостановить',
    reactivate: 'Активировать',
    rotateSecret: 'Обновить секрет',
    close: 'Закрыть',
    submit: 'Отправить',
    
    // Сообщения
    availableOnPaid: 'Доступно на платных планах',
    oneTimeFee: 'Разовый платеж за подключение',
    setupRequested: 'Ваш запрос на интеграцию получен',
    notAvailableForTrial: 'Интеграция с сайтом доступна после активации платного плана',
    activateToSeeSecret: 'Активируйте интеграцию, чтобы увидеть webhook secret',
    integrationNotFound: 'Интеграция не найдена',
    
    // Метки формы
    websiteUrl: 'URL сайта',
    formPlugin: 'Плагин формы',
    notes: 'Дополнительные заметки',
    paymentMethod: 'Способ оплаты',
    
    // Плейсхолдеры формы
    websiteUrlPlaceholder: 'https://example.com',
    formPluginPlaceholder: 'Contact Form 7, Elementor, Другое',
    notesPlaceholder: 'Особые требования...',
    
    // Способы оплаты
    paymentMethods: {
      bit: 'Bit',
      paybox: 'PayBox',
      bank: 'Банковский перевод',
    },
    
    // Пакеты
    packages: {
      basic: {
        name: 'Базовая интеграция',
        price: '₪500',
        description: 'Простые сайты и стандартные формы лидов',
        features: [
          '1 сайт',
          'Прием лидов',
          'Базовый webhook',
          'Стандартные поля (имя, телефон, email, сообщение)',
        ],
      },
      advanced: {
        name: 'Продвинутая интеграция',
        price: '₪1,200',
        description: 'Сложные формы, загрузка файлов и кастомные процессы',
        features: [
          'Несколько форм',
          'Загрузка файлов',
          'Кастомные поля',
          'Маппинг полей',
          'Продвинутая логика',
        ],
      },
      custom: {
        name: 'Индивидуальная интеграция',
        price: 'По запросу',
        description: 'Несколько сайтов, кастомная логика, legacy системы',
        features: [
          'Неограниченно сайтов',
          'Кастомная интеграция',
          'Полный доступ к API',
          'Выделенная поддержка',
          'Поддержка legacy систем',
        ],
      },
    },
    
    // Страница инструкций
    instructions: {
      webhookUrl: 'Webhook URL',
      webhookSecret: 'Webhook Secret',
      requiredHeaders: 'Обязательные заголовки',
      examplePayload: 'Пример Payload (JSON)',
      signatureGeneration: 'Как сгенерировать подпись',
      signatureExplanation: 'Используйте HMAC-SHA256 с вашим webhook secret для подписи JSON body',
      testSuccess: 'Тест успешен! Лид получен.',
      testError: 'Тест не удался. Проверьте настройки.',
    },
    
    // Инструкции по оплате
    payment: {
      title: 'Инструкции по оплате',
      bitPhone: 'Номер телефона Bit',
      payboxLink: 'Ссылка для оплаты PayBox',
      bankDetails: 'Реквизиты для банковского перевода',
      bankName: 'Название банка',
      accountNumber: 'Номер счета',
      branch: 'Филиал',
      paymentNote: 'Примечание к платежу',
      noteTemplate: 'Укажите название вашей компании в примечании к переводу',
    },
    
    // SuperAdmin
    superadmin: {
      title: 'Управление интеграциями',
      filterAll: 'Все статусы',
      companyName: 'Компания',
      websiteUrl: 'Сайт',
      type: 'Тип',
      lastEvent: 'Последнее событие',
      actions: 'Действия',
      noIntegrations: 'Интеграции не найдены',
    },
    
    // Разное
    lastLeadReceived: 'Последний лид получен',
    never: 'Никогда',
    ago: 'назад',
  },
}

export type IntegrationsTranslation = typeof integrationsTranslations.en

