#!/usr/bin/env node
/**
 * Fills non-English locale files by translating string leaves that still match
 * English (typical after `pnpm i18n:sync`). Preserves {{placeholders}}; skips
 * brand names and trivial tokens.
 *
 * Uses google-translate-api-x (unofficial Google Translate). Max ~5000 chars
 * per request — batches strings accordingly. Add small delays to reduce 429s.
 *
 * Usage (from apps/web):
 *   node scripts/i18n/translate-locales-from-en.mjs
 *   node scripts/i18n/translate-locales-from-en.mjs fr de
 *   node scripts/i18n/translate-locales-from-en.mjs --dry-run
 *   node scripts/i18n/translate-locales-from-en.mjs --max 200 fr
 */
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { translate } from 'google-translate-api-x'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localesRoot = join(__dirname, '../../src/i18n/locales')
const enPath = join(localesRoot, 'en/translation.json')

const ALL_LOCALES = ['es', 'de', 'fr', 'it', 'pt', 'nl', 'ru', 'ja', 'zh', 'ko', 'hi', 'ar', 'he']

/** google-translate-api-x `to` codes (see languages.cjs) */
const GOOGLE_TO = {
  es: 'es',
  de: 'de',
  fr: 'fr',
  it: 'it',
  pt: 'pt',
  nl: 'nl',
  ru: 'ru',
  ja: 'ja',
  zh: 'zh-CN',
  ko: 'ko',
  hi: 'hi',
  ar: 'ar',
  he: 'he',
}

/** Exact strings to leave as-is (brands / product names often unchanged) */
/**
 * UI terms where machine translation often picks the wrong sense (navigation vs body part).
 * Applied after each locale run.
 */
const MANUAL_OVERRIDES_BY_LOCALE = {
  fr: { 'common.back': 'Retour' },
  ko: { 'common.back': '뒤로' },
  ar: { 'common.back': 'رجوع' },
}

const EXACT_KEEP = new Set([
  'Aperture',
  'TMDb',
  'TMDB',
  'Emby',
  'Jellyfin',
  'Trakt',
  'Seerr',
  'OMDb',
  'MDBList',
  'OpenAI',
  'Anthropic',
  'Google',
  'Plex',
  'Kodi',
  'JSON',
  'REST',
  'API',
  'GPU',
  'CPU',
  'RSS',
  'SSE',
  'SQL',
  'OK',
  'TV',
  'IMDb',
  'DVD',
  'HDR',
  'SDR',
  '4K',
  'UI',
  'URL',
  'HTTP',
  'HTTPS',
  'SSL',
  'TLS',
])

function shouldSkip(s) {
  const t = s.trim()
  if (!t) return true
  if (EXACT_KEEP.has(t)) return true
  if (/^https?:\/\//i.test(t)) return true
  if (/^[\d\s\-–—.,:;!?()[\]{}%]+$/u.test(t) && t.length < 40) return true
  if (/^v?\d+\.\d+(\.\d+)?$/i.test(t)) return true
  if (/^[#@][\w-]+$/.test(t)) return true
  return false
}

function getByPath(obj, path) {
  const parts = path.split('.')
  let cur = obj
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = cur[p]
  }
  return cur
}

function setByPath(obj, path, value) {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (cur[p] === null || typeof cur[p] !== 'object' || Array.isArray(cur[p])) {
      cur[p] = {}
    }
    cur = cur[p]
  }
  cur[parts[parts.length - 1]] = value
}

/**
 * @param {unknown} enNode
 * @param {unknown} locNode
 * @param {string} prefix
 * @returns {{ path: string, text: string }[]}
 */
function collectUntranslated(enNode, locNode, prefix = '') {
  const jobs = []
  if (typeof enNode === 'string') {
    const locStr = typeof locNode === 'string' ? locNode : enNode
    if (locStr === enNode && !shouldSkip(enNode)) {
      jobs.push({ path: prefix, text: enNode })
    }
    return jobs
  }
  if (enNode === null || typeof enNode !== 'object' || Array.isArray(enNode)) {
    return jobs
  }
  const loc = locNode && typeof locNode === 'object' && !Array.isArray(locNode) ? locNode : {}
  for (const [k, ev] of Object.entries(enNode)) {
    const p = prefix ? `${prefix}.${k}` : k
    jobs.push(...collectUntranslated(ev, loc[k], p))
  }
  return jobs
}

const MAX_CHARS_PER_BATCH = 4200
const BATCH_DELAY_MS = 350
const MAX_RETRIES = 4

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function translateBatch(strings, opts) {
  let lastErr
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await translate(strings, {
        ...opts,
        forceBatch: true,
      })
      if (!Array.isArray(res)) {
        return [res.text]
      }
      return res.map((r) => r.text)
    } catch (e) {
      lastErr = e
      const wait = 800 * Math.pow(2, attempt) + Math.random() * 400
      console.warn(`  batch failed (${e.message || e}), retry in ${Math.round(wait)}ms`)
      await sleep(wait)
    }
  }
  throw lastErr
}

async function runLocale(localeCode, en, dryRun, maxJobs) {
  const googleTo = GOOGLE_TO[localeCode]
  if (!googleTo) {
    console.error('Unknown locale:', localeCode)
    return
  }
  const filePath = join(localesRoot, localeCode, 'translation.json')
  const loc = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  let jobs = collectUntranslated(en, loc)
  if (maxJobs != null && maxJobs > 0) {
    jobs = jobs.slice(0, maxJobs)
  }

  console.log(`\n${localeCode} → ${googleTo}: ${jobs.length} strings to translate`)

  if (dryRun) {
    return
  }

  const opts = {
    from: 'en',
    to: googleTo,
    forceTo: googleTo === 'zh-CN',
  }

  let done = 0
  let i = 0
  while (jobs.length > 0 && i < jobs.length) {
    const batch = []
    let chars = 0
    while (i < jobs.length) {
      const next = jobs[i].text
      if (batch.length && (chars + next.length > MAX_CHARS_PER_BATCH || batch.length >= 80)) {
        break
      }
      batch.push(next)
      chars += next.length
      i++
    }

    const texts = await translateBatch(batch, opts)
    if (texts.length !== batch.length) {
      throw new Error(`Batch size mismatch: expected ${batch.length}, got ${texts.length}`)
    }
    const startIdx = i - batch.length
    for (let j = 0; j < batch.length; j++) {
      setByPath(loc, jobs[startIdx + j].path, texts[j])
    }
    done += batch.length
    process.stdout.write(`  ${done}/${jobs.length}\r`)
    await sleep(BATCH_DELAY_MS)
  }
  let overrideChanged = false
  const overrides = MANUAL_OVERRIDES_BY_LOCALE[localeCode]
  if (overrides) {
    for (const [path, value] of Object.entries(overrides)) {
      if (getByPath(loc, path) !== value) {
        setByPath(loc, path, value)
        overrideChanged = true
      }
    }
  }

  if (done > 0 || overrideChanged) {
    console.log(`\n  wrote ${filePath}`)
    fs.writeFileSync(filePath, JSON.stringify(loc, null, 2) + '\n', 'utf8')
  }
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const maxArg = args.find((a) => a.startsWith('--max='))
const maxJobs = maxArg ? parseInt(maxArg.split('=')[1], 10) : null
let locales = args.filter((a) => !a.startsWith('--'))

if (locales.length === 0) {
  locales = ALL_LOCALES
}

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))

;(async () => {
  for (const loc of locales) {
    if (loc === 'en') continue
    await runLocale(loc, en, dryRun, maxJobs)
  }
  console.log('\nDone.')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
