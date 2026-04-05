#!/usr/bin/env node
/**
 * Splits scripts/i18n/delta/missing-from-en.json into chunk-NN.json files
 * (~18–22KB serialized per chunk) for batched translation.
 *
 * Usage: node split-delta-chunks.mjs
 */
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const deltaDir = join(__dirname, 'delta')
const src = join(deltaDir, 'missing-from-en.json')
const MAX_CHUNK = 20 * 1024

const d = JSON.parse(fs.readFileSync(src, 'utf8'))
const keys = Object.keys(d)
let cur = {}
let size = 0
let n = 1

function flush() {
  if (Object.keys(cur).length === 0) return
  const out = join(deltaDir, `chunk-${String(n).padStart(2, '0')}.json`)
  fs.writeFileSync(out, JSON.stringify(cur, null, 2) + '\n', 'utf8')
  console.log(out, fs.statSync(out).size, 'keys', Object.keys(cur).length)
  n++
  cur = {}
  size = 0
}

for (const k of keys) {
  const part = { [k]: d[k] }
  const add = JSON.stringify(part).length
  if (size + add > MAX_CHUNK && Object.keys(cur).length > 0) {
    flush()
  }
  cur[k] = d[k]
  size += add
}
flush()
