import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Изолированный dev-стенд для ручной/скриптовой проверки input+view-svg слоёв. Не публикуется. */
export default defineConfig({
  plugins: [react()],
})
