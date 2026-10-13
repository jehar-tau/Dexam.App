// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { employeePasswordUpdateOutcome } from '../../supabase/functions/_shared/employee-password-outcome.mjs'
describe('supported provider password mutation outcomes', () => {
  it('requires the expected provider account in a success response', () => {
    expect(
      employeePasswordUpdateOutcome({ data: { user: { id: 'owned' } }, error: null }, 'owned'),
    ).toBe('succeeded')
    expect(
      employeePasswordUpdateOutcome({ data: { user: { id: 'other' } }, error: null }, 'owned'),
    ).toBe('uncertain')
    expect(employeePasswordUpdateOutcome({}, 'owned')).toBe('uncertain')
  })
  it('only releases execution after a known provider rejection', () => {
    expect(employeePasswordUpdateOutcome({ error: { status: 400 } }, 'owned')).toBe('rejected')
    expect(employeePasswordUpdateOutcome({ error: { status: 429 } }, 'owned')).toBe('rejected')
  })
  it.each([undefined, 0, 408, 500, 503])(
    'keeps a potentially delayed mutation exclusively claimed for status %s',
    (status) => {
      expect(employeePasswordUpdateOutcome({ error: { status } }, 'owned')).toBe('uncertain')
    },
  )
})
