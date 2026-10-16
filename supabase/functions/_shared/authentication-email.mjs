// D-046 B: provider-neutral preparation for fictional, mocked employee email.
// Never use this module to relax the existing local workers' delivery guards.
const preparedMessages = new WeakSet()
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const unavailable = 'Authentication email preparation is unavailable.'
function exactKeys(value, keys) {
  return (
    value &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  )
}
function fictionalAddress(value) {
  return (
    typeof value === 'string' &&
    value.length <= 254 &&
    !value.includes('..') &&
    /^[a-z0-9][a-z0-9._+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.invalid$/.test(value) &&
    !value.endsWith('@members.dexam.invalid')
  )
}
export function prepareAuthenticationEmail(config, input, now = Date.now()) {
  try {
    if (
      !exactKeys(config, ['mode', 'from', 'appOrigin']) ||
      config.mode !== 'mock-only' ||
      !fictionalAddress(config.from) ||
      !exactKeys(input, [
        'purpose',
        'proofType',
        'recipient',
        'requestId',
        'deliveryId',
        'actionLink',
        'expiresAt',
      ]) ||
      !['invite', 'recovery'].includes(input.purpose) ||
      !['invite', 'recovery'].includes(input.proofType) ||
      (input.purpose === 'recovery' && input.proofType !== 'recovery') ||
      !fictionalAddress(input.recipient) ||
      !uuid.test(input.requestId) ||
      !uuid.test(input.deliveryId) ||
      typeof input.actionLink !== 'string' ||
      input.actionLink.length > 4096 ||
      /[\s\\]/.test(input.actionLink) ||
      typeof input.expiresAt !== 'string' ||
      !Number.isFinite(now)
    )
      throw new Error()
    const expiry = Date.parse(input.expiresAt)
    if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 3_600_000) throw new Error()
    const origin = new URL(config.appOrigin)
    if (
      typeof config.appOrigin !== 'string' ||
      config.appOrigin !== origin.origin ||
      origin.protocol !== 'https:' ||
      !origin.hostname.endsWith('.invalid') ||
      origin.port ||
      origin.username ||
      origin.password
    )
      throw new Error()
    const callback = new URL(input.actionLink),
      params = new URLSearchParams(callback.hash.slice(1))
    if (
      callback.origin !== origin.origin ||
      callback.username ||
      callback.password ||
      callback.search ||
      callback.pathname !== (input.purpose === 'invite' ? '/staff/activate' : '/staff/recover') ||
      params.size !== 4 ||
      new Set(params.keys()).size !== 4 ||
      ![...params.keys()].every((key) =>
        ['request', 'proof', 'token_hash', 'type'].includes(key),
      ) ||
      params.get('request') !== input.requestId ||
      params.get('type') !== input.proofType ||
      !/^[0-9a-f]{64}$/.test(params.get('proof') ?? '') ||
      !/^[A-Za-z0-9_-]{16,512}$/.test(params.get('token_hash') ?? '')
    )
      throw new Error()
    const prepared = Object.freeze({
      purpose: input.purpose,
      proofType: input.proofType,
      from: config.from,
      recipient: input.recipient,
      requestId: input.requestId,
      deliveryId: input.deliveryId,
      actionLink: input.actionLink,
      expiresAt: expiry,
      subject:
        input.purpose === 'invite'
          ? 'Fictional Dexam employee invitation'
          : 'Fictional Dexam password recovery',
      text: `Fictional transport test only.\n\n${input.actionLink}\n\nThis link expires at ${new Date(expiry).toISOString()}.`,
    })
    preparedMessages.add(prepared)
    return prepared
  } catch {
    throw new Error(unavailable)
  }
}
export function assertPreparedAuthenticationEmail(message) {
  if (!preparedMessages.has(message)) throw new Error(unavailable)
}
