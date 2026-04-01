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
  lamellaProfile: string
  defaultPost: string
  defaultBeam: string
  defaultLamella: string
  loadingProfiles: string
  dimensionsUnknown: string
  selected: string
  selectedPost: string
  selectedBeam: string
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
      lamellaProfile: 'Профиль ламели',
      defaultPost: 'По умолчанию (8x8 см)',
      defaultBeam: 'По умолчанию (4x10 см)',
      defaultLamella: 'По умолчанию (2x10 см)',
      loadingProfiles: 'Загрузка профилей...',
      dimensionsUnknown: '(размеры неизвестны)',
      selected: 'Выбрано:',
      selectedPost: 'столб',
      selectedBeam: 'балка',
      selectedLamella: 'ламель',
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
      lamellaProfile: 'Lamella profile',
      defaultPost: 'Default (8x8 cm)',
      defaultBeam: 'Default (4x10 cm)',
      defaultLamella: 'Default (2x10 cm)',
      loadingProfiles: 'Loading profiles...',
      dimensionsUnknown: '(dimensions unknown)',
      selected: 'Selected:',
      selectedPost: 'post',
      selectedBeam: 'beam',
      selectedLamella: 'lamella',
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
    lamellaProfile: 'פרופיל למילה',
    defaultPost: 'ברירת מחדל (8x8 ס"מ)',
    defaultBeam: 'ברירת מחדל (4x10 ס"מ)',
    defaultLamella: 'ברירת מחדל (2x10 ס"מ)',
    loadingProfiles: 'טוען פרופילים...',
    dimensionsUnknown: '(מידות לא ידועות)',
    selected: 'נבחר:',
    selectedPost: 'עמוד',
    selectedBeam: 'קורה',
    selectedLamella: 'למילה',
    attachedToWall: 'מחובר לקיר',
    beamLed: 'תאורת LED בקורות',
    lamellaStanding: 'למלות בעמידה',
    lamellaAlongWidth: 'למלות לאורך הרוחב',
    saveButton: 'שמור קונפיגורציה',
    saveSuccess: 'נשמר!',
    saveFailed: 'שמירה נכשלה',
  }
}
