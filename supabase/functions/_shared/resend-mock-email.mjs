// No fetch, SDK, environment lookup or runtime integration exists here.
// Actual delivery requires a separately reviewed transport and activation.
import {
  prepareAuthenticationEmail,
  assertPreparedAuthenticationEmail,
} from './authentication-email.mjs'
const endpoint = 'https://api.resend.com/emails'
const unavailable = 'Mock authentication email transport is unavailable.'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export function buildResendMockRequest(message) {
  assertPreparedAuthenticationEmail(message)
  return Object.freeze({
    endpoint,
    method: 'POST',
    redirect: 'error',
    headers: Object.freeze({
      Authorization: 'Bearer fixture-not-a-real-key',
      'Content-Type': 'application/json',
      'Idempotency-Key': `dexam/${message.purpose}/${message.requestId}/${message.deliveryId}`,
    }),
    body: JSON.stringify({
      from: message.from,
      to: [message.recipient],
      subject: message.subject,
      text: message.text,
    }),
  })
}
function classify(response) {
  if (!response || response.kind !== 'response' || !Number.isInteger(response.status))
    return 'uncertain'
  if (
    response.status === 200 &&
    response.body &&
    typeof response.body === 'object' &&
    Object.keys(response.body).length === 1 &&
    uuid.test(response.body.id)
  )
    return 'accepted'
  if (response.status >= 400 && response.status < 500 && ![408, 409].includes(response.status))
    return 'rejected'
  return 'uncertain'
}
export function createResendMockAdapter(config, script, clock = Date.now) {
  let configCopy, responses
  try {
    // Capture only inert data, never a caller-supplied transport callback.
    if (
      !config ||
      Object.getPrototypeOf(config) !== Object.prototype ||
      Object.keys(config).sort().join(',') !== 'appOrigin,from,mode' ||
      typeof config.mode !== 'string' ||
      typeof config.from !== 'string' ||
      typeof config.appOrigin !== 'string' ||
      typeof clock !== 'function' ||
      !Array.isArray(script) ||
      script.length < 1 ||
      script.length > 2 ||
      script.some((item) => !item || !['response', 'timeout', 'network-error'].includes(item.kind))
    )
      throw new Error()
    const serialized = JSON.stringify({ config, script })
    if (serialized.length > 8192) throw new Error()
    const snapshot = JSON.parse(serialized)
    configCopy = snapshot.config
    responses = snapshot.script
    // Validate the mode before any message is accepted; secret-bearing config is forbidden.
    if (
      !configCopy ||
      configCopy.mode !== 'mock-only' ||
      Object.keys(configCopy).sort().join(',') !== 'appOrigin,from,mode'
    )
      throw new Error()
  } catch {
    throw new Error(unavailable)
  }
  const trace = []
  let used = false
  return Object.freeze({
    mode: 'fictional-mock',
    provider: 'resend',
    getTrace: () => trace.map((entry) => Object.freeze({ ...entry })),
    async send(input) {
      if (used) throw new Error(unavailable)
      used = true
      let message,
        wire,
        attempts = 0,
        uncertain = false
      try {
        message = prepareAuthenticationEmail(configCopy, input, clock())
        wire = buildResendMockRequest(message)
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(wire.body))
        const bodyDigest = Array.from(new Uint8Array(digest), (v) =>
          v.toString(16).padStart(2, '0'),
        ).join('')
        for (const response of responses) {
          // A retry cannot extend application credentials or regenerate their proof.
          const currentTime = clock()
          if (!Number.isFinite(currentTime)) throw new Error()
          if (currentTime >= message.expiresAt)
            return Object.freeze({ status: uncertain ? 'uncertain' : 'rejected', attempts })
          attempts++
          trace.push(
            Object.freeze({
              endpoint: wire.endpoint,
              method: wire.method,
              redirect: wire.redirect,
              idempotencyKey: wire.headers['Idempotency-Key'],
              bodyDigest,
            }),
          )
          const status = classify(response)
          if (status === 'accepted') return Object.freeze({ status, attempts })
          if (status === 'rejected')
            return Object.freeze({ status: uncertain ? 'uncertain' : status, attempts })
          uncertain = true
          // Never follow a redirect or interpret its target as delivery evidence.
          if (response.kind === 'response' && response.status >= 300 && response.status < 400) break
        }
        return Object.freeze({ status: 'uncertain', attempts })
      } catch {
        throw new Error(unavailable)
      } finally {
        message = undefined
        wire = undefined
        responses = []
      }
    },
  })
}
