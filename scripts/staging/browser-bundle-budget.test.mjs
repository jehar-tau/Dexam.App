import { describe, expect, it } from 'vitest'
import { assertBrowserBundleBudget } from './browser-bundle-budget.mjs'

const chunks = () =>
  ['index-', 'react-runtime-', 'supabase-client-', 'shared-libraries-'].map((prefix) => ({
    name: `${prefix}fixture.js`,
    bytes: 100_000,
  }))

describe('browser build budget', () => {
  it('accepts split chunks at the exact byte limit', () => {
    const files = chunks()
    files[0].bytes = 500_000
    expect(() => assertBrowserBundleBudget(files)).not.toThrow()
  })
  it('rejects the previous monolithic bundle size', () => {
    const files = chunks()
    files[0].bytes = 941_830
    expect(() => assertBrowserBundleBudget(files)).toThrow('budget')
  })
  it.each([0, -1, NaN, Infinity, 1.5, 500_001])('rejects invalid size %s', (bytes) => {
    const files = chunks()
    files[0].bytes = bytes
    expect(() => assertBrowserBundleBudget(files)).toThrow('budget')
  })
  it('rejects an empty build', () => {
    expect(() => assertBrowserBundleBudget([])).toThrow('missing')
  })
  it.each([0, 1, 2, 3])('requires expected chunk group %s', (index) => {
    const files = chunks()
    files.splice(index, 1)
    expect(() => assertBrowserBundleBudget(files)).toThrow('split missing')
  })
})
