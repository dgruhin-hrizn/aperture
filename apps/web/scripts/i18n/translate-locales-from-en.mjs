#!/usr/bin/env node
/**
 * Fills non-English locale files by translating string leaves that still match
 * English (typical after `pnpm i18n:sync`). Preserves {{placeholders}}; skips
 * brand names and trivial tokens.
 *
 * Uses the OpenAI API (chatgpt-5.4 by default) for natural, context-aware
 * translations. Requires OPENAI_API_KEY in the environment.
 *
 * Usage (from apps/web):
 *   node scripts/i18n/translate-locales-from-en.mjs
 *   node scripts/i18n/translate-locales-from-en.mjs fr de
 *   node scripts/i18n/translate-locales-from-en.mjs --dry-run
 *   node scripts/i18n/translate-locales-from-en.mjs --max=200 fr
 *   node scripts/i18n/translate-locales-from-en.mjs --model gpt-4.1-mini
 *   node scripts/i18n/translate-locales-from-en.mjs --force de   # retranslate ALL strings
 */
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import OpenAI from 'openai'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localesRoot = join(__dirname, '../../src/i18n/locales')
const enPath = join(localesRoot, 'en/translation.json')

const ALL_LOCALES = ['es', 'de', 'fr', 'it', 'pt', 'nl', 'ru', 'ja', 'zh', 'ko', 'hi', 'ar', 'he']

const LANG_NAMES = {
  es: 'Spanish',
  de: 'German',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese (Brazilian)',
  nl: 'Dutch',
  ru: 'Russian',
  ja: 'Japanese',
  zh: 'Simplified Chinese',
  ko: 'Korean',
  hi: 'Hindi',
  ar: 'Arabic',
  he: 'Hebrew',
}

const BRAND_NAMES = [
  'Aperture', 'TMDb', 'TMDB', 'Emby', 'Jellyfin', 'Trakt', 'Seerr', 'OMDb',
  'MDBList', 'OpenAI', 'Anthropic', 'Google', 'Plex', 'Kodi', 'IMDb',
]

const EXACT_KEEP = new Set([
  ...BRAND_NAMES,
  'JSON', 'REST', 'API', 'GPU', 'CPU', 'RSS', 'SSE', 'SQL', 'OK', 'TV',
  'DVD', 'HDR', 'SDR', '4K', 'UI', 'URL', 'HTTP', 'HTTPS', 'SSL', 'TLS',
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
 * Collect strings where the locale value still equals English (untranslated).
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

/**
 * Collect ALL translatable English strings regardless of current locale value.
 * Used with --force to retranslate everything from scratch.
 * @param {unknown} enNode
 * @param {string} prefix
 * @returns {{ path: string, text: string }[]}
 */
function collectAll(enNode, prefix = '') {
  const jobs = []
  if (typeof enNode === 'string') {
    if (!shouldSkip(enNode)) {
      jobs.push({ path: prefix, text: enNode })
    }
    return jobs
  }
  if (enNode === null || typeof enNode !== 'object' || Array.isArray(enNode)) {
    return jobs
  }
  for (const [k, ev] of Object.entries(enNode)) {
    const p = prefix ? `${prefix}.${k}` : k
    jobs.push(...collectAll(ev, p))
  }
  return jobs
}

const MAX_CHARS_PER_BATCH = 6000
const MAX_KEYS_PER_BATCH = 60
const BATCH_DELAY_MS = 200
const MAX_RETRIES = 4

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function buildSystemPrompt(langName) {
  return `You are a professional translator for a media management application called "Aperture" (a movie/TV library manager). Translate the provided UI strings from English to ${langName}.

Rules:
- Return ONLY valid JSON with the exact same keys as the input. No extra keys, no missing keys.
- Preserve all {{placeholder}} tokens exactly as-is (e.g. {{count}}, {{name}}, {{title}}).
- Keep these brand/product names unchanged: ${BRAND_NAMES.join(', ')}.
- Keep technical acronyms unchanged: API, JSON, URL, HTTP, HTTPS, SSL, TLS, REST, RSS, SSE, SQL, GPU, CPU, HDR, SDR, DVD, UI, TV, 4K, IMDb.
- Use natural, idiomatic ${langName} phrasing appropriate for a modern software UI.
- Tone: casual and clear, not overly formal or stiff.
- For keys ending in "_plural", ensure the translation handles the plural form naturally.
- Do not add trailing punctuation unless the English source has it.
- Do not transliterate or localize proper nouns that are product names.`
}

/**
 * @param {OpenAI} client
 * @param {Record<string, string>} keyTextMap - { "dotted.key": "English text", ... }
 * @param {string} langName
 * @param {string} model
 * @returns {Promise<Record<string, string>>}
 */
async function translateBatch(client, keyTextMap, langName, model) {
  const keys = Object.keys(keyTextMap)
  let lastErr

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt(langName) },
          { role: 'user', content: JSON.stringify(keyTextMap) },
        ],
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from OpenAI')
      }

      const parsed = JSON.parse(content)

      const missing = keys.filter((k) => !(k in parsed))
      if (missing.length > 0) {
        throw new Error(`Response missing keys: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ''}`)
      }

      const result = {}
      for (const k of keys) {
        result[k] = typeof parsed[k] === 'string' ? parsed[k] : keyTextMap[k]
      }
      return result
    } catch (e) {
      lastErr = e
      const wait = 1000 * Math.pow(2, attempt) + Math.random() * 500
      console.warn(`  batch failed (${e.message || e}), retry in ${Math.round(wait)}ms`)
      await sleep(wait)
    }
  }
  throw lastErr
}

async function runLocale(client, localeCode, en, dryRun, maxJobs, model, force) {
  const langName = LANG_NAMES[localeCode]
  if (!langName) {
    console.error('Unknown locale:', localeCode)
    return
  }
  const filePath = join(localesRoot, localeCode, 'translation.json')
  const loc = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  let jobs = force ? collectAll(en) : collectUntranslated(en, loc)
  if (maxJobs != null && maxJobs > 0) {
    jobs = jobs.slice(0, maxJobs)
  }

  console.log(`\n${localeCode} (${langName}): ${jobs.length} strings to translate`)

  if (dryRun || jobs.length === 0) {
    return
  }

  let done = 0
  let i = 0
  while (i < jobs.length) {
    const batchMap = {}
    let chars = 0
    let batchSize = 0
    while (i < jobs.length) {
      const next = jobs[i].text
      if (batchSize > 0 && (chars + next.length > MAX_CHARS_PER_BATCH || batchSize >= MAX_KEYS_PER_BATCH)) {
        break
      }
      batchMap[jobs[i].path] = next
      chars += next.length
      batchSize++
      i++
    }

    const translated = await translateBatch(client, batchMap, langName, model)

    for (const [path, text] of Object.entries(translated)) {
      setByPath(loc, path, text)
    }
    done += batchSize
    process.stdout.write(`  ${done}/${jobs.length}\r`)
    if (i < jobs.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  console.log(`  ${done}/${jobs.length} — writing ${filePath}`)
  fs.writeFileSync(filePath, JSON.stringify(loc, null, 2) + '\n', 'utf8')
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')

const maxArg = args.find((a) => a.startsWith('--max='))
const maxJobs = maxArg ? parseInt(maxArg.split('=')[1], 10) : null

const modelIdx = args.indexOf('--model')
const model = modelIdx !== -1 && args[modelIdx + 1] ? args[modelIdx + 1] : 'gpt-4.1-mini'

const skipFlags = new Set(['--dry-run', '--force', '--model', maxArg].filter(Boolean))
let locales = args.filter((a) => !skipFlags.has(a) && a !== model)

if (locales.length === 0) {
  locales = ALL_LOCALES
}

if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required.')
  console.error('  export OPENAI_API_KEY=sk-...')
  process.exit(1)
}

const client = new OpenAI()
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))

console.log(`Model: ${model}`)
if (dryRun) console.log('(dry run — no files will be written)')
if (force) console.log('(force — retranslating ALL strings from English)')

;(async () => {
  for (const loc of locales) {
    if (loc === 'en') continue
    await runLocale(client, loc, en, dryRun, maxJobs, model, force)
  }
  console.log('\nDone.')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
