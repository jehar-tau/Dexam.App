// Server-only, unconnected preparation. No handler, environment lookup or automatic send.
// This probe never contains an invitation, password, OTP or application action link.
const endpoint = 'https://api.resend.com/emails'
const sender = 'Dexam <accounts@auth.designexam.com>'
const unavailable = 'Email connection test is unavailable.'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function settingsSnapshot(config) {
  if (!config || Object.getPrototypeOf(config) !== Object.prototype) throw new Error()
  const descriptors = Object.getOwnPropertyDescriptors(config)
  if (
    Reflect.ownKeys(descriptors).some(
      (key) => !['enabled', 'apiKey', 'recipient'].includes(key) || !('value' in descriptors[key]),
    )
  )
    throw new Error()
  return { ...config }
}

async function boundedJson(response) {
  // Never retain or return provider error bodies, which may echo sensitive input.
  if (!response.body) throw new Error()
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 2048) throw new Error()
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export function createResendConnectionProbe(config, fetchImpl = globalThis.fetch) {
  let settings
  try {
    settings = settingsSnapshot(config)
    if (settings.enabled !== true) {
      return Object.freeze({
        async send() {
          return Object.freeze({ status: 'disabled', attempts: 0 })
        },
      })
    }
    if (
      typeof fetchImpl !== 'function' ||
      typeof settings.apiKey !== 'string' ||
      !/^re_[A-Za-z0-9_-]{16,256}$/.test(settings.apiKey) ||
      typeof settings.recipient !== 'string' ||
      settings.recipient.length > 254 ||
      settings.recipient.includes('..') ||
      !/^[a-z0-9][a-z0-9._+-]*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
        settings.recipient,
      )
    )
      throw new Error()
  } catch {
    throw new Error(unavailable)
  }
  let used = false
  return Object.freeze({
    async send(deliveryId) {
      if (used || typeof deliveryId !== 'string' || !uuid.test(deliveryId))
        throw new Error(unavailable)
      // Consume before awaiting: concurrent calls cannot send another message.
      used = true
      const controller = new AbortController()
      let timer
      try {
        const operation = async () => {
          const response = await fetchImpl(endpoint, {
            method: 'POST',
            redirect: 'error',
            credentials: 'omit',
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${settings.apiKey}`,
              'Content-Type': 'application/json',
              'Idempotency-Key': `dexam/connection-test/${deliveryId}`,
            },
            body: JSON.stringify({
              from: sender,
              to: [settings.recipient],
              subject: 'Dexam email connection test',
              text: 'This is a Dexam email connection test. No account has been created or changed. This message contains no sign-in link. No action is required.',
            }),
          })
          if (response.status !== 200) {
            await response.body?.cancel().catch(() => {})
            // Conflict, timeout and server errors cannot prove non-delivery.
            return response.status >= 400 &&
              response.status < 500 &&
              ![408, 409].includes(response.status)
              ? 'rejected'
              : 'uncertain'
          }
          const body = await boundedJson(response)
          return body &&
            typeof body.id === 'string' &&
            uuid.test(body.id) &&
            Object.keys(body).length === 1
            ? 'accepted'
            : 'uncertain'
        }
        const timeout = new Promise((resolve) => {
          timer = setTimeout(() => {
            controller.abort()
            resolve('uncertain')
          }, 10_000)
        })
        return Object.freeze({ status: await Promise.race([operation(), timeout]), attempts: 1 })
      } catch {
        return Object.freeze({ status: 'uncertain', attempts: 1 })
      } finally {
        clearTimeout(timer)
        controller.abort()
        settings = undefined
      }
    },
  })
}
