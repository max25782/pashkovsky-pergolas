/**
 * Ядро и редактор работают в мм (см. pergola-core/src/types.ts), сцена
 * Three.js — в метрах (дефолты OrbitControls/теней/интенсивностей света
 * откалиброваны под метровый масштаб — см. промпт шага 3D). Конверсия — на
 * границе, именно здесь, а не размазана по билдеру/сцене.
 */
export const MM_TO_M = 1 / 1000

export function mmToM(mm: number): number {
  return mm * MM_TO_M
}
