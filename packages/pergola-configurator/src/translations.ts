import type { ConfiguratorLocale } from './locale'

export interface ConfiguratorTranslations {
  title: string
  width: string
  depth: string
  height: string
  color: string
  lamellaGap: string
  postProfile: string
  beamProfile: string
  dividerProfile: string
  lamellaProfile: string
  defaultPost: string
  defaultBeam: string
  defaultDivider: string
  defaultLamella: string
  loadingProfiles: string
  dimensionsUnknown: string
  selected: string
  selectedPost: string
  selectedBeam: string
  selectedDivider: string
  selectedLamella: string
  attachedToWall: string
  beamLed: string
  lamellaStanding: string
  lamellaAlongWidth: string
  saveButton: string
  saveSuccess: string
  saveFailed: string
}

export function getTranslations(locale: ConfiguratorLocale): ConfiguratorTranslations {
  if (locale === 'ru') {
    return {
      title: 'Настройки перголы',
      width: 'Ширина (см)',
      depth: 'Глубина (см)',
      height: 'Высота (см)',
      color: 'Цвет',
      lamellaGap: 'Зазор между ламелями (см)',
      postProfile: 'Профиль столба',
      beamProfile: 'Профиль балки',
      dividerProfile: 'Профиль перегородки',
      lamellaProfile: 'Профиль затенения',
      defaultPost: 'По умолчанию (8x8 см)',
      defaultBeam: 'По умолчанию (4x10 см)',
      defaultDivider: 'По умолчанию (как балка)',
      defaultLamella: 'По умолчанию (2x10 см)',
      loadingProfiles: 'Загрузка профилей...',
      dimensionsUnknown: '(размеры неизвестны)',
      selected: 'Выбрано:',
      selectedPost: 'столб',
      selectedBeam: 'балка',
      selectedDivider: 'перегородка',
      selectedLamella: 'затенение',
      attachedToWall: 'Крепится к стене',
      beamLed: 'LED подсветка в балках',
      lamellaStanding: 'Ламели вертикально',
      lamellaAlongWidth: 'Ламели поперёк (по ширине)',
      saveButton: 'Сохранить конфигурацию',
      saveSuccess: 'Сохранено!',
      saveFailed: 'Ошибка сохранения',
    }
  }

  if (locale === 'en') {
    return {
      title: 'Pergola settings',
      width: 'Width (cm)',
      depth: 'Depth (cm)',
      height: 'Height (cm)',
      color: 'Color',
      lamellaGap: 'Gap between lamellas (cm)',
      postProfile: 'Post profile',
      beamProfile: 'Beam profile',
      dividerProfile: 'Divider profile',
      lamellaProfile: 'Shading profile',
      defaultPost: 'Default (8x8 cm)',
      defaultBeam: 'Default (4x10 cm)',
      defaultDivider: 'Default (same as beam)',
      defaultLamella: 'Default (2x10 cm)',
      loadingProfiles: 'Loading profiles...',
      dimensionsUnknown: '(dimensions unknown)',
      selected: 'Selected:',
      selectedPost: 'post',
      selectedBeam: 'beam',
      selectedDivider: 'divider',
      selectedLamella: 'shading',
      attachedToWall: 'Attached to wall',
      beamLed: 'LED lighting in beams',
      lamellaStanding: 'Lamellas vertical',
      lamellaAlongWidth: 'Lamellas across width',
      saveButton: 'Save configuration',
      saveSuccess: 'Saved!',
      saveFailed: 'Save failed',
    }
  }

  return {
    title: 'הגדרות פרגולה',
    width: 'רוחב (ס"מ)',
    depth: 'עומק (ס"מ)',
    height: 'גובה (ס"מ)',
    color: 'צבע',
    lamellaGap: 'מרווח בין הלמילות (ס"מ)',
    postProfile: 'פרופיל עמוד',
    beamProfile: 'פרופיל קורה',
    dividerProfile: 'פרופיל חוצץ פנימי',
    lamellaProfile: 'פרופיל הצללה',
    defaultPost: 'ברירת מחדל (8x8 ס"מ)',
    defaultBeam: 'ברירת מחדל (4x10 ס"מ)',
    defaultDivider: 'ברירת מחדל (כמו קורה)',
    defaultLamella: 'ברירת מחדל (2x10 ס"מ)',
    loadingProfiles: 'טוען פרופילים...',
    dimensionsUnknown: '(מידות לא ידועות)',
    selected: 'נבחר:',
    selectedPost: 'עמוד',
    selectedBeam: 'קורה',
    selectedDivider: 'חוצץ',
    selectedLamella: 'הצללה',
    attachedToWall: 'מחובר לקיר',
    beamLed: 'תאורת LED בקורות',
    lamellaStanding: 'למלות בעמידה',
    lamellaAlongWidth: 'למלות לאורך הרוחב',
    saveButton: 'שמור קונפיגורציה',
    saveSuccess: 'נשמר!',
    saveFailed: 'שמירה נכשלה',
  }
}
