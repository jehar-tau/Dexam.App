import { assertLocalPilotConfig } from './pilot-safety.mjs'
import { it, expect } from 'vitest'
const config = {
  API_URL: 'http://127.0.0.1:54321',
  MAILPIT_URL: 'http://localhost:54324',
  DB_URL: 'postgresql://postgres:fictional@127.0.0.1:54322/postgres',
  ANON_KEY: 'fictional',
  SERVICE_ROLE_KEY: 'fictional',
}
it('accepts only explicit loopback pilot services', () => {
  expect(() => assertLocalPilotConfig(config)).not.toThrow()
})
it.each(['API_URL', 'MAILPIT_URL', 'DB_URL'])(
  'rejects nonlocal %s without echoing values',
  (field) => {
    expect(() =>
      assertLocalPilotConfig({ ...config, [field]: 'https://secret@external.invalid/withheld' }),
    ).toThrow('values withheld')
  },
)
it('rejects credential-bearing HTTP and missing keys', () => {
  expect(() => assertLocalPilotConfig({ ...config, API_URL: 'http://secret@localhost' })).toThrow(
    'values withheld',
  )
  expect(() => assertLocalPilotConfig({ ...config, SERVICE_ROLE_KEY: '' })).toThrow(
    'values withheld',
  )
})
