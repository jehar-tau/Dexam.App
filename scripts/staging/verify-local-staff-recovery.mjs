if (process.env.STAGING_STAFF_SECURITY_ACCEPTANCE) {
  throw new Error('The local recovery wrapper cannot run hosted acceptance.')
}
await import('./verify-staff-recovery.mjs')
