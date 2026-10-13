// Read-only provider configuration plus one disposable LOCAL Auth account.
// Credentials, seeds, codes and tokens are never printed or persisted.
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { totp } from './local-totp.mjs'

const config = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
)
const url = new URL(config.API_URL)
if (!['127.0.0.1', 'localhost'].includes(url.hostname))
  throw new Error('Probe is restricted to local Auth.')
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options)
const client = createClient(config.API_URL, config.ANON_KEY, options)
const email = `mfa-probe-${randomUUID()}@fixture.invalid`
const password = randomBytes(32).toString('base64url')
let userId
let phase = 'creation'
try {
  phase = 'signup-denial'
  const signup = await client.auth.signUp({ email, password })
  if (signup.data?.user) userId = signup.data.user.id
  if (!signup.error || signup.error.code !== 'signup_disabled')
    throw new Error('Public signup was not denied.')
  console.log('Public signup remains disabled.')
  phase = 'creation'
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error || !created.data.user) throw new Error('Local fixture creation failed.')
  userId = created.data.user.id
  phase = 'sign-in'
  const login = await client.auth.signInWithPassword({ email, password })
  if (login.error) {
    const code = login.error.code
    if (code && /^[a-z_]+$/.test(code)) console.error(`Local sign-in error category: ${code}`)
    throw new Error('Local fixture sign-in failed.')
  }
  phase = 'enrolment'
  const enrolled = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Disposable probe',
  })
  if (enrolled.error || !enrolled.data) throw new Error('Local fixture enrolment failed.')
  const factorId = enrolled.data.id
  phase = 'verification'
  const verified = await client.auth.mfa.challengeAndVerify({
    factorId,
    code: totp(enrolled.data.totp.secret),
  })
  if (verified.error) throw new Error('Local fixture verification failed.')
  phase = 'assurance'
  const before = await client.auth.mfa.getAuthenticatorAssuranceLevel()
  if (before.data?.currentLevel !== 'aal2') throw new Error('Local fixture did not reach aal2.')
  phase = 'live-assurance'
  const liveBefore = await client.rpc('current_session_has_live_mfa')
  if (liveBefore.error || liveBefore.data !== true) throw new Error('Live MFA was not confirmed.')
  const staleTokenClient = createClient(config.API_URL, config.ANON_KEY, {
    ...options,
    global: { headers: { Authorization: `Bearer ${verified.data.access_token}` } },
  })
  phase = 'removal'
  const removed = await client.auth.mfa.unenroll({ factorId })
  phase = 'factor-state'
  const factors = await admin.auth.admin.mfa.listFactors({ userId })
  if (factors.error) throw new Error('Local factor-state verification failed.')
  phase = 'stale-token-denial'
  const liveAfter = await staleTokenClient.rpc('current_session_has_live_mfa')
  if (liveAfter.error || liveAfter.data !== false)
    throw new Error('Stale MFA assurance was not denied.')
  console.log(
    JSON.stringify({
      localOnly: true,
      reachedAal2: true,
      directFinalFactorRemovalAllowed: !removed.error,
      remainingFactors: factors.data.factors.length,
      liveMfaBeforeRemoval: liveBefore.data,
      staleTokenMfaAfterRemoval: liveAfter.data,
    }),
  )
} catch {
  console.error(
    `Local MFA probe failed during ${phase}. Provider payloads withheld to protect fixture credentials.`,
  )
  process.exitCode = 1
} finally {
  if (userId) {
    const result = await admin.auth.admin.deleteUser(userId)
    if (result.error) {
      console.error('Disposable local Auth account cleanup failed.')
      process.exitCode = 1
    } else console.log('Disposable local Auth account removed.')
  }
}
