import { readFileSync } from 'node:fs'

// This relative path is identical from src/lib and the compiled dist/lib.
// The runtime image ships apps/api/package.json alongside dist.
export const APP_VERSION: string = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
).version
