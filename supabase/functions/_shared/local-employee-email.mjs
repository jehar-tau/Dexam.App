// D-029 Option B: server-configured, fictional local capture only.
// Real SMTP activation must replace this policy under a separately approved gate.
const apiOrigins = new Set(['http://kong:8000', 'http://127.0.0.1:54321', 'http://localhost:54321'])
const captureOrigins = new Set([
  'http://supabase_inbucket_dexam-platform:8025',
  'http://127.0.0.1:54324',
  'http://localhost:54324',
])
const message = 'Employee email delivery is unavailable in this environment.'

function originOnly(value, allowlist) {
  const url = new URL(value)
  if (
    !allowlist.has(url.origin) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error(message)
  return url.origin
}

export function assertLocalEmployeeEmail(config, email) {
  try {
    if (
      config?.mode !== 'local-capture' ||
      typeof email !== 'string' ||
      email !== email.trim() ||
      email.length > 254 ||
      !/^[a-z0-9][a-z0-9._+-]*@[a-z0-9.-]+\.invalid$/.test(email) ||
      email.includes('..')
    )
      throw new Error(message)
    originOnly(config.apiURL, apiOrigins)
    return originOnly(config.captureURL, captureOrigins)
  } catch {
    throw new Error(message)
  }
}

export async function sendCapturedEmployeeEmail(
  config,
  email,
  actionLink,
  purpose,
  fetcher = fetch,
) {
  const origin = assertLocalEmployeeEmail(config, email)
  try {
    const linkType = config.linkType ?? purpose
    if (!['invite', 'recovery'].includes(linkType)) throw new Error(message)
    if (
      !['invite', 'recovery'].includes(purpose) ||
      typeof actionLink !== 'string' ||
      actionLink.length > 4096
    )
      throw new Error(message)
    const link = new URL(actionLink)
    if (config.linkFormat === 'application-action') {
      const params = new URLSearchParams(link.hash.slice(1))
      if (
        !['http://127.0.0.1:5173', 'http://localhost:5173'].includes(link.origin) ||
        link.username ||
        link.password ||
        link.search ||
        link.pathname !== (purpose === 'invite' ? '/staff/activate' : '/staff/recover') ||
        [...params.keys()].length !== 4 ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          params.get('request') ?? '',
        ) ||
        !/^[0-9a-f]{64}$/.test(params.get('proof') ?? '') ||
        !/^[A-Za-z0-9_-]{16,512}$/.test(params.get('token_hash') ?? '') ||
        params.get('type') !== linkType
      )
        throw new Error(message)
    } else {
      if (
        !apiOrigins.has(link.origin) ||
        link.username ||
        link.password ||
        link.pathname !== '/auth/v1/verify' ||
        link.hash ||
        link.searchParams.get('type') !== linkType ||
        !link.searchParams.get('token')
      )
        throw new Error(message)
      const redirect = new URL(link.searchParams.get('redirect_to'))
      if (
        !['http://127.0.0.1:5173', 'http://localhost:5173'].includes(redirect.origin) ||
        redirect.username ||
        redirect.password ||
        redirect.search ||
        redirect.hash ||
        redirect.pathname !== (purpose === 'invite' ? '/staff/activate' : '/staff/recover')
      )
        throw new Error(message)
    }
    const result = await fetcher(`${origin}/api/v1/send`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        From: { Email: 'auth@fixture.invalid', Name: 'Dexam local testing' },
        To: [{ Email: email }],
        Subject:
          purpose === 'invite'
            ? 'Fictional Dexam employee invitation'
            : 'Fictional Dexam password recovery',
        Text: `Local testing only. This is not a production email.\n\n${actionLink}`,
      }),
    })
    if (!result.ok) throw new Error(message)
  } catch {
    throw new Error(message)
  }
}
