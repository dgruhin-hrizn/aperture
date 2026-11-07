import fs from 'node:fs/promises'
import path from 'node:path'

async function collect(directory) {
  const files = []
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'release-notes') continue // Historical snapshots retain historical links.
    const name = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await collect(name)))
    else if (name.endsWith('.md')) files.push(name)
  }
  return files
}
const files = ['README.md', ...(await collect('docs'))]
const failures = []
for (const file of files) {
  const text = await fs.readFile(file, 'utf8')
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const link = match[1]
    if (/^(?:[a-z]+:|#)/i.test(link)) continue
    const target = decodeURIComponent(link.split(/[?#]/)[0])
    if (!target) continue
    try {
      await fs.access(path.resolve(path.dirname(file), target))
    } catch {
      failures.push(`${file}: ${link}`)
    }
  }
}
if (failures.length) {
  process.stderr.write(failures.join('\n') + '\n')
  process.exitCode = 1
} else
  process.stdout.write(`Checked local file links in ${files.length} current Markdown guides.\n`)
