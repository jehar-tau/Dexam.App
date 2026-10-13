export async function employeeActionProofHash(
  purpose: 'invite' | 'recovery',
  requestId: string,
  proof: string,
) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`employee-${purpose}:${requestId}:${proof}`),
  )
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
export function employeeActionNonce() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
