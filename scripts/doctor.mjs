import { execFileSync } from 'node:child_process'

const requiredMajor = 24
const actualMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '', 10)
const checks = []

checks.push({
  name: 'Node.js',
  ok: actualMajor === requiredMajor,
  detail: `v${process.versions.node} (required: v${requiredMajor}.x)`,
})

const commands = [
  { name: 'git', args: ['--version'] },
  { name: 'pnpm', args: ['--version'] },
  { name: 'colima', args: ['status'] },
  { name: 'docker', args: ['version', '--format', '{{.Server.Version}}'] },
]

for (const command of commands) {
  try {
    const version = execFileSync(command.name, command.args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
    }).trim()
    checks.push({ name: command.name, ok: true, detail: version.split('\n')[0] || 'running' })
  } catch {
    checks.push({ name: command.name, ok: false, detail: 'not installed or not running' })
  }
}

const failed = checks.filter((check) => !check.ok)

for (const check of checks) {
  console.log(`${check.ok ? '✓' : '✗'} ${check.name}: ${check.detail}`)
}

if (failed.length > 0) {
  process.exitCode = 1
}
