import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../../../..')

export default {
  root: here,
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@pashkovsky/pergola-core': path.join(repo, 'packages/pergola-core/src/index.ts'),
      react: path.join(repo, 'node_modules/react'),
      'react-dom': path.join(repo, 'node_modules/react-dom'),
    },
  },
  publicDir: path.join(repo, 'apps/crm/public/profile-photo-check/photos'),
  server: {
    port: 4179,
    strictPort: true,
    fs: { allow: [repo, here] },
  },
}
