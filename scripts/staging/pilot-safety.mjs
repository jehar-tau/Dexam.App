export function assertLocalPilotConfig(config) {
  try {
    for (const field of ['API_URL', 'MAILPIT_URL', 'DB_URL']) {
      const url = new URL(config[field])
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error()
      if (
        field !== 'DB_URL' &&
        (url.protocol !== 'http:' || url.username || url.password || url.search || url.hash)
      )
        throw new Error()
      if (field === 'DB_URL' && !['postgres:', 'postgresql:'].includes(url.protocol))
        throw new Error()
    }
    if (!config.ANON_KEY || !config.SERVICE_ROLE_KEY) throw new Error()
  } catch {
    throw new Error('Local pilot configuration rejected; values withheld.')
  }
}
