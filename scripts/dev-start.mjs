#!/usr/bin/env node

/**
 * Dev startup script that:
 * 1. Kills any existing processes on ports 3456 and 3457
 * 2. Starts the dev servers
 */

import { spawn, execSync } from 'child_process'

const PORTS = [3456, 3457, 3458]

function killProcessOnPort(port) {
  try {
    // Get PIDs using the port
    const result = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' }).trim()
    if (result) {
      const pids = result.split('\n').filter(Boolean)
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' })
          console.log(`✓ Killed process ${pid} on port ${port}`)
        } catch {
          // Process might have already exited
        }
      }
    }
  } catch {
    // No process on this port, that's fine
  }
}

function killOldProcesses() {
  // Kill by port
  for (const port of PORTS) {
    killProcessOnPort(port)
  }

  // Kill by process name patterns
  const patterns = ['tsx watch', 'vite.*3457', 'concurrently.*aperture']
  for (const pattern of patterns) {
    try {
      execSync(`pkill -f "${pattern}"`, { stdio: 'ignore' })
    } catch {
      // No matching processes
    }
  }
}

async function main() {
  console.log('🧹 Cleaning up old processes...')
  killOldProcesses()

  // Wait a moment for ports to be released
  await new Promise((resolve) => setTimeout(resolve, 1000))

  console.log('🚀 Starting dev servers...\n')

  // Start dev servers (use dev:raw to avoid recursion)
  const child = spawn('pnpm', ['dev:raw'], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  })

  child.on('error', (err) => {
    console.error('Failed to start dev servers:', err)
    process.exit(1)
  })

  child.on('exit', (code) => {
    process.exit(code || 0)
  })

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...')
    child.kill('SIGINT')
  })

  process.on('SIGTERM', () => {
    child.kill('SIGTERM')
  })
}

main()

