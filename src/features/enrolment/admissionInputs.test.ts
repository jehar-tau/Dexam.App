import { describe, expect, it } from 'vitest'
import {
  admissionTimeZone,
  amountReceivedPaise,
  normalizeStudentLoginEmail,
  previewAccessExpiry,
  previewAccessState,
} from './admissionInputs'

describe('admission input contract, not authorization', () => {
  it('normalizes trim/case but preserves plus tags and dots', () => {
    expect(normalizeStudentLoginEmail('  Learner.Name+Design@Fixture.Invalid  ')).toBe(
      'learner.name+design@fixture.invalid',
    )
    expect(normalizeStudentLoginEmail('learnername@fixture.invalid')).not.toBe(
      normalizeStudentLoginEmail('learner.name@fixture.invalid'),
    )
  })
  it.each([
    '',
    'name',
    'a@b@c.invalid',
    'a b@fixture.invalid',
    'a@fixture.invalid\r\nBcc:x@fixture.invalid',
  ])('rejects malformed login email', (value) => {
    expect(() => normalizeStudentLoginEmail(value)).toThrow('valid student login email')
  })
  it('uses explicit India timezone, not the browser timezone', () => {
    expect(admissionTimeZone).toBe('Asia/Kolkata')
    expect(previewAccessExpiry('2024-02-29T23:45:12.123+05:30', 12)).toBe(
      '2025-02-28T18:15:12.123Z',
    )
    expect(previewAccessExpiry('2024-02-29T23:45:12.123+05:30', 24)).toBe(
      '2026-02-28T18:15:12.123Z',
    )
    expect(previewAccessExpiry('2024-02-29T23:45:12.123+05:30', 48)).toBe(
      '2028-02-29T18:15:12.123Z',
    )
  })
  it('handles a local leap day when UTC is still the previous day', () => {
    expect(previewAccessExpiry('2024-02-28T19:00:00Z', 12)).toBe('2025-02-27T19:00:00.000Z')
    expect(previewAccessExpiry('2024-02-28T19:00:00Z', 48)).toBe('2028-02-28T19:00:00.000Z')
  })
  it('treats the 30-day preset as exactly 30 days, not one calendar month', () => {
    const start = '2024-01-31T09:00:00+05:30'
    const end = previewAccessExpiry(start, 30)
    expect(end).toBe('2024-03-01T03:30:00.000Z')
    expect(Date.parse(end) - Date.parse(start)).toBe(30 * 86_400_000)
  })
  it.each([
    '2024-02-30T00:00:00Z',
    '2023-02-29T00:00:00Z',
    '2026-11-05',
    '2026-11-05T00:00:00',
    'not a date',
  ])('requires a real explicit timestamp: %s', (start) => {
    expect(() => previewAccessExpiry(start, 12)).toThrow()
  })
  it('rejects unsupported presets and result overflow', () => {
    expect(() => previewAccessExpiry('2026-11-05T00:00:00Z', 1 as 12)).toThrow(
      'available access duration',
    )
    expect(() => previewAccessExpiry('9999-12-31T00:00:00Z', 48)).toThrow('supported date range')
    expect(() => previewAccessExpiry('9999-12-31T00:00:00Z', 30)).toThrow('supported date range')
    expect(() => previewAccessExpiry('0000-01-01T00:00:00Z', 12)).toThrow('valid timestamp')
  })
  it('satisfies generated calendar-year/month boundaries without losing time', () => {
    for (let year = 1996; year <= 2104; year += 1) {
      for (const months of [12, 24, 48] as const) {
        for (const month of [0, 1, 2, 11]) {
          const day = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
          const start = new Date(Date.UTC(year, month, day, 7, 31, 29, 456)).toISOString()
          const end = new Date(previewAccessExpiry(start, months))
          const targetYear = year + months / 12
          const targetLast = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate()
          expect(end.getUTCFullYear()).toBe(targetYear)
          expect(end.getUTCMonth()).toBe(month)
          expect(end.getUTCDate()).toBe(Math.min(day, targetLast))
          expect(end.toISOString().slice(11)).toBe('07:31:29.456Z')
        }
      }
    }
  })
  const window = {
    startsAt: '2026-11-05T00:00:00Z',
    expiresAt: '2026-12-05T00:00:00Z',
    suspended: false,
    revoked: false,
  }
  it('previews start inclusive and expiry exclusive, without a scheduler', () => {
    expect(previewAccessState({ ...window, now: '2026-11-04T23:59:59.999Z' })).toBe('scheduled')
    expect(previewAccessState({ ...window, now: window.startsAt })).toBe('active')
    expect(previewAccessState({ ...window, now: window.expiresAt })).toBe('expired')
    expect(previewAccessState({ ...window, now: window.startsAt, suspended: true })).toBe(
      'suspended',
    )
    expect(
      previewAccessState({ ...window, now: window.startsAt, revoked: true, suspended: true }),
    ).toBe('revoked')
    expect(() =>
      previewAccessState({ ...window, expiresAt: window.startsAt, now: window.startsAt }),
    ).toThrow('after its start')
  })
  it.each([
    ['0', 0],
    ['100', 10000],
    ['12.3', 1230],
    ['12.34', 1234],
    ['0.01', 1],
  ] as const)('parses money without floating point loss: %s', (input, expected) => {
    expect(amountReceivedPaise(input)).toBe(expected)
  })
  it.each(['-1', '+1', '1e3', '1.234', 'NaN', ' 1 ', '1,000', '01', '90071992547409.92'])(
    'rejects ambiguous or unsafe amount: %s',
    (input) => {
      expect(() => amountReceivedPaise(input)).toThrow()
    },
  )
})
