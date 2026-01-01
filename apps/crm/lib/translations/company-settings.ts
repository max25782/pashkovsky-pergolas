/**
 * Company Settings Page Translations
 */

export const companySettingsTranslations = {
  en: {
    title: 'Company Settings',
    subtitle: 'Manage your company profile, logo and branding',
    
    // Logo section
    logoSection: 'Company Logo',
    noLogo: 'No logo',
    uploadLogo: 'Upload Logo',
    uploading: 'Uploading...',
    logoHint: 'PNG, JPG or SVG. Max 5MB',
    
    // Basic info
    basicInfo: 'Basic Information',
    companyName: 'Company Name',
    email: 'Email',
    phone: 'Phone',
    city: 'City',
    address: 'Address',
    addressPlaceholder: 'Street, building number, city',
    
    // Banking
    banking: 'Bank & Invoice Details',
    vatNumber: 'VAT Number (Tax ID)',
    vatPlaceholder: '123456789',
    bankName: 'Bank Name',
    bankNamePlaceholder: 'Bank Hapoalim',
    branchNumber: 'Branch Number',
    branchPlaceholder: '123',
    accountNumber: 'Account Number',
    accountPlaceholder: '123456',
    
    // Branding
    branding: 'Branding',
    primaryColor: 'Primary Color (for PDF & Email)',
    colorCode: 'HEX color code',
    
    // Email signature
    emailSignature: 'Email Signature',
    emailSignaturePlaceholder: `Best regards,\n[Company] Team\nPhone: [Phone]\nWebsite: [Website]`,
    emailSignatureHint: 'This signature appears at the end of all emails sent to clients',
    
    // PDF footer
    pdfFooter: 'PDF Footer',
    pdfFooterPlaceholder: (company: string, phone: string, address: string, year: number) =>
      `${company} | Phone: ${phone} | ${address}\nAll rights reserved © ${year}`,
    pdfFooterHint: 'This text appears at the bottom of all PDF documents (quotes, invoices)',
    
    // Messages
    saveChanges: 'Save Changes',
    saving: 'Saving...',
    savedSuccess: 'Changes saved successfully!',
    saveFailed: 'Failed to save changes',
    logoUploadSuccess: 'Logo uploaded successfully!',
    logoUploadFailed: 'Failed to upload logo',
    loadFailed: 'Failed to load company profile',
    loading: 'Loading...',
    noCompany: 'No company profile found',
  },
  
  he: {
    title: 'הגדרות חברה',
    subtitle: 'נהל את פרופיל החברה, לוגו וברנדינג',
    
    logoSection: 'לוגו החברה',
    noLogo: 'אין לוגו',
    uploadLogo: 'העלה לוגו',
    uploading: 'מעלה...',
    logoHint: 'PNG, JPG או SVG. מקסימום 5MB',
    
    basicInfo: 'מידע בסיסי',
    companyName: 'שם החברה',
    email: 'אימייל',
    phone: 'טלפון',
    city: 'עיר',
    address: 'כתובת',
    addressPlaceholder: 'רחוב, מספר בית, עיר',
    
    banking: 'פרטי בנק וחשבונית',
    vatNumber: 'מספר עוסק מורשה (ח.פ)',
    vatPlaceholder: '123456789',
    bankName: 'שם הבנק',
    bankNamePlaceholder: 'בנק הפועלים',
    branchNumber: 'מספר סניף',
    branchPlaceholder: '123',
    accountNumber: 'מספר חשבון',
    accountPlaceholder: '123456',
    
    branding: 'ברנדינג',
    primaryColor: 'צבע ראשי (לשימוש ב-PDF ו-Email)',
    colorCode: 'קוד צבע HEX',
    
    emailSignature: 'חתימת Email',
    emailSignaturePlaceholder: (company: string, phone: string) =>
      `בברכה,\nצוות ${company}\nטלפון: ${phone}\nאתר: [אתר]`,
    emailSignatureHint: 'חתימה זו תופיע בסוף כל Email שנשלח ללקוחות',
    
    pdfFooter: 'Footer ל-PDF',
    pdfFooterPlaceholder: (company: string, phone: string, address: string, year: number) =>
      `${company} | טלפון: ${phone} | ${address}\nכל הזכויות שמורות © ${year}`,
    pdfFooterHint: 'טקסט זה יופיע בתחתית כל מסמך PDF (הצעות מחיר, חשבוניות)',
    
    saveChanges: 'שמור שינויים',
    saving: 'שומר...',
    savedSuccess: 'השינויים נשמרו בהצלחה!',
    saveFailed: 'שגיאה בשמירת השינויים',
    logoUploadSuccess: 'הלוגו הועלה בהצלחה!',
    logoUploadFailed: 'שגיאה בהעלאת הלוגו',
    loadFailed: 'שגיאה בטעינת פרופיל החברה',
    loading: 'טוען...',
    noCompany: 'לא נמצא פרופיל חברה',
  },
  
  ru: {
    title: 'Настройки компании',
    subtitle: 'Управляйте профилем компании, логотипом и брендингом',
    
    logoSection: 'Логотип компании',
    noLogo: 'Нет логотипа',
    uploadLogo: 'Загрузить логотип',
    uploading: 'Загрузка...',
    logoHint: 'PNG, JPG или SVG. Максимум 5MB',
    
    basicInfo: 'Основная информация',
    companyName: 'Название компании',
    email: 'Email',
    phone: 'Телефон',
    city: 'Город',
    address: 'Адрес',
    addressPlaceholder: 'Улица, номер дома, город',
    
    banking: 'Банковские и налоговые данные',
    vatNumber: 'Налоговый номер (ИНН)',
    vatPlaceholder: '123456789',
    bankName: 'Название банка',
    bankNamePlaceholder: 'Банк Апоалим',
    branchNumber: 'Номер отделения',
    branchPlaceholder: '123',
    accountNumber: 'Номер счёта',
    accountPlaceholder: '123456',
    
    branding: 'Брендинг',
    primaryColor: 'Основной цвет (для PDF и Email)',
    colorCode: 'HEX код цвета',
    
    emailSignature: 'Подпись Email',
    emailSignaturePlaceholder: (company: string, phone: string) =>
      `С уважением,\nКоманда ${company}\nТелефон: ${phone}\nСайт: [сайт]`,
    emailSignatureHint: 'Эта подпись появится в конце всех писем клиентам',
    
    pdfFooter: 'Футер для PDF',
    pdfFooterPlaceholder: (company: string, phone: string, address: string, year: number) =>
      `${company} | Телефон: ${phone} | ${address}\nВсе права защищены © ${year}`,
    pdfFooterHint: 'Этот текст появится внизу всех PDF документов (предложения, счета)',
    
    saveChanges: 'Сохранить изменения',
    saving: 'Сохранение...',
    savedSuccess: 'Изменения сохранены успешно!',
    saveFailed: 'Ошибка при сохранении',
    logoUploadSuccess: 'Логотип загружен успешно!',
    logoUploadFailed: 'Ошибка при загрузке логотипа',
    loadFailed: 'Ошибка загрузки профиля компании',
    loading: 'Загрузка...',
    noCompany: 'Профиль компании не найден',
  },
}

