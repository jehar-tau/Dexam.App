import { createHash } from 'node:crypto'

export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')

export function assertTarget(config, expectedPort) {
  const url = new URL(config.API_URL)
  if (
    url.origin !== `http://127.0.0.1:${expectedPort}` ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error('Unexpected restore target')
  if (!config.SERVICE_ROLE_KEY || !config.ANON_KEY) throw new Error('Missing local keys')
}

export function verifyManifest(manifest, objects, version) {
  if (
    manifest.version !== version ||
    !manifest.entries.length ||
    manifest.entries.length !== objects.size
  )
    throw new Error('Incomplete or incompatible capture')
  const seen = new Set()
  for (const item of manifest.entries) {
    const key = `${item.bucket}/${item.path}`
    const bytes = objects.get(key)
    if (seen.has(key) || !bytes || bytes.length !== item.size || digest(bytes) !== item.sha256)
      throw new Error('Object verification failed')
    seen.add(key)
  }
}

export function assertOwned(project, run) {
  if (
    !/^[a-f0-9]{12}$/.test(run) ||
    !['source', 'target'].some((side) => project === `restore-${run}-${side}`)
  )
    throw new Error('Unknown disposable project')
}
