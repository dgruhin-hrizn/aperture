#!/usr/bin/env node
/**
 * Deep-merge overwrite: merges translated chunk into locale translation.json
 *
 * Usage: node apply-translated-chunk.mjs <locale> <translated-chunk.json>
 */
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = join(__dirname, '../..')

function deepMergeOverwrite(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) {
        target[k] = {}
      }
      deepMergeOverwrite(target[k], v)
    } else {
      target[k] = v
    }
  }
  return target
}

const locale = process.argv[2]
const chunkPath = process.argv[3]
if (!locale || !chunkPath) {
  console.error('Usage: node apply-translated-chunk.mjs <locale> <translated-chunk.json>')
  process.exit(1)
}

const targetFile = join(webRoot, 'src/i18n/locales', locale, 'translation.json')
const target = JSON.parse(fs.readFileSync(targetFile, 'utf8'))
const chunk = JSON.parse(fs.readFileSync(chunkPath, 'utf8'))
deepMergeOverwrite(target, chunk)
fs.writeFileSync(targetFile, JSON.stringify(target, null, 2) + '\n', 'utf8')
console.log('Applied chunk to', targetFile)
