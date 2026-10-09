import { getSupabaseClient } from '../auth/supabaseClient'

export type ActivationPack = {
  memberId: string
  activationUrl: string
  backupCode: string
  expiresAt: string
  reissued: boolean
}

type ActivationPackResponse = Partial<ActivationPack> & {
  message?: unknown
}

const unavailableMessage = 'The activation pack could not be issued. Check access and try again.'

export async function issueActivationPack(enrollmentId: string): Promise<ActivationPack> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const client = getSupabaseClient()

  if (!supabaseUrl || !anonKey || !client) throw new Error(unavailableMessage)

  const sessionResult = await client.auth.getSession()
  const accessToken = sessionResult.data.session?.access_token
  if (sessionResult.error || !accessToken) throw new Error(unavailableMessage)

  let response: Response
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/staff-issue-activation`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enrollmentId, reasonCode: 'initial_activation_pack' }),
    })
  } catch {
    throw new Error(unavailableMessage)
  }

  const data = (await response.json().catch(() => ({}))) as ActivationPackResponse
  if (!response.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : unavailableMessage)
  }

  if (
    typeof data.memberId !== 'string' ||
    typeof data.activationUrl !== 'string' ||
    typeof data.backupCode !== 'string' ||
    typeof data.expiresAt !== 'string' ||
    typeof data.reissued !== 'boolean'
  ) {
    throw new Error(unavailableMessage)
  }

  return data as ActivationPack
}
