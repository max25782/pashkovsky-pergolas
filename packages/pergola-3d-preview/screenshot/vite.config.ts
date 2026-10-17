import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  root: __dirname,
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@pashkovsky/pergola-core': path.resolve(__dirname, '../../pergola-core/src/index.ts'),
      '@pashkovsky/pergola-3d-preview': path.resolve(__dirname, '../src/index.ts'),
    },
  },
  server: {
    port: 4177,
    host: '127.0.0.1',
  },
})
