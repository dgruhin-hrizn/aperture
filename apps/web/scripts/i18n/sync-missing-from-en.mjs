#!/usr/bin/env node
/**
 * Deep-merges English into each non-en locale so every key path exists.
 * Existing translations are never overwritten.
 *
 * Usage:
 *   node sync-missing-from-en.mjs              # sync all locales
 *   node sync-missing-from-en.mjs --dry-run    # print stats only
 *   node sync-missing-from-en.mjs de fr        # sync only these locale codes
 */
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localesRoot = join(__dirname, '../../src/i18n/locales')
const enPath = join(localesRoot, 'en/translation.json')

const LOCALES = ['es', 'de', 'fr', 'it', 'pt', 'nl', 'ru', 'ja', 'zh', 'ko', 'hi', 'ar', 'he']

/**
 * @param {unknown} target
 * @param {unknown} source
 * @returns {unknown}
 */
function deepFillMissing(target, source) {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return target !== undefined ? target : source
  }
  if (target === null || typeof target !== 'object' || Array.isArray(target)) {
    return structuredClone(source)
  }
  const result = { ...target }
  for (const [key, sv] of Object.entries(source)) {
    if (!(key in result)) {
      result[key] =
        sv !== null && typeof sv === 'object' && !Array.isArray(sv)
          ? deepFillMissing({}, sv)
          : sv
    } else if (
      sv !== null &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      result[key] !== null &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepFillMissing(result[key], sv)
    }
  }
  return result
}

function countLeaves(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return 1
  let n = 0
  for (const v of Object.values(obj)) {
    n += countLeaves(v)
  }
  return n
}

function flattenKeys(obj, prefix = '') {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return [prefix]
  }
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    keys.push(...flattenKeys(v, p))
  }
  return keys
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const filter = args.filter((a) => a !== '--dry-run')

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))
const enLeaves = countLeaves(en)

console.log(`en: ~${enLeaves} leaf values, ${flattenKeys(en).length} key paths`)

const locales = filter.length ? filter : LOCALES

for (const code of locales) {
  const path = join(localesRoot, code, 'translation.json')
  if (!fs.existsSync(path)) {
    console.error('Missing file:', path)
    process.exit(1)
  }
  const existing = JSON.parse(fs.readFileSync(path, 'utf8'))
  const beforeLeaves = countLeaves(existing)
  const merged = deepFillMissing(existing, en)
  const afterLeaves = countLeaves(merged)
  const added = afterLeaves - beforeLeaves

  console.log(`${code}: leaves ${beforeLeaves} -> ${afterLeaves} (+${added})`)

  if (!dryRun) {
    fs.writeFileSync(path, JSON.stringify(merged, null, 2) + '\n', 'utf8')
  }
}

if (dryRun) {
  console.log('(dry-run: no files written)')
}
