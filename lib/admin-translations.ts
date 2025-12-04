import type { Locale } from '@/lib/locales'

export interface CRMTranslations {
  // Common
  common: {
    save: string
    saving: string
    cancel: string
    delete: string
    deleteConfirm: string
    close: string
    continue: string
    logout: string
    search: string
    loading: string
    error: string
    noData: string
    back: string
    next: string
    page: string
    of: string
    yes: string
    no: string
  }

  // Auth
  auth: {
    enterAdminToken: string
    adminTokenPlaceholder: string
  }

  // Navigation
  nav: {
    deals: string
    leads: string
    articles: string
    gallery: string
    aiChats: string
  }

  // Deals
  deals: {
    title: string
    newDeal: string
    statistics: string
    searchPlaceholder: string
    customerName: string
    customerPhone: string
    customerEmail: string
    customerCity: string
    projectType: string
    stage: string
    width: string
    depth: string
    shape: string
    material: string
    colorRal: string
    price: string
    myCost: string
    orderDate: string
    materialOrderDate: string
    materialReceivedDate: string
    installationDate: string
    lighting: string
    manager: string
    notes: string
    sketch: string
    openSketch: string
    createdAt: string
    updatedAt: string
    leadId: string
    withoutName: string
    createDeal: string
    createNewDeal: string
    customerInfo: string
    projectInfo: string
    required: string
    dealTitle: string
    dealTitleCreate: string
    cm: string
    shekel: string
    rectangle: string
    lShape: string
    projectTypes: {
      pergola: string
      railing: string
      gates: string
      windows: string
    }
    stages: {
      new: string
      measure: string
      offer: string
      approved: string
      production: string
      install: string
      done: string
    }
    filters: {
      allStages: string
      allTypes: string
    }
    viewModes: {
      kanban: string
      table: string
    }
  }

  // Leads
  leads: {
    title: string
    searchPlaceholder: string
    name: string
    phone: string
    email: string
    city: string
    source: string
    status: string
    notes: string
    leadTitle: string
    notesPlaceholder: string
    createdAt: string
    lastMessage: string
    page: string
  }

  // AI Chats
  aiChats: {
    title: string
    searchPlaceholder: string
    clientId: string
    lastActivity: string
    messages: string
    preview: string
    noMessages: string
    deleteDialog: string
    realtime: string
    realtimeOff: string
    refresh: string
    back: string
    user: string
    assistant: string
  }

  // Articles
  articles: {
    title: string
    createArticle: string
    editArticle: string
    deleteArticle: string
    deleteConfirm: string
    titleLabel: string
    contentLabel: string
    slugLabel: string
    publishedLabel: string
    save: string
    cancel: string
  }

  // Gallery
  gallery: {
    title: string
    unavailable: string
  }

  // Status
  status: {
    loading: string
    error: string
    noDeals: string
    noLeads: string
  }
}

export function getCRMTranslations(locale: Locale): CRMTranslations {
  if (locale === 'ru') {
    return {
      common: {
        save: 'Сохранить',
        saving: 'Сохранение...',
        cancel: 'Отмена',
        delete: 'Удалить',
        deleteConfirm: 'Вы уверены?',
        close: 'Закрыть',
        continue: 'Продолжить',
        logout: 'Выход',
        search: 'Поиск',
        loading: 'Загрузка...',
        error: 'Ошибка',
        noData: 'Нет данных',
        back: 'Назад',
        next: 'Вперед',
        page: 'Страница',
        of: 'из',
        yes: 'Да',
        no: 'Нет',
      },
      auth: {
        enterAdminToken: 'Введите токен администратора',
        adminTokenPlaceholder: 'ADMIN_TOKEN',
      },
      nav: {
        deals: 'Сделки',
        leads: 'Лиды',
        articles: 'Статьи',
        gallery: 'Галерея',
        aiChats: 'AI Чаты',
      },
      deals: {
        title: 'Сделки',
        newDeal: 'Новая сделка',
        statistics: 'Статистика',
        searchPlaceholder: '🔍 Поиск по имени, телефону, материалу, RAL...',
        customerName: 'Имя клиента',
        customerPhone: 'Телефон',
        customerEmail: 'Email',
        customerCity: 'Город',
        projectType: 'Тип проекта',
        stage: 'Этап',
        width: 'Ширина (см)',
        depth: 'Глубина (см)',
        shape: 'Форма',
        material: 'Материал',
        colorRal: 'RAL',
        price: 'Цена клиенту (₪)',
        myCost: 'Моя стоимость (₪)',
        orderDate: 'תאריך הזמנה (Дата заказа)',
        materialOrderDate: 'תאריך הזמנת חומר (Дата заказа материала)',
        materialReceivedDate: 'תאריך הגעת חומר למפעל (Дата прибытия материала на завод)',
        installationDate: 'תאריך התקנה (Дата установки)',
        lighting: 'תאורה (Освещение)',
        manager: 'Менеджер',
        notes: 'Заметки',
        sketch: 'Эскиз',
        openSketch: 'Открыть эскиз',
        createdAt: 'Создано',
        updatedAt: 'Обновлено',
        leadId: 'ID лида',
        withoutName: 'Без имени',
        createDeal: 'Создать сделку',
        createNewDeal: 'Создать новую сделку',
        customerInfo: 'Информация о клиенте',
        projectInfo: 'Информация о проекте',
        required: '*',
        dealTitle: 'Сделка',
        dealTitleCreate: 'Создать новую сделку',
        cm: 'см',
        shekel: '₪',
        rectangle: 'Прямоугольник',
        lShape: 'Г-образная',
        projectTypes: {
          pergola: 'Пергола',
          railing: 'Перила',
          gates: 'Ворота',
          windows: 'Окна',
        },
        stages: {
          new: 'Новая',
          measure: 'Замер',
          offer: 'הוזמן',
          approved: 'חומר שהגיע למפעל',
          production: 'Производство',
          install: 'Установка',
          done: 'Готово',
        },
        filters: {
          allStages: 'Все этапы',
          allTypes: 'Все типы',
        },
        viewModes: {
          kanban: 'Канбан',
          table: 'Таблица',
        },
      },
      leads: {
        title: 'Лиды',
        searchPlaceholder: '🔍 Поиск по имени, телефону, заметкам...',
        name: 'Имя',
        phone: 'Телефон',
        email: 'Email',
        city: 'Город',
        source: 'Источник',
        status: 'Статус',
        notes: 'Заметки',
        leadTitle: 'Лид',
        notesPlaceholder: 'Заметки о лиде...',
        createdAt: 'Создано',
        lastMessage: 'Последнее сообщение',
        page: 'Страница',
      },
      aiChats: {
        title: 'AI Чаты',
        searchPlaceholder: 'Поиск по клиенту или дате...',
        clientId: 'ID клиента',
        lastActivity: 'Последняя активность',
        messages: 'Сообщений',
        preview: 'Превью',
        noMessages: 'Нет сообщений',
        deleteDialog: 'Удалить этот диалог?',
        realtime: 'Онлайн',
        realtimeOff: 'Офлайн',
        refresh: 'Обновить',
        back: 'Назад',
        user: 'Пользователь',
        assistant: 'Ассистент',
      },
      articles: {
        title: 'Статьи',
        createArticle: 'Создать статью',
        editArticle: 'Редактировать',
        deleteArticle: 'Удалить',
        deleteConfirm: 'Удалить статью?',
        titleLabel: 'Заголовок',
        contentLabel: 'Содержание',
        slugLabel: 'URL',
        publishedLabel: 'Опубликовано',
        save: 'Сохранить',
        cancel: 'Отмена',
      },
      gallery: {
        title: 'Галерея',
        unavailable: 'Админка галереи временно недоступна. Компонент был удален.',
      },
      status: {
        loading: 'Загрузка...',
        error: 'Ошибка загрузки данных',
        noDeals: 'Нет сделок',
        noLeads: 'Нет лидов',
      },
    }
  }

  if (locale === 'en') {
    return {
      common: {
        save: 'Save',
        saving: 'Saving...',
        cancel: 'Cancel',
        delete: 'Delete',
        deleteConfirm: 'Are you sure?',
        close: 'Close',
        continue: 'Continue',
        logout: 'Logout',
        search: 'Search',
        loading: 'Loading...',
        error: 'Error',
        noData: 'No data',
        back: 'Back',
        next: 'Next',
        page: 'Page',
        of: 'of',
        yes: 'Yes',
        no: 'No',
      },
      auth: {
        enterAdminToken: 'Enter admin token',
        adminTokenPlaceholder: 'ADMIN_TOKEN',
      },
      nav: {
        deals: 'Deals',
        leads: 'Leads',
        articles: 'Articles',
        gallery: 'Gallery',
        aiChats: 'AI Chats',
      },
      deals: {
        title: 'Deals',
        newDeal: 'New Deal',
        statistics: 'Statistics',
        searchPlaceholder: '🔍 Search by name, phone, material, RAL...',
        customerName: 'Customer Name',
        customerPhone: 'Phone',
        customerEmail: 'Email',
        customerCity: 'City',
        projectType: 'Project Type',
        stage: 'Stage',
        width: 'Width (cm)',
        depth: 'Depth (cm)',
        shape: 'Shape',
        material: 'Material',
        colorRal: 'RAL',
        price: 'Price (₪)',
        myCost: 'My Cost (₪)',
        orderDate: 'Order Date',
        materialOrderDate: 'Material Order Date',
        materialReceivedDate: 'Material Arrived at Factory',
        installationDate: 'Installation Date',
        lighting: 'Lighting',
        manager: 'Manager',
        notes: 'Notes',
        sketch: 'Sketch',
        openSketch: 'Open Sketch',
        createdAt: 'Created',
        updatedAt: 'Updated',
        leadId: 'Lead ID',
        withoutName: 'No Name',
        createDeal: 'Create Deal',
        createNewDeal: 'Create New Deal',
        customerInfo: 'Customer Information',
        projectInfo: 'Project Information',
        required: '*',
        dealTitle: 'Deal',
        dealTitleCreate: 'Create New Deal',
        cm: 'cm',
        shekel: '₪',
        rectangle: 'Rectangle',
        lShape: 'L-Shape',
        projectTypes: {
          pergola: 'Pergola',
          railing: 'Railing',
          gates: 'Gates',
          windows: 'Windows',
        },
        stages: {
          new: 'New',
          measure: 'Measure',
          offer: 'הוזמן',
          approved: 'חומר שהגיע למפעל',
          production: 'Production',
          install: 'Installation',
          done: 'Done',
        },
        filters: {
          allStages: 'All Stages',
          allTypes: 'All Types',
        },
        viewModes: {
          kanban: 'Kanban',
          table: 'Table',
        },
      },
      leads: {
        title: 'Leads',
        searchPlaceholder: '🔍 Search by name, phone, notes...',
        name: 'Name',
        phone: 'Phone',
        email: 'Email',
        city: 'City',
        source: 'Source',
        status: 'Status',
        notes: 'Notes',
        leadTitle: 'Lead',
        notesPlaceholder: 'Notes about lead...',
        createdAt: 'Created',
        lastMessage: 'Last Message',
        page: 'Page',
      },
      aiChats: {
        title: 'AI Chats',
        searchPlaceholder: 'Search by client or date...',
        clientId: 'Client ID',
        lastActivity: 'Last Activity',
        messages: 'Messages',
        preview: 'Preview',
        noMessages: 'No messages',
        deleteDialog: 'Delete this conversation?',
        realtime: 'Online',
        realtimeOff: 'Offline',
        refresh: 'Refresh',
        back: 'Back',
        user: 'User',
        assistant: 'Assistant',
      },
      articles: {
        title: 'Articles',
        createArticle: 'Create Article',
        editArticle: 'Edit',
        deleteArticle: 'Delete',
        deleteConfirm: 'Delete article?',
        titleLabel: 'Title',
        contentLabel: 'Content',
        slugLabel: 'URL',
        publishedLabel: 'Published',
        save: 'Save',
        cancel: 'Cancel',
      },
      gallery: {
        title: 'Gallery',
        unavailable: 'Gallery admin is temporarily unavailable. Component was removed.',
      },
      status: {
        loading: 'Loading...',
        error: 'Error loading data',
        noDeals: 'No deals',
        noLeads: 'No leads',
      },
    }
  }

  // Hebrew (default)
  return {
    common: {
      save: 'שמור',
      saving: 'שומר...',
      cancel: 'ביטול',
      delete: 'מחק',
      deleteConfirm: 'האם אתה בטוח?',
      close: 'סגור',
      continue: 'המשך',
      logout: 'התנתק',
      search: 'חיפוש',
      loading: 'טוען...',
      error: 'שגיאה',
      noData: 'אין נתונים',
      back: 'חזור',
      next: 'הבא',
      page: 'עמוד',
      of: 'מתוך',
      yes: 'כן',
      no: 'לא',
    },
    auth: {
      enterAdminToken: 'הכנס אסימון מנהל',
      adminTokenPlaceholder: 'ADMIN_TOKEN',
    },
    nav: {
      deals: 'עסקאות',
      leads: 'לידים',
      articles: 'מאמרים',
      gallery: 'גלריה',
      aiChats: 'צ\'אטים AI',
    },
    deals: {
      title: 'עסקאות',
      newDeal: 'עסקה חדשה',
      statistics: 'סטטיסטיקה',
      searchPlaceholder: '🔍 חיפוש לפי שם, טלפון, חומר, RAL...',
      customerName: 'שם לקוח',
      customerPhone: 'טלפון',
      customerEmail: 'אימייל',
      customerCity: 'עיר',
      projectType: 'סוג פרויקט',
      stage: 'שלב',
      width: 'רוחב (ס"מ)',
      depth: 'עומק (ס"מ)',
      shape: 'צורה',
      material: 'חומר',
      colorRal: 'RAL',
      price: 'מחיר ללקוח (₪)',
      myCost: 'העלות שלי (₪)',
      orderDate: 'תאריך הזמנה',
      materialOrderDate: 'תאריך הזמנת חומר',
      materialReceivedDate: 'תאריך הגעת חומר למפעל',
      installationDate: 'תאריך התקנה',
      lighting: 'תאורה',
      manager: 'מנהל',
      notes: 'הערות',
      sketch: 'סקיצה',
      openSketch: 'פתח סקיצה',
      createdAt: 'נוצר',
      updatedAt: 'עודכן',
      leadId: 'מזהה ליד',
      withoutName: 'ללא שם',
      createDeal: 'צור עסקה',
      createNewDeal: 'צור עסקה חדשה',
      customerInfo: 'מידע על הלקוח',
      projectInfo: 'מידע על הפרויקט',
      required: '*',
      dealTitle: 'עסקה',
      dealTitleCreate: 'צור עסקה חדשה',
      cm: 'ס"מ',
      shekel: '₪',
      rectangle: 'מלבן',
      lShape: 'L-צורה',
      projectTypes: {
        pergola: 'פרגולה',
        railing: 'מעקה',
        gates: 'שערים',
        windows: 'חלונות',
      },
      stages: {
        new: 'חדש',
        measure: 'מדידה',
        offer: 'הוזמן',
        approved: 'חומר שהגיע למפעל',
        production: 'ייצור',
        install: 'התקנה',
        done: 'הושלם',
      },
      filters: {
        allStages: 'כל השלבים',
        allTypes: 'כל הסוגים',
      },
      viewModes: {
        kanban: 'קנבן',
        table: 'טבלה',
      },
    },
    leads: {
      title: 'לידים',
      searchPlaceholder: '🔍 חיפוש לפי שם, טלפון, הערות...',
      name: 'שם',
      phone: 'טלפון',
      email: 'אימייל',
      city: 'עיר',
      source: 'מקור',
      status: 'סטטוס',
      notes: 'הערות',
      leadTitle: 'ליד',
      notesPlaceholder: 'הערות על הליד...',
      createdAt: 'נוצר',
      lastMessage: 'הודעה אחרונה',
      page: 'עמוד',
    },
    aiChats: {
      title: 'צ\'אטים AI',
      searchPlaceholder: 'חיפוש לפי לקוח או תאריך...',
      clientId: 'מזהה לקוח',
      lastActivity: 'פעילות אחרונה',
      messages: 'הודעות',
      preview: 'תצוגה מקדימה',
      noMessages: 'אין הודעות',
      deleteDialog: 'למחוק את השיחה הזו?',
      realtime: 'מקוון',
      realtimeOff: 'מנותק',
      refresh: 'רענן',
      back: 'חזור',
      user: 'משתמש',
      assistant: 'עוזר',
    },
    articles: {
      title: 'מאמרים',
      createArticle: 'צור מאמר',
      editArticle: 'ערוך',
      deleteArticle: 'מחק',
      deleteConfirm: 'למחוק מאמר?',
      titleLabel: 'כותרת',
      contentLabel: 'תוכן',
      slugLabel: 'URL',
      publishedLabel: 'פורסם',
      save: 'שמור',
      cancel: 'ביטול',
    },
    gallery: {
      title: 'גלריה',
      unavailable: 'ניהול הגלריה זמנית לא זמין. הרכיב הוסר.',
    },
    status: {
      loading: 'טוען...',
      error: 'שגיאה בטעינת נתונים',
      noDeals: 'אין עסקאות',
      noLeads: 'אין לידים',
    },
  }
}


