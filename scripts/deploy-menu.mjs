#!/usr/bin/env node

/**
 * Aperture — interactive deploy menu (pnpm ship)
 *
 * Build, run, publish to GHCR, and deploy production stacks.
 */

import { spawn, execSync } from 'child_process'
import readline from 'readline'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
config({ path: path.join(root, '.env.local') })

const DEFAULT_GHCR_IMAGE = 'ghcr.io/dgruhin-hrizn/aperture'

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

function ghcrImage() {
  return process.env.APERTURE_GHCR_IMAGE || DEFAULT_GHCR_IMAGE
}

function packageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'apps/api/package.json'), 'utf-8'))
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function gitBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8', cwd: root }).trim()
  } catch {
    return 'unknown'
  }
}

function dockerTagForBranch(branch) {
  if (branch === 'main') return 'latest'
  if (branch === 'dev') return 'dev'
  return branch.replace(/[^a-zA-Z0-9._-]/g, '-')
}

/** @type {Array<{ section?: string, key?: string, label?: string, cmd?: string, interactive?: boolean, action?: string }>} */
const menu = [
  { section: 'Local development' },
  { key: '1', label: 'Start dev servers (API + Web)', cmd: 'pnpm dev' },
  { key: '2', label: 'Kill local dev processes', cmd: 'pnpm kill' },
  { key: '3', label: 'Docker dev stack (build from source)', cmd: 'docker compose up -d --build' },
  { key: '4', label: 'Docker dev — logs (follow)', cmd: 'docker compose logs -f app' },
  { key: '5', label: 'Docker dev — down', cmd: 'docker compose down' },

  { section: 'Build & verify' },
  { key: 'b', label: 'Build all packages', cmd: 'pnpm build' },
  { key: 'o', label: 'Build core only (local API after core edits)', cmd: 'pnpm --filter @aperture/core build' },
  { key: 't', label: 'Typecheck all', cmd: 'pnpm typecheck' },
  { key: 'l', label: 'Lint all', cmd: 'pnpm lint' },
  { key: 'f', label: 'Format check (Prettier)', cmd: 'pnpm format:check' },
  {
    key: 'd',
    label: 'Docker image — build locally (no push)',
    cmd: `docker build -f docker/Dockerfile -t ${ghcrImage()}:local .`,
  },

  { section: 'GHCR — auth & pull' },
  { key: 'g', label: 'Login to GHCR (via gh CLI token)', action: 'ghcr-login' },
  { key: 'p', label: 'Pull :dev image', cmd: `docker pull ${ghcrImage()}:dev` },
  { key: 'P', label: 'Pull :latest image', cmd: `docker pull ${ghcrImage()}:latest` },
  {
    key: 'v',
    label: 'Pull version tag (from package.json)',
    cmd: `docker pull ${ghcrImage()}:${packageVersion()}`,
  },

  { section: 'GHCR — publish' },
  { key: 'u', label: 'Push current branch via Git (triggers CI)', action: 'git-push' },
  { key: 'w', label: 'Trigger CI workflow manually (current branch)', action: 'workflow-dispatch' },
  { key: 'r', label: 'View recent CI workflow runs', cmd: 'gh run list --workflow=docker-build.yml --limit 8' },
  {
    key: 'x',
    label: 'Build & push — current platform only',
    action: 'docker-push-local',
  },
  {
    key: 'X',
    label: 'Build & push — multi-arch (amd64 + arm64, like CI)',
    action: 'docker-push-multiarch',
  },
  { key: 'T', label: 'Create version tag & push (triggers semver tags)', action: 'version-tag' },
  { key: 'B', label: 'Setup Docker buildx builder (one-time)', action: 'buildx-setup' },

  { section: 'Production deploy (GHCR images)' },
  {
    key: '6',
    label: 'Prod — pull & restart (docker-compose.prod.yml)',
    cmd: 'docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d',
  },
  { key: '7', label: 'Prod — logs (follow)', cmd: 'docker compose -f docker-compose.prod.yml logs -f app' },
  { key: '8', label: 'Prod — pull image only', cmd: 'docker compose -f docker-compose.prod.yml pull' },
  {
    key: '9',
    label: 'Prod — restart app container',
    cmd: 'docker compose -f docker-compose.prod.yml restart app',
  },

  { section: 'Compose profiles' },
  {
    key: 'e',
    label: 'External DB — pull & up',
    cmd: 'docker compose -f docker-compose.external-db.yml pull && docker compose -f docker-compose.external-db.yml up -d',
  },
  {
    key: 'n',
    label: 'Windows — pull & up',
    cmd: 'docker compose -f docker-compose.windows.yml pull && docker compose -f docker-compose.windows.yml up -d',
  },
  {
    key: 's',
    label: 'Synology — pull & up',
    cmd: 'docker compose -f docker-compose.synology.yml pull && docker compose -f docker-compose.synology.yml up -d',
  },
  {
    key: 'U',
    label: 'Unraid — pull & up',
    cmd: 'docker compose -f docker-compose.unraid.yml pull && docker compose -f docker-compose.unraid.yml up -d',
  },
  {
    key: 'q',
    label: 'QNAP — pull & up',
    cmd: 'docker compose -f docker-compose.qnap.yml pull && docker compose -f docker-compose.qnap.yml up -d',
  },

  { section: 'Database' },
  { key: 'm', label: 'Run migrations', cmd: 'pnpm db:migrate' },
  { key: 'S', label: 'Migration status', cmd: 'pnpm db:status' },

  { section: '' },
  { key: 'h', label: 'Open GHCR package page', action: 'open-ghcr' },
  { key: '0', label: 'Back to main menu (pnpm menu)', cmd: 'pnpm menu' },
  { key: 'Q', label: 'Quit', action: 'quit' },
]

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

function formatMenuLine(item) {
  const key = c('green', `[${item.key}]`)
  return `${key} ${item.label}`
}

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
  console.log(c('cyan', '  ║') + c('bold', '           🚀 Aperture — deploy menu                    ') + c('cyan', '║'))
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
  const branch = gitBranch()
  const image = ghcrImage()
  const version = packageVersion()
  const suggestedTag = dockerTagForBranch(branch)

  let dockerStatus = c('red', '●')
  let ghStatus = c('red', '●')

  try {
    execSync('docker info >/dev/null 2>&1', { cwd: root })
    dockerStatus = c('green', '●')
  } catch {}

  try {
    execSync('gh auth status >/dev/null 2>&1', { cwd: root })
    ghStatus = c('green', '●')
  } catch {}

  console.log(
    c(
      'dim',
      `  Branch: ${branch}  │  v${version}  │  Image: ${image}:${suggestedTag}  │  Docker ${dockerStatus}  gh ${ghStatus}`
    )
  )
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

async function promptLine(rl, message) {
  return new Promise((resolve) => {
    rl.question(message, (answer) => resolve(answer.trim()))
  })
}

async function promptContinue(rl) {
  return new Promise((resolve) => {
    rl.question(c('dim', '\n  Press Enter to continue...'), () => resolve())
  })
}

async function handleGhcrLogin() {
  const cmd =
    'gh auth token | docker login ghcr.io -u "$(gh api user -q .login)" --password-stdin'
  console.log(c('dim', '\n  Logs into ghcr.io using your GitHub CLI credentials.'))
  console.log(c('dim', '  Requires: gh CLI installed and authenticated (gh auth login).\n'))
  return runCommand(cmd)
}

async function handleGitPush(rl) {
  const branch = gitBranch()
  const confirm = await promptLine(
    rl,
    c('yellow', `  Push branch "${branch}" to origin? [y/N]: `)
  )
  if (confirm.toLowerCase() !== 'y') {
    console.log(c('dim', '  Cancelled.'))
    return 0
  }

  console.log(c('dim', '\n  CI publishes :dev on push to dev, :latest on push to main.\n'))
  return runCommand(`git push -u origin ${branch}`)
}

async function handleWorkflowDispatch() {
  const branch = gitBranch()
  console.log(c('dim', `\n  Dispatching "Build and Push Docker Image" on ref ${branch}...\n`))
  return runCommand(`gh workflow run docker-build.yml --ref ${branch}`)
}

async function handleDockerPushLocal(multiArch) {
  const branch = gitBranch()
  const tag = dockerTagForBranch(branch)
  const image = `${ghcrImage()}:${tag}`

  console.log(c('dim', `\n  Target image: ${image}`))
  if (multiArch) {
    console.log(c('dim', '  Platforms: linux/amd64, linux/arm64\n'))
    return runCommand(
      `docker buildx build --platform linux/amd64,linux/arm64 -f docker/Dockerfile -t ${image} --push .`
    )
  }

  console.log(c('dim', '  Platform: local default (current machine)\n'))
  return runCommand(`docker build -f docker/Dockerfile -t ${image} . && docker push ${image}`)
}

async function handleVersionTag(rl) {
  const defaultVersion = packageVersion()
  const input = await promptLine(
    rl,
    c('cyan', `  Version tag [v${defaultVersion}]: `)
  )
  const version = (input || defaultVersion).replace(/^v/, '')
  const tag = `v${version}`

  const confirm = await promptLine(
    rl,
    c('yellow', `  Create and push tag ${tag}? This triggers CI semver tags. [y/N]: `)
  )
  if (confirm.toLowerCase() !== 'y') {
    console.log(c('dim', '  Cancelled.'))
    return 0
  }

  return runCommand(`git tag ${tag} && git push origin ${tag}`)
}

async function handleBuildxSetup() {
  console.log(c('dim', '\n  Creates/uses a buildx builder for multi-arch pushes.\n'))
  return runCommand('docker buildx create --name aperture-builder --use 2>/dev/null || docker buildx use aperture-builder')
}

async function handleOpenGhcr() {
  const url = `https://github.com/${ghcrImage().replace('ghcr.io/', '')}/pkgs/container/aperture`
  const openCmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`
  console.log(c('dim', `\n  ${url}\n`))
  return runCommand(openCmd)
}

async function handleAction(item, rl) {
  switch (item.action) {
    case 'quit':
      console.log(c('dim', '\n  Goodbye! 👋\n'))
      rl.close()
      process.exit(0)
    case 'ghcr-login':
      return handleGhcrLogin()
    case 'git-push':
      return handleGitPush(rl)
    case 'workflow-dispatch':
      return handleWorkflowDispatch()
    case 'docker-push-local':
      return handleDockerPushLocal(false)
    case 'docker-push-multiarch':
      return handleDockerPushLocal(true)
    case 'version-tag':
      return handleVersionTag(rl)
    case 'buildx-setup':
      return handleBuildxSetup()
    case 'open-ghcr':
      return handleOpenGhcr()
    default:
      console.log(c('red', `\n  Unknown action: ${item.action}`))
      return 1
  }
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
      rl.question(c('cyan', '  Select option: '), (answer) => resolve(answer.trim()))
    })
  }

  while (true) {
    printHeader()
    printStatus()
    printMenu()

    const choice = await prompt()

    if (choice === '' || choice === 'Q' || choice.toLowerCase() === 'quit') {
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

    if (item.action) {
      await handleAction(item, rl)
      await promptContinue(rl)
      continue
    }

    if (item.cmd) {
      await runCommand(item.cmd)
      await promptContinue(rl)
    }
  }
}

main().catch(console.error)
