/**
 * Merges keys from en/translation.json into every other locale file
 * so structure stays aligned (missing keys get English fallback text).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localesDir = path.join(__dirname, '../src/i18n/locales')
const enPath = path.join(localesDir, 'en/translation.json')

function deepMergeMissing(target, source) {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return target !== undefined ? target : source
  }
  const t = target !== undefined && typeof target === 'object' && !Array.isArray(target) ? target : {}
  const out = { ...t }
  for (const k of Object.keys(source)) {
    const sv = source[k]
    const tv = out[k]
    if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
      out[k] = deepMergeMissing(tv, sv)
    } else if (tv === undefined) {
      out[k] = sv
    }
  }
  return out
}

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))
const codes = fs
  .readdirSync(localesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'en')
  .map((d) => d.name)

for (const code of codes) {
  const p = path.join(localesDir, code, 'translation.json')
  if (!fs.existsSync(p)) continue
  const existing = JSON.parse(fs.readFileSync(p, 'utf8'))
  const merged = deepMergeMissing(existing, en)
  fs.writeFileSync(p, JSON.stringify(merged, null, 2) + '\n')
  console.log('updated', code)
}
