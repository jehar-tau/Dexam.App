// D-029: disposable fictional accounts and captured local emails only.
// Never print provider payloads, email bodies, links, tokens or passwords.
import { execFileSync } from 'node:child_process'
import { randomUUID, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { sendCapturedEmployeeEmail } from '../../supabase/functions/_shared/local-employee-email.mjs'

let config
try {
  config = JSON.parse(
    execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  )
  for (const url of [config.API_URL, config.MAILPIT_URL]) {
    if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname))
      throw new Error('Nonlocal configuration.')
  }
} catch {
  console.error('Local employee email configuration rejected; credential payloads withheld.')
  process.exit(1)
}
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options)
const client = createClient(config.API_URL, config.ANON_KEY, options)
const mailbox = `employee-email-${randomUUID()}`
const email = `${mailbox}@fixture.invalid`
let userId
let phase = 'invitation'
async function must(result) {
  if (result.error) throw new Error('Provider operation failed.')
  return result.data
}
try {
  const invited = await must(
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: 'http://127.0.0.1:5173/staff/activate',
    }),
  )
  userId = invited.user.id
  phase = 'captured email'
  let message
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(`${config.MAILPIT_URL}/api/v1/messages`)
    if (!response.ok) throw new Error('Capture inbox unavailable.')
    const inbox = await response.json()
    const messages = inbox.messages.filter((item) => item.To.some((to) => to.Address === email))
    if (messages.length) {
      message = messages.at(-1)
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  if (!message) throw new Error('No captured invitation.')
  const detail = await fetch(`${config.MAILPIT_URL}/api/v1/message/${message.ID}`).then(
    (response) => response.json(),
  )
  const html = detail.HTML ?? detail.Text ?? ''
  const links = html.match(/https?:[^\s"<>]+/g) ?? []
  const link = links
    .map((value) => new URL(value.replaceAll('&amp;', '&')))
    .find((url) => url.pathname === '/auth/v1/verify' && url.searchParams.get('type') === 'invite')
  if (!link || !['127.0.0.1', 'localhost'].includes(link.hostname))
    throw new Error('Unexpected invite link.')
  phase = 'single-use verification'
  const credential = link.searchParams.get('token')
  if (!credential) throw new Error('Missing verification token.')
  await must(await client.auth.verifyOtp({ token_hash: credential, type: 'invite' }))
  const replay = await client.auth.verifyOtp({ token_hash: credential, type: 'invite' })
  if (!replay.error) throw new Error('Invitation token replay allowed.')
  phase = 'employee password choice'
  await must(await client.auth.updateUser({ password: randomBytes(32).toString('base64url') }))
  const user = await must(await admin.auth.admin.getUserById(userId))
  if (!user.user.email_confirmed_at) throw new Error('Email ownership not confirmed.')
  phase = 'local recovery adapter'
  const recovery = await must(
    await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: 'http://127.0.0.1:5173/staff/recover' },
    }),
  )
  await sendCapturedEmployeeEmail(
    { mode: 'local-capture', apiURL: config.API_URL, captureURL: config.MAILPIT_URL },
    email,
    recovery.properties.action_link,
    'recovery',
  )
  const captured = await fetch(`${config.MAILPIT_URL}/api/v1/messages`).then((response) =>
    response.json(),
  )
  if (
    !captured.messages.some(
      (item) =>
        item.To.some((to) => to.Address === email) &&
        item.Subject === 'Fictional Dexam password recovery',
    )
  )
    throw new Error('Local recovery adapter did not capture email.')
  phase = 'recovery ownership proof'
  await must(
    await client.auth.verifyOtp({ token_hash: recovery.properties.hashed_token, type: 'recovery' }),
  )
  const recoveryReplay = await client.auth.verifyOtp({
    token_hash: recovery.properties.hashed_token,
    type: 'recovery',
  })
  if (!recoveryReplay.error) throw new Error('Recovery token replay allowed.')
  console.log(
    'Local provider email probe passed: invitation/recovery captured, ownership verified, replay denied, employee-controlled password accepted. Application activation/recovery acceptance remains separate.',
  )
} catch {
  console.error(
    `Local employee email probe failed during ${phase}; provider/email payloads withheld.`,
  )
  process.exitCode = 1
} finally {
  let accountCleaned = true
  try {
    if (userId) accountCleaned = !(await admin.auth.admin.deleteUser(userId)).error
  } catch {
    accountCleaned = false
  }
  if (!accountCleaned) {
    console.error('Disposable Auth account cleanup failed.')
    process.exitCode = 1
  }
  let cleaned
  try {
    const inbox = await fetch(`${config.MAILPIT_URL}/api/v1/messages`).then((response) =>
      response.json(),
    )
    const ids = inbox.messages
      .filter((item) => item.To.some((to) => to.Address === email))
      .map((item) => item.ID)
    // Mailpit deletes every message for an empty IDs array: never send one.
    cleaned =
      ids.length === 0 ||
      (
        await fetch(`${config.MAILPIT_URL}/api/v1/messages`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ IDs: ids }),
        })
      ).ok
  } catch {
    cleaned = false
  }
  if (!cleaned) {
    console.error('Disposable capture inbox cleanup failed.')
    process.exitCode = 1
  }
  if (!process.exitCode) console.log('Disposable Auth account and captured email removed.')
}
