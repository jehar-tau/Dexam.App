const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
const errors = []

if (process.env.VITE_APP_ENV !== 'staging') {
  errors.push('VITE_APP_ENV must be exactly "staging".')
}

for (const key of required) {
  const value = process.env[key]
  if (!value || value.startsWith('replace-with-')) {
    errors.push(`${key} must be configured for staging.`)
  }
}

if (process.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true') {
  errors.push('VITE_ENABLE_OPERATOR_PREVIEW must not be enabled in hosted staging.')
}

if (process.env.VITE_ENABLE_STUDENT_PREVIEW === 'true') {
  errors.push('VITE_ENABLE_STUDENT_PREVIEW must not be enabled in hosted staging.')
}

const pagesBranch = process.env.CF_PAGES_BRANCH
if (pagesBranch && pagesBranch !== 'main') {
  errors.push('Functional hosted staging builds may only be created from main.')
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
if (supabaseUrl && !supabaseUrl.startsWith('replace-with-')) {
  try {
    const parsed = new URL(supabaseUrl)
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
      errors.push('VITE_SUPABASE_URL must be an HTTPS hosted Supabase project URL.')
    }
  } catch {
    errors.push('VITE_SUPABASE_URL must be a valid URL.')
  }
}

const publishableKey = process.env.VITE_SUPABASE_ANON_KEY
if (publishableKey) {
  if (publishableKey.startsWith('sb_secret_') || publishableKey.includes('service_role')) {
    errors.push('A privileged Supabase key must never be exposed through VITE_SUPABASE_ANON_KEY.')
  }

  const jwtParts = publishableKey.split('.')
  if (jwtParts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64url').toString('utf8'))
      if (payload.role === 'service_role') {
        errors.push('VITE_SUPABASE_ANON_KEY contains a service-role JWT.')
      }
    } catch {
      errors.push('VITE_SUPABASE_ANON_KEY looks like a JWT but its payload is invalid.')
    }
  }
}

if (errors.length) {
  console.error('Staging environment validation failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Staging environment validation passed.')
