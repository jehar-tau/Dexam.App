export type StudentActivationInput = {
  memberId: string
  activationCode: string
  password: string
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
        credentialType: 'backup',
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
