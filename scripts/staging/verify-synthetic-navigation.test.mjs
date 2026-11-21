import { describe, expect, it, vi } from 'vitest'
import { navigationSchema } from '../../src/features/auth/navigationSchema.ts'
import { accounts } from './synthetic-fixtures.mjs'
import { verifySyntheticNavigation } from './verify-synthetic-navigation.mjs'

const keys = Object.keys(navigationSchema.shape)
function responseFor(enabled) {
  return Object.fromEntries(keys.map((key) => [key, enabled.includes(key)]))
}
function clientWith(data, error = null) {
  return { rpc: vi.fn().mockResolvedValue({ data, error }) }
}

describe('staging navigation acceptance', () => {
  it('uses the 22-field browser contract for all nine fixtures', () => {
    expect(keys).toHaveLength(22)
    expect(accounts).toHaveLength(9)
  })
  it.each(accounts)('checks every granted and denied flag for $key', async (account) => {
    const data = responseFor(account.expectedNavigation)
    const client = clientWith(data)
    await verifySyntheticNavigation(client, account)
    expect(client.rpc).toHaveBeenCalledWith('get_my_navigation_access')

    for (const key of keys) {
      await expect(
        verifySyntheticNavigation(clientWith({ ...data, [key]: !data[key] }), account),
      ).rejects.toThrow(`navigation flag ${key}:`)
    }
  })
  it('rejects missing, renamed, extra, and non-boolean fields without echoing private data', async () => {
    const student = accounts.find(({ key }) => key === 'student')
    const valid = responseFor(['student'])
    const { payments: omitted, ...missing } = valid
    const invalid = [
      missing,
      { ...missing, unexpected: omitted },
      { ...valid, private: 'secret' },
      { ...valid, payments: 'secret' },
      null,
      [],
    ]
    for (const data of invalid) {
      await expect(verifySyntheticNavigation(clientWith(data), student)).rejects.toThrow(
        /^Fictional Student navigation response is invalid\.$/,
      )
    }
    await expect(
      verifySyntheticNavigation(clientWith(valid, { message: 'secret' }), student),
    ).rejects.toThrow(/^Fictional Student navigation response is invalid\.$/)
  })
  it('fails when a fixture expects a flag outside the reviewed schema', async () => {
    const account = { label: 'Fictional Student', expectedNavigation: ['unexpected'] }
    await expect(verifySyntheticNavigation(clientWith(responseFor([])), account)).rejects.toThrow(
      'fixture names an unknown navigation flag',
    )
  })
})
