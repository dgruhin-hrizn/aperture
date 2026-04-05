#!/usr/bin/env node
/**
 * Parses simple-justwatch-python-api examples/providers_output.py (OfferPackage dumps)
 * and emits a TypeScript module: partnerProviderTerms.us.ts
 *
 * Source is unofficial; codes are country-specific (this file: US).
 * Regenerate: curl -sL https://raw.githubusercontent.com/Electronic-Mango/simple-justwatch-python-api/main/examples/providers_output.py | node scripts/parse-justwatch-providers-output.mjs
 */
import fs from 'node:fs'

const p = process.argv[2]
let text
if (p) {
  text = fs.readFileSync(p, 'utf8')
} else {
  text = fs.readFileSync(0, 'utf8')
}
if (!text?.trim()) {
  console.error('Usage: node parse-justwatch-providers-output.mjs <path-to-providers_output.py>')
  process.exit(1)
}

const re = /name="((?:\\.|[^"\\])*)",\s*technical_name="((?:\\.|[^"\\])*)",\s*short_name="((?:\\.|[^"\\])*)",/g
const rows = []
let m
while ((m = re.exec(text))) {
  const unescape = (s) => s.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  rows.push({
    clearName: unescape(m[1]).trim(),
    technicalName: unescape(m[2]).trim(),
    shortName: unescape(m[3]).trim(),
  })
}

const outPath = new URL('../packages/core/src/justwatch/partnerProviderTerms.us.ts', import.meta.url)
const header = `/**
 * JustWatch provider identifiers aligned with Partner API field names (technical_name, short_name, clear display name).
 *
 * **Scope:** United States only — extrapolated from the unofficial
 * [simple-justwatch-python-api](https://github.com/Electronic-Mango/simple-justwatch-python-api)
 * \`examples/providers_output.py\` (GraphQL \`packages\` query for US).
 *
 * **Not authoritative:** JustWatch adds/removes services; use
 * \`GET /api/discovery/streaming/providers?country=XX\` for live codes per country.
 *
 * @module partnerProviderTerms.us
 */

export interface PartnerProviderTerm {
  /** GraphQL / package filter id (often matches Partner \`technical_name\`). */
  technicalName: string
  /** Short code used in URLs and many filters (Partner \`short_name\`). */
  shortName: string
  /** Human-readable service name for this snapshot (Partner \`clear_name\` / display). */
  clearName: string
}

/** US provider terms (${rows.length} entries). */
export const PARTNER_PROVIDER_TERMS_US: readonly PartnerProviderTerm[] = [
`

const body = rows
  .map(
    (r) =>
      `  { technicalName: ${JSON.stringify(r.technicalName)}, shortName: ${JSON.stringify(r.shortName)}, clearName: ${JSON.stringify(r.clearName)} },`
  )
  .join('\n')

const footer = `\n]
`

fs.writeFileSync(outPath, header + body + footer, 'utf8')
console.error(`Wrote ${rows.length} rows to ${outPath.pathname}`)
