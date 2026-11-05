import { z } from 'zod'

/** Preview/input helpers only. Trusted admission transactions must validate again. */
export const admissionTimeZone = 'Asia/Kolkata' as const
export const accessPresets = [48, 24, 12, 30] as const
export type AccessPreset = (typeof accessPresets)[number]
const timestamp = z.string().datetime({ offset: true })
const loginEmail = z.string().trim().toLowerCase().max(254).email()
const indiaOffsetMs = 330 * 60_000

/** Never use a guardian/contact email as a login reservation without explicit choice. */
export function normalizeStudentLoginEmail(value: string): string {
  const parsed = loginEmail.safeParse(value)
  if (!parsed.success) throw new Error('Enter a valid student login email.')
  return parsed.data
}

function instant(value: string): number {
  const parsed = timestamp.safeParse(value)
  const result = parsed.success ? Date.parse(parsed.data) : NaN
  if (
    !Number.isFinite(result) ||
    new Date(result).getUTCFullYear() < 1000 ||
    new Date(result).getUTCFullYear() > 9999
  )
    throw new Error('Enter a valid timestamp with a timezone (years 1000–9999).')
  return result
}

/** Calendar arithmetic in the explicitly displayed admission timezone, not browser timezone.
 * Month ends clamp to the final real day; 30 days means exactly 30 × 24 hours.
 */
export function previewAccessExpiry(start: string, preset: AccessPreset): string {
  const startMs = instant(start)
  if (preset === 30) {
    const result = new Date(startMs + 30 * 86_400_000)
    if (result.getUTCFullYear() > 9999)
      throw new Error('The selected expiry is outside the supported date range.')
    return result.toISOString()
  }
  if (preset !== 12 && preset !== 24 && preset !== 48)
    throw new Error('Choose an available access duration.')
  const local = new Date(startMs + indiaOffsetMs)
  const year = local.getUTCFullYear() + preset / 12
  const month = local.getUTCMonth()
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const end =
    Date.UTC(
      year,
      month,
      Math.min(local.getUTCDate(), lastDay),
      local.getUTCHours(),
      local.getUTCMinutes(),
      local.getUTCSeconds(),
      local.getUTCMilliseconds(),
    ) - indiaOffsetMs
  const result = new Date(end)
  if (!Number.isFinite(result.getTime()) || result.getUTCFullYear() > 9999)
    throw new Error('The selected expiry is outside the supported date range.')
  return result.toISOString()
}

export function previewAccessState({
  startsAt,
  expiresAt,
  suspended,
  revoked,
  now,
}: {
  startsAt: string
  expiresAt: string
  suspended: boolean
  revoked: boolean
  now: string
}): 'active' | 'scheduled' | 'expired' | 'suspended' | 'revoked' {
  const start = instant(startsAt),
    end = instant(expiresAt),
    current = instant(now)
  if (end <= start) throw new Error('Access expiry must be after its start.')
  if (revoked) return 'revoked'
  if (suspended) return 'suspended'
  if (current < start) return 'scheduled'
  if (current >= end) return 'expired'
  return 'active'
}

/** Parses received INR into safe integer minor units. Does not imply fully paid/access. */
export function amountReceivedPaise(value: string): number {
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(value) || value.length > 20)
    throw new Error('Enter an amount with no more than two decimal places.')
  const [whole = '0', fraction = ''] = value.split('.')
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  if (amount > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('The amount exceeds the supported numeric range.')
  return Number(amount)
}
