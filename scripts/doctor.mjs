import { execFileSync } from 'node:child_process'

const requiredMajor = 24
const actualMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '', 10)
const checks = []

checks.push({
  name: 'Node.js',
  ok: actualMajor === requiredMajor,
  detail: `v${process.versions.node} (required: v${requiredMajor}.x)`,
})

for (const command of ['git']) {
  try {
    const version = execFileSync(command, ['--version'], { encoding: 'utf8' }).trim()
    checks.push({ name: command, ok: true, detail: version })
  } catch {
    checks.push({ name: command, ok: false, detail: 'not found on PATH' })
  }
}

const failed = checks.filter((check) => !check.ok)

for (const check of checks) {
  console.log(`${check.ok ? '✓' : '✗'} ${check.name}: ${check.detail}`)
}

if (failed.length > 0) {
  process.exitCode = 1
}
