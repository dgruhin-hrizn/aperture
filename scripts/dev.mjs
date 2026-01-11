#!/usr/bin/env node

/**
 * Aperture Development CLI
 * Interactive menu for common development tasks
 */

import { spawn, execSync } from 'child_process'
import readline from 'readline'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

// Load .env.local for environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, '../.env.local') })

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
  bgBlue: '\x1b[44m',
}

const c = (color, text) => `${colors[color]}${text}${colors.reset}`

const menu = [
  { section: 'Development' },
  { key: '1', label: 'Start dev servers (API + Web)', cmd: 'pnpm dev' },
  { key: '2', label: 'Start API only', cmd: 'pnpm --filter @aperture/api dev' },
  { key: '3', label: 'Start Web only', cmd: 'pnpm --filter @aperture/web dev' },

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

  { section: 'Build & Quality' },
  { key: 'b', label: 'Build all packages', cmd: 'pnpm build' },
  { key: 't', label: 'Type check all', cmd: 'pnpm typecheck' },
  { key: 'l', label: 'Lint all', cmd: 'pnpm lint' },
  { key: 'f', label: 'Format code', cmd: 'pnpm format' },
  { key: 'c', label: 'Clean all (rm dist, node_modules)', cmd: 'pnpm clean' },
  { key: 'i', label: 'Install dependencies', cmd: 'pnpm install' },

  { section: 'Utilities' },
  { key: 'h', label: 'Check API health', cmd: 'curl -s http://localhost:3456/health | jq' },
  { key: 'r', label: 'Restart Docker app', cmd: 'docker compose restart app' },

  { section: '' },
  { key: 'q', label: 'Quit', action: 'quit' },
]

function printHeader() {
  console.clear()
  console.log()
  console.log(c('cyan', '  ╔═══════════════════════════════════════════════════════╗'))
  console.log(c('cyan', '  ║') + c('bold', '              🔮 Aperture Dev CLI                     ') + c('cyan', '║'))
  console.log(c('cyan', '  ╚═══════════════════════════════════════════════════════╝'))
  console.log()
}

function printMenu() {
  for (const item of menu) {
    if (item.section !== undefined) {
      if (item.section) {
        console.log()
        console.log(c('yellow', `  ── ${item.section} ──`))
      }
    } else {
      const key = c('green', `[${item.key}]`)
      console.log(`    ${key} ${item.label}`)
    }
  }
  console.log()
}

function printStatus() {
  // Check if Docker is running
  let dbStatus = c('red', '●')
  let appStatus = c('red', '●')

  try {
    const dbRunning = execSync('docker compose ps db --format "{{.State}}" 2>/dev/null', { encoding: 'utf-8' }).trim()
    if (dbRunning === 'running') dbStatus = c('green', '●')
  } catch {}

  try {
    const appRunning = execSync('docker compose ps app --format "{{.State}}" 2>/dev/null', { encoding: 'utf-8' }).trim()
    if (appRunning === 'running') appStatus = c('green', '●')
  } catch {}

  console.log(c('dim', `  Status: DB ${dbStatus}  App ${appStatus}`))
  console.log()
}

function runCommand(cmd, interactive = false) {
  return new Promise((resolve) => {
    console.log()
    console.log(c('dim', `  $ ${cmd}`))
    console.log()

    const shell = process.env.SHELL || '/bin/sh'
    const child = spawn(shell, ['-c', cmd], {
      stdio: 'inherit',
      cwd: process.cwd(),
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

  // Handle Ctrl+C gracefully
  rl.on('SIGINT', () => {
    console.log('\n')
    process.exit(0)
  })

  const prompt = () => {
    return new Promise((resolve) => {
      rl.question(c('cyan', '  Select option: '), (answer) => {
        resolve(answer.trim().toLowerCase())
      })
    })
  }

  while (true) {
    printHeader()
    printStatus()
    printMenu()

    const choice = await prompt()

    if (choice === 'q' || choice === 'quit') {
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
      await runCommand(item.cmd, item.interactive)
      await promptContinue(rl)
    }
  }
}

main().catch(console.error)

