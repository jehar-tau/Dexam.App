import { appendFileSync, readFileSync } from 'node:fs'

const sourcePath = process.argv[2]
const githubEnvironmentPath = process.env.GITHUB_ENV

if (!sourcePath || !githubEnvironmentPath) {
  throw new Error('API-key preparation requires a JSON source path and GITHUB_ENV.')
}

const parsed = JSON.parse(readFileSync(sourcePath, 'utf8'))
const records = Array.isArray(parsed) ? parsed : parsed?.api_keys

if (!Array.isArray(records)) throw new Error('Supabase returned an unexpected API-key response.')

function keyValue(record) {
  return record?.api_key ?? record?.apiKey ?? record?.key ?? null
}

function namedKey(names) {
  for (const name of names) {
    const record = records.find((candidate) => candidate?.name === name || candidate?.type === name)
    const value = keyValue(record)
    if (typeof value === 'string' && value.length > 20) return value
  }
  return null
}

const serviceRoleKey = namedKey(['service_role', 'secret'])
const publicKey = namedKey(['anon', 'publishable'])

if (!serviceRoleKey || !publicKey) {
  throw new Error('The staging project did not return both a privileged and a browser API key.')
}
if (!/^[A-Za-z0-9._-]+$/.test(serviceRoleKey) || !/^[A-Za-z0-9._-]+$/.test(publicKey)) {
  throw new Error('Supabase returned an API key with unsafe environment-file characters.')
}

process.stdout.write(`::add-mask::${serviceRoleKey}\n::add-mask::${publicKey}\n`)
appendFileSync(
  githubEnvironmentPath,
  `STAGING_SERVICE_ROLE_KEY=${serviceRoleKey}\nSTAGING_PUBLIC_KEY=${publicKey}\n`,
  { mode: 0o600 },
)

console.log('Prepared masked, job-scoped Supabase API keys.')
