/**
 * Headless production PDF of the live skew plan.
 *
 *   node apps/crm/scripts/export-plan-sheets.mjs --locale he
 *   node apps/crm/scripts/export-plan-sheets.mjs            # system language
 *
 * System language is CRM_LANGUAGE, otherwise LANG when it is he/en/ru/sr, otherwise Hebrew.
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const harness = path.join(repo, 'apps/crm/scripts/plan-sheet-export')
const locales = ['he', 'en', 'ru', 'sr']

function systemLocale() {
  const fromEnv = process.env.CRM_LANGUAGE?.trim().toLowerCase()
  const fromOs = process.env.LANG?.trim().toLowerCase().slice(0, 2)
  for (const candidate of [fromEnv, fromOs]) {
    if (candidate && locales.includes(candidate)) return candidate
  }
  return 'he'
}

function argLocale() {
  const index = process.argv.indexOf('--locale')
  if (index < 0) return null
  const value = process.argv[index + 1]
  if (!locales.includes(value)) {
    console.error(`--locale must be one of ${locales.join(', ')}`)
    process.exit(1)
  }
  return value
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited ${code}`))
    })
  })
}

function argPlan() {
  const index = process.argv.indexOf('--plan')
  if (index < 0) return null
  const value = process.argv[index + 1]
  if (!['diagonal', 'skew', 'l10', 'notch', 'pentagon', 'pentagon-exact', 'pentagon-v2', 'pentagon-v2-ccw'].includes(value)) {
    console.error('--plan must be diagonal, skew, l10, notch, pentagon, pentagon-exact, pentagon-v2, or pentagon-v2-ccw')
    process.exit(1)
  }
  return value
}

const locale = argLocale() ?? systemLocale()
const plans = argPlan() ? [argPlan()] : ['diagonal', 'skew', 'l10']
const outDir = path.join(repo, '.screenshots')
await mkdir(outDir, { recursive: true })

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const vite = spawn('npx', ['vite', '--config', path.join(harness, 'vite.config.ts'), '--host', '127.0.0.1'], {
  cwd: repo,
  stdio: 'inherit',
})

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch('http://127.0.0.1:4179/')
      if (response.ok) return
    } catch {
      /* vite is still binding */
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('vite did not start')
}

try {
  await waitForServer()
  for (const plan of plans) {
    const raw = `/tmp/production-${plan}-${locale}.pdf`
    const shot = path.join(outDir, `production-${plan}-${locale}.pdf`)
    const download = `/Users/user/Downloads/production-${plan}-${locale}.pdf`
    await run(chrome, [
      '--headless',
      '--disable-gpu',
      '--no-pdf-header-footer',
      '--virtual-time-budget=15000',
      '--timeout=20000',
      `--print-to-pdf=${raw}`,
      `http://127.0.0.1:4179/?locale=${locale}&plan=${plan}`,
    ])
    const swiftPath = '/tmp/clean-one.swift'
    await writeFile(swiftPath, `import Foundation
import PDFKit
let src = URL(fileURLWithPath: "${raw}")
guard let doc = PDFDocument(url: src) else { fputs("no doc\\n", stderr); exit(1) }
let clean = PDFDocument()
for i in 0..<doc.pageCount { if let page = doc.page(at: i) { clean.insert(page, at: clean.pageCount) } }
for path in ["${shot}", "${download}"] {
  if !clean.write(to: URL(fileURLWithPath: path)) { fputs("write fail\\n", stderr); exit(1) }
}
print("${plan}", "pages", clean.pageCount)
`)
    await run('swift', [swiftPath])
    await run('xattr', ['-c', shot])
    await run('xattr', ['-c', download])
    console.log(download)
  }
} finally {
  vite.kill('SIGTERM')
}
