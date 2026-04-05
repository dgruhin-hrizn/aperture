#!/usr/bin/env node
/**
 * Compares current English with the last committed locale file and writes
 * the subtree that was missing (what sync filled from en).
 *
 * Requires git. Run from repo root or apps/web:
 *   node scripts/i18n/export-missing-delta-from-git.mjs
 *
 * Output: scripts/i18n/delta/missing-from-en.json (one file; same subtree for every locale)
 */
import { execSync } from 'child_process'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = join(__dirname, '../..')
const deltaDir = join(__dirname, 'delta')
const repoRoot = join(webRoot, '../..')

const LOCALES = ['es', 'de', 'fr', 'it', 'pt', 'nl', 'ru', 'ja', 'zh', 'ko', 'hi', 'ar', 'he']

/**
 * Subtree present in `en` but not in `old` (by key path).
 * @param {unknown} en
 * @param {unknown} old
 */
function subtreeMissingFromOld(en, old) {
  if (en === null || typeof en !== 'object' || Array.isArray(en)) {
    return old === undefined ? en : undefined
  }
  if (old === null || typeof old !== 'object' || Array.isArray(old)) {
    return structuredClone(en)
  }
  const result = {}
  for (const [k, ev] of Object.entries(en)) {
    if (!(k in old)) {
      result[k] = structuredClone(ev)
    } else if (
      ev !== null &&
      typeof ev === 'object' &&
      !Array.isArray(ev) &&
      old[k] !== null &&
      typeof old[k] === 'object' &&
      !Array.isArray(old[k])
    ) {
      const sub = subtreeMissingFromOld(ev, old[k])
      if (sub !== undefined) {
        if (typeof sub === 'object' && !Array.isArray(sub) && Object.keys(sub).length === 0) continue
        result[k] = sub
      }
    }
  }
  return Object.keys(result).length ? result : undefined
}

function readGitLocale(locale) {
  const rel = `apps/web/src/i18n/locales/${locale}/translation.json`
  try {
    const buf = execSync(`git show HEAD:${rel}`, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    })
    return JSON.parse(buf)
  } catch {
    return null
  }
}

fs.mkdirSync(deltaDir, { recursive: true })

const enPath = join(webRoot, 'src/i18n/locales/en/translation.json')
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))

const first = LOCALES[0]
const old = readGitLocale(first)
if (!old) {
  console.error('No git history for', first)
  process.exit(1)
}
const delta = subtreeMissingFromOld(en, old)
const out = join(deltaDir, 'missing-from-en.json')
if (!delta) {
  console.log('No delta vs HEAD (locales already match en?); writing empty object')
  fs.writeFileSync(out, '{}\n', 'utf8')
  process.exit(0)
}
fs.writeFileSync(out, JSON.stringify(delta, null, 2) + '\n', 'utf8')
console.log('Wrote', out, 'bytes', fs.statSync(out).size)
