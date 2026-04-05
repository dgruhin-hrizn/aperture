#!/usr/bin/env node

/**
 * Aperture — interactive command menu (pnpm menu / pnpm MENU)
 */

import { spawn, execSync } from 'child_process'
import readline from 'readline'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
config({ path: path.join(root, '.env.local') })

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
}

const c = (color, text) => `${colors[color]}${text}${colors.reset}`

/** @type {Array<{ section?: string, key?: string, label?: string, cmd?: string, interactive?: boolean, action?: string }>} */
const menu = [
  { section: 'Development' },
  { key: '1', label: 'Start dev servers (API + Web)', cmd: 'pnpm dev' },
  { key: '2', label: 'Start API only', cmd: 'pnpm --filter @aperture/api dev' },
  { key: '3', label: 'Start Web only', cmd: 'pnpm --filter @aperture/web dev' },

  { section: 'Web & i18n' },
  { key: 'w', label: 'Web — typecheck', cmd: 'pnpm --filter @aperture/web typecheck' },
  { key: 'm', label: 'Web — lint', cmd: 'pnpm --filter @aperture/web lint' },
  { key: 'g', label: 'Web — build', cmd: 'pnpm --filter @aperture/web build' },
  { key: 'j', label: 'i18n — sync missing from EN (all locales)', cmd: 'pnpm --filter @aperture/web i18n:sync' },
  { key: 'o', label: 'i18n — export delta chunks (git)', cmd: 'pnpm --filter @aperture/web i18n:delta' },
  { key: 'k', label: 'i18n — translate locales (Google, may take a while)', cmd: 'pnpm --filter @aperture/web i18n:translate' },
  { key: 'n', label: 'i18n — sync-i18n-from-en.mjs (apps/web)', cmd: 'node apps/web/scripts/sync-i18n-from-en.mjs' },

  { section: 'API & packages' },
  { key: 'a', label: 'API — typecheck', cmd: 'pnpm --filter @aperture/api typecheck' },
  { key: 'e', label: 'API — lint', cmd: 'pnpm --filter @aperture/api lint' },
  { key: 'v', label: 'Core — typecheck', cmd: 'pnpm --filter @aperture/core typecheck' },
  { key: 'u', label: 'UI — typecheck', cmd: 'pnpm --filter @aperture/ui typecheck' },

  { section: 'Docker' },
  { key: '4', label: 'Docker up (build & start)', cmd: 'pnpm docker:up' },
  { key: '5', label: 'Docker down', cmd: 'pnpm docker:down' },
  { key: '6', label: 'Docker logs (follow)', cmd: 'docker compose logs -f' },
  { key: '7', label: 'Docker logs (app only)', cmd: 'docker compose logs -f app' },
  { key: '8', label: 'Docker rebuild app', cmd: 'docker compose up -d --build app' },
  { key: '9', label: 'Start DB only', cmd: 'docker compose up -d db' },

  { section: 'Database' },
  { key: 'd', label: 'Run migrations', cmd: 'pnpm db:migrate' },
  { key: 's', label: 'Migration status', cmd: 'node scripts/migrate.mjs --status' },
  { key: 'p', label: 'Open psql shell', cmd: 'docker compose exec db psql -U app -d aperture', interactive: true },

  { section: 'Build & quality' },
  { key: 'b', label: 'Build all packages', cmd: 'pnpm build' },
  { key: 't', label: 'Typecheck all (recursive)', cmd: 'pnpm typecheck' },
  { key: 'l', label: 'Lint all (root eslint)', cmd: 'pnpm lint' },
  { key: 'x', label: 'Lint — fix (root)', cmd: 'pnpm lint:fix' },
  { key: 'f', label: 'Format code (Prettier)', cmd: 'pnpm format' },
  { key: 'y', label: 'Format — check only', cmd: 'pnpm format:check' },
  { key: 'c', label: 'Clean all (dist, node_modules)', cmd: 'pnpm clean' },
  { key: 'i', label: 'Install dependencies', cmd: 'pnpm install' },

  { section: 'Utilities' },
  { key: 'h', label: 'Check API health (localhost:3456)', cmd: 'curl -s http://localhost:3456/health | jq' },
  { key: 'r', label: 'Restart Docker app', cmd: 'docker compose restart app' },
  { key: 'z', label: 'Kill local dev processes (vite / api ports)', cmd: 'pnpm kill' },
  { key: '0', label: 'Debug: Seerr gap (script)', cmd: 'pnpm debug:seerr-gap' },

  { section: '' },
  { key: 'q', label: 'Quit', action: 'quit' },
]

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

function formatMenuLine(item) {
  const key = c('green', `[${item.key}]`)
  return `${key} ${item.label}`
}

/** Split items into two columns (first half left, second half right). */
function printSectionTwoColumns(items) {
  if (items.length === 0) return
  const mid = Math.ceil(items.length / 2)
  const left = items.slice(0, mid)
  const right = items.slice(mid)

  let maxLeftVisible = 0
  for (const it of left) {
    maxLeftVisible = Math.max(maxLeftVisible, stripAnsi(formatMenuLine(it)).length)
  }
  const colW = Math.min(62, Math.max(36, maxLeftVisible + 1))

  for (let r = 0; r < left.length; r++) {
    const leftStr = formatMenuLine(left[r])
    const pad = Math.max(0, colW - stripAnsi(leftStr).length)
    const rt = right[r]
    const rightStr = rt ? formatMenuLine(rt) : ''
    console.log(`    ${leftStr}${' '.repeat(pad)}  ${rightStr}`)
  }
}

/** Flatten menu into { title, items }[] in order. */
function groupMenuSections() {
  const sections = []
  let i = 0
  while (i < menu.length) {
    const item = menu[i]
    if (item.section !== undefined) {
      const title = item.section
      i++
      const items = []
      while (i < menu.length && menu[i].key !== undefined) {
        items.push(menu[i])
        i++
      }
      sections.push({ title, items })
    } else {
      i++
    }
  }
  return sections
}

function printHeader() {
  console.clear()
  console.log()
  console.log(c('cyan', '  ╔═══════════════════════════════════════════════════════╗'))
  console.log(c('cyan', '  ║') + c('bold', '              🔮 Aperture — pnpm menu                   ') + c('cyan', '║'))
  console.log(c('cyan', '  ╚═══════════════════════════════════════════════════════╝'))
  console.log()
}

function printMenu() {
  const sections = groupMenuSections()
  for (const sec of sections) {
    if (sec.title) {
      console.log()
      console.log(c('yellow', `  ── ${sec.title} ──`))
    }
    printSectionTwoColumns(sec.items)
  }
  console.log()
}

function printStatus() {
  let dbStatus = c('red', '●')
  let appStatus = c('red', '●')

  try {
    const dbRunning = execSync('docker compose ps db --format "{{.State}}" 2>/dev/null', {
      encoding: 'utf-8',
      cwd: root,
    }).trim()
    if (dbRunning === 'running') dbStatus = c('green', '●')
  } catch {}

  try {
    const appRunning = execSync('docker compose ps app --format "{{.State}}" 2>/dev/null', {
      encoding: 'utf-8',
      cwd: root,
    }).trim()
    if (appRunning === 'running') appStatus = c('green', '●')
  } catch {}

  console.log(c('dim', `  Status: DB ${dbStatus}  App ${appStatus}`))
  console.log()
}

function runCommand(cmd) {
  return new Promise((resolve) => {
    console.log()
    console.log(c('dim', `  $ ${cmd}`))
    console.log()

    const shell = process.env.SHELL || '/bin/sh'
    const child = spawn(shell, ['-c', cmd], {
      stdio: 'inherit',
      cwd: root,
    })

    child.on('close', (code) => {
      console.log()
      if (code === 0) {
        console.log(c('green', '  ✓ Command completed'))
      } else {
        console.log(c('red', `  ✗ Command exited with code ${code}`))
      }
      resolve(code)
    })

    child.on('error', (err) => {
      console.log(c('red', `  ✗ Error: ${err.message}`))
      resolve(1)
    })
  })
}

async function promptContinue(rl) {
  return new Promise((resolve) => {
    rl.question(c('dim', '\n  Press Enter to continue...'), () => {
      resolve()
    })
  })
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  rl.on('SIGINT', () => {
    console.log('\n')
    process.exit(0)
  })

  const prompt = () => {
    return new Promise((resolve) => {
      rl.question(c('cyan', '  Select option: '), (answer) => {
        resolve(answer.trim())
      })
    })
  }

  while (true) {
    printHeader()
    printStatus()
    printMenu()

    const choice = await prompt()

    if (choice === '' || choice === 'q' || choice.toLowerCase() === 'quit') {
      console.log(c('dim', '\n  Goodbye! 👋\n'))
      rl.close()
      process.exit(0)
    }

    const item = menu.find((m) => m.key === choice)

    if (!item) {
      console.log(c('red', '\n  Invalid option'))
      await promptContinue(rl)
      continue
    }

    if (item.action === 'quit') {
      console.log(c('dim', '\n  Goodbye! 👋\n'))
      rl.close()
      process.exit(0)
    }

    if (item.cmd) {
      await runCommand(item.cmd)
      await promptContinue(rl)
    }
  }
}

main().catch(console.error)
