// Local, sequential and credential-safe. Never reset the shared DB or replay raw child output.
import { execFileSync, spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { assertLocalPilotConfig } from './pilot-safety.mjs'

async function available(port) {
  await new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', () =>
      reject(new Error('A pilot frontend port is busy; existing process left untouched.')),
    )
    server.listen(port, '127.0.0.1', () => server.close(resolve))
  })
}
async function run(label, command, args) {
  console.log(`${label}: starting`)
  const passed = await new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    child.once('error', () => resolve(false))
    child.once('exit', (code) => resolve(code === 0))
  })
  if (!passed)
    throw new Error(
      `${label}: failed. Stop and inspect this step and its exact fixture cleanup before rerunning; raw child output withheld.`,
    )
  console.log(`${label}: passed`)
}
try {
  if (process.argv.slice(2).some((arg) => arg !== '--check'))
    throw new Error('Unsupported pilot argument.')
  let config
  try {
    config = JSON.parse(
      execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    )
  } catch {
    throw new Error(
      'Local Supabase is unavailable; provider output withheld. Start the existing local project without resetting it.',
    )
  }
  assertLocalPilotConfig(config)
  const databasePort = execFileSync(
    'docker',
    [
      'inspect',
      '--format',
      '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
      'supabase_db_dexam-platform',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim()
  if (new URL(config.DB_URL).port !== databasePort)
    throw new Error('Local database identity mismatch.')
  await available(5173)
  await available(4173)
  const edge = await fetch(config.API_URL + '/functions/v1/student-sign-in', { redirect: 'error' })
  if (![401, 405].includes(edge.status))
    throw new Error(
      'Local Edge worker preflight failed; verify the existing local-only function configuration.',
    )
  console.log(
    'Pilot preflight passed: loopback services, expected DB, free frontend ports and local Edge worker. No data reset or production access.',
  )
  if (!process.argv.includes('--check')) {
    for (const [label, command, args] of [
      ['Static/app verification', 'pnpm', ['verify']],
      ['Database authorization suite', 'pnpm', ['db:test']],
      ['Chromium smoke journeys', 'pnpm', ['test:e2e']],
      ...[
        ['Account switch/revocation', 'verify-local-account-isolation.mjs'],
        ['Composed admissions/academic pilot', 'verify-local-admissions-journey.mjs'],
        ['Initial activation', 'verify-local-student-activation-link.mjs'],
        ['Employee invitation', 'verify-local-employee-invitation.mjs', '--browser'],
        ['Employee recovery', 'verify-local-employee-recovery.mjs', '--browser'],
        ['Independent student recovery', 'verify-local-student-recovery.mjs', '--browser'],
        ['Closeout/archive/checklist/classes', 'verify-local-enrollment-closeout.mjs'],
        ['Private lesson files/impact preview', 'verify-local-lesson-files.mjs'],
        ['Actual native scheduled tick', 'verify-local-native-worker.mjs'],
      ].map(([label, script, ...args]) => [
        label,
        process.execPath,
        ['scripts/staging/' + script, ...args],
      ]),
    ])
      await run(label, command, args)
    console.log(
      'Fictional local pilot automated acceptance passed. Owner UX review and all production gates remain separate.',
    )
  }
} catch (error) {
  // Never expose a raw child_process/fetch error that might carry environment or provider data.
  const safe =
    error instanceof Error &&
    /^(Local |A pilot |Pilot |Unsupported |Static\/app |Database authorization |Chromium smoke |Account switch|Composed admissions|Initial activation|Employee invitation|Employee recovery|Independent student|Closeout\/archive|Private lesson|Actual native)/.test(
      error.message,
    )
  console.error(
    safe
      ? error.message
      : 'Pilot preflight/acceptance failed; provider details withheld. Inspect local tooling and exact fixture cleanup.',
  )
  process.exitCode = 1
}
