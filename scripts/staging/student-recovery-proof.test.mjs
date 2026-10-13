import { describe, expect, it } from 'vitest'
import {
  assertLocalStudentRecovery,
  studentRecoveryHash,
  studentRecoverySecrets,
} from '../../supabase/functions/_shared/student-recovery-proof.mjs'
describe('student assisted recovery proof', () => {
  it('is disabled unless explicitly enabled on the local API', () => {
    expect(() => assertLocalStudentRecovery(undefined, 'http://kong:8000')).toThrow()
    expect(() => assertLocalStudentRecovery('local-only', 'https://example.supabase.co')).toThrow()
    expect(() => assertLocalStudentRecovery('local-only', 'http://kong:8000')).not.toThrow()
  })
  it('generates distinct strong link secrets and unambiguous backup codes', () => {
    const packs = Array.from({ length: 100 }, () => studentRecoverySecrets())
    expect(new Set(packs.map((pack) => pack.link)).size).toBe(100)
    for (const pack of packs) {
      expect(pack.link).toMatch(/^[0-9a-f]{64}$/)
      expect(pack.backup).toMatch(/^[2-9A-HJKMNP-Z]{10}$/)
    }
  })
  it('separates every credential and throttle purpose and requires a pepper', async () => {
    const pepper = 'fictional-local-test-pepper-with-at-least-32-characters'
    const hashes = await Promise.all(
      ['link', 'backup', 'member', 'budget'].map((purpose) =>
        studentRecoveryHash(pepper, purpose, 'same-value'),
      ),
    )
    expect(new Set(hashes).size).toBe(4)
    expect(hashes.every((hash) => /^[0-9a-f]{64}$/.test(hash))).toBe(true)
    await expect(studentRecoveryHash('', 'link', 'secret')).rejects.toThrow()
    await expect(studentRecoveryHash(pepper, 'activation', 'secret')).rejects.toThrow()
  })
})
