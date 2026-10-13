export type StudentActivationInput = {
  memberId: string
  activationCode: string
  password: string
  credentialType?: 'link' | 'backup'
}

export function parseStudentActivationProof(parameters: string) {
  const fields = new URLSearchParams(parameters.replace(/^[#?]/, ''))
  const memberId = fields.get('memberId'),
    token = fields.get('token')
  if (
    fields.size !== 2 ||
    !memberId ||
    !/^DXM-[2-9A-HJKMNP-Z]{12}$/.test(memberId) ||
    !token ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  )
    return null
  return { memberId, token }
}
let pendingProof: ReturnType<typeof parseStudentActivationProof> = null
if (typeof window !== 'undefined' && window.location.pathname === '/activate') {
  // Support already-issued query links, but new packs use fragments so credentials
  // do not reach the frontend host or referrer. Clear either form before rendering.
  pendingProof = window.location.hash
    ? parseStudentActivationProof(window.location.hash)
    : parseStudentActivationProof(window.location.search)
  window.history.replaceState(null, '', window.location.pathname)
}
export function getStudentActivationProof() {
  return pendingProof
}
export function clearStudentActivationProof() {
  pendingProof = null
}

type ActivationResponse = {
  message?: unknown
}

const unavailableMessage = 'Activation is temporarily unavailable. Please try again later.'

export async function activateStudent(input: StudentActivationInput) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) throw new Error(unavailableMessage)

  let response: Response
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/student-activate`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        memberId: input.memberId,
        credential: input.activationCode,
        credentialType: input.credentialType ?? 'backup',
        password: input.password,
      }),
    })
  } catch {
    throw new Error(unavailableMessage)
  }

  const data = (await response.json().catch(() => ({}))) as ActivationResponse
  if (!response.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : unavailableMessage)
  }

  return typeof data.message === 'string' ? data.message : 'Your Dexam account is ready.'
}
