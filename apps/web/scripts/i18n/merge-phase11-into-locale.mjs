#!/usr/bin/env node
/**
 * Merges translated Phase 11 namespaces (settings*, language, userSettings)
 * into apps/web/src/i18n/locales/<locale>/translation.json
 *
 * Usage: node merge-phase11-into-locale.mjs <locale> <translated-json-path>
 * Example: node merge-phase11-into-locale.mjs de ./de-phase11.json
 */
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../..')
const locale = process.argv[2]
const translatedPath = process.argv[3]

if (!locale || !translatedPath) {
  console.error('Usage: node merge-phase11-into-locale.mjs <locale> <translated-json-path>')
  process.exit(1)
}

const targetFile = join(root, 'src/i18n/locales', locale, 'translation.json')
const translated = JSON.parse(fs.readFileSync(translatedPath, 'utf8'))
const existing = JSON.parse(fs.readFileSync(targetFile, 'utf8'))

for (const key of Object.keys(translated)) {
  existing[key] = translated[key]
}

fs.writeFileSync(targetFile, JSON.stringify(existing, null, 2) + '\n', 'utf8')
console.log('Updated', targetFile, 'keys:', Object.keys(translated).join(', '))
