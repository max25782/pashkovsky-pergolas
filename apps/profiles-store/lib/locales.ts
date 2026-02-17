export const locales = ['he', 'ru', 'en'] as const
export type Locale = typeof locales[number]
export const defaultLocale: Locale = 'he'

export function isRTL(locale: Locale) {
  return locale === 'he'
}

export const translations = {
  he: {
    'product.addToCart': 'הוסף לסל',
    'product.inStock': 'במלאי',
    'product.outOfStock': 'אזל המלאי',
    'cart.title': 'עגלת קניות',
    'cart.empty': 'העגלה ריקה',
    'cart.total': 'סה"כ',
    'cart.proceedToCheckout': 'המשך לתשלום',
    'checkout.title': 'תשלום',
    'checkout.name': 'שם',
    'checkout.phone': 'טלפון',
    'checkout.email': 'אימייל',
    'checkout.city': 'עיר',
    'checkout.address': 'כתובת',
    'checkout.submit': 'שלח הזמנה',
    'order.success': 'ההזמנה התקבלה בהצלחה',
    'order.number': 'מספר הזמנה',
    'catalog.allProducts': 'כל המוצרים',
    'catalog.search': 'חיפוש',
    'catalog.products': 'מוצרים',
    'product.addToQuote': 'הוסף להצעת המחיר',
    'product.quantity': 'כמות',
  },
  ru: {
    'product.addToCart': 'В корзину',
    'product.inStock': 'В наличии',
    'product.outOfStock': 'Нет в наличии',
    'cart.title': 'Корзина',
    'cart.empty': 'Корзина пуста',
    'cart.total': 'Итого',
    'cart.proceedToCheckout': 'Перейти к оплате',
    'checkout.title': 'Оформление заказа',
    'checkout.name': 'Имя',
    'checkout.phone': 'Телефон',
    'checkout.email': 'Email',
    'checkout.city': 'Город',
    'checkout.address': 'Адрес',
    'checkout.submit': 'Отправить заказ',
    'order.success': 'Заказ успешно принят',
    'order.number': 'Номер заказа',
    'catalog.allProducts': 'Все товары',
    'catalog.search': 'Поиск',
    'catalog.products': 'Товары',
    'product.addToQuote': 'Добавить в предложение',
    'product.quantity': 'Количество',
  },
  en: {
    'product.addToCart': 'Add to Cart',
    'product.inStock': 'In Stock',
    'product.outOfStock': 'Out of Stock',
    'cart.title': 'Shopping Cart',
    'cart.empty': 'Cart is empty',
    'cart.total': 'Total',
    'cart.proceedToCheckout': 'Proceed to Checkout',
    'checkout.title': 'Checkout',
    'checkout.name': 'Name',
    'checkout.phone': 'Phone',
    'checkout.email': 'Email',
    'checkout.city': 'City',
    'checkout.address': 'Address',
    'checkout.submit': 'Submit Order',
    'order.success': 'Order received successfully',
    'order.number': 'Order Number',
    'catalog.allProducts': 'All Products',
    'catalog.search': 'Search',
    'catalog.products': 'Products',
    'product.addToQuote': 'Add to Quote',
    'product.quantity': 'Quantity',
  },
}

export function getTranslation(locale: Locale, key: string): string {
  return translations[locale][key as keyof typeof translations[typeof locale]] || key
}
