// Separate purpose domains prevent activation credentials being used for recovery.
export function assertLocalStudentRecovery(mode, apiURL) {
  if (
    mode !== 'local-only' ||
    !['http://kong:8000', 'http://127.0.0.1:54321', 'http://localhost:54321'].includes(apiURL)
  )
    throw new Error('Student assisted recovery disabled.')
}
export function studentRecoverySecrets() {
  const link = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
  const limit = 256 - (256 % alphabet.length)
  let backup = ''
  while (backup.length < 10) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      if (byte < limit && backup.length < 10) backup += alphabet[byte % alphabet.length]
    }
  }
  return { link, backup }
}
export async function studentRecoveryHash(pepper, purpose, value) {
  if (
    typeof pepper !== 'string' ||
    pepper.length < 32 ||
    !['link', 'backup', 'member', 'budget'].includes(purpose)
  )
    throw new Error('Recovery hashing unavailable.')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`student-recovery:${purpose}:${value}`),
  )
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
