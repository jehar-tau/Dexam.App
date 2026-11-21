import { navigationSchema } from '../../src/features/auth/navigationSchema.ts'

export async function verifySyntheticNavigation(client, account) {
  const { data, error } = await client.rpc('get_my_navigation_access')
  const result = navigationSchema.safeParse(data)
  if (error || !result.success) throw new Error(`${account.label} navigation response is invalid.`)

  for (const key of account.expectedNavigation) {
    if (!Object.hasOwn(navigationSchema.shape, key))
      throw new Error(`${account.label} fixture names an unknown navigation flag.`)
  }
  for (const [key, allowed] of Object.entries(result.data)) {
    const expected = account.expectedNavigation.includes(key)
    if (allowed !== expected)
      throw new Error(
        `${account.label} navigation flag ${key}: expected ${expected}, received ${allowed}.`,
      )
  }
}
