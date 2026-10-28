import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

/**
 * F050 all-India live mocks. Everyone registered gets the same paper on the same server clock:
 * Part A, a 15–20 minute break, Part B, then the 10-minute upload window. Ranks are a Dexam
 * cohort estimate, published after Part A ends.
 */

export const livePhases = [
  'registration',
  'waiting',
  'part-a',
  'break',
  'part-b',
  'upload',
  'finished',
  'cancelled',
] as const

export type LivePhase = (typeof livePhases)[number]

const eventSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  title: z.string(),
  blueprintKey: z.enum(['uceed-2026', 'ceed-2026']),
  level: z.enum(['bdes', 'mdes']),
  status: z.enum(['draft', 'published', 'cancelled']),
  seatLimit: z.number().int(),
  registered: z.number().int(),
  questionCount: z.number().int(),
  taskCount: z.number().int(),
  partAMinutes: z.number().int(),
  breakMinutes: z.number().int(),
  partBMinutes: z.number().int(),
  uploadMinutes: z.number().int(),
  schedule: z.object({
    registrationClosesAt: z.string(),
    partAStartsAt: z.string(),
    partAEndsAt: z.string(),
    partBStartsAt: z.string(),
    partBEndsAt: z.string(),
    uploadEndsAt: z.string(),
    phase: z.enum(livePhases),
  }),
  me: z
    .object({
      rollNo: z.string(),
      attemptId: z.string().uuid().nullable(),
      registeredAt: z.string(),
    })
    .nullable(),
})

export type LiveEvent = z.infer<typeof eventSchema>

const standingSchema = z.object({
  attemptId: z.string().uuid(),
  submitted: z.boolean(),
  ranked: z.boolean(),
  score: z.number().nullable(),
  maxScore: z.number().nullable(),
  participants: z.number().int(),
  rank: z.number().int().nullable(),
  percentile: z.number().nullable(),
  top: z.array(z.object({ rollNo: z.string(), score: z.number() })),
})

export type LiveStanding = z.infer<typeof standingSchema>

export class LiveEventError extends Error {}

const messages: Record<string, string> = {
  DX004: 'Registration has closed.',
  DX005: 'All seats are taken.',
  DX006: 'This part has not started yet.',
  DX007: 'This part has ended.',
  '42501': 'This live mock is not available to your account.',
}

async function call(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown> | undefined,
  fallback: string,
) {
  const result = await client.rpc(name, args)
  if (result.error) throw new LiveEventError(messages[result.error.code] ?? fallback)
  return result.data as unknown
}

export async function fetchLiveEvents(client: SupabaseClient): Promise<LiveEvent[]> {
  return z
    .array(eventSchema)
    .parse(await call(client, 'list_live_events', undefined, 'Live mocks could not be loaded.'))
}

export async function fetchLiveEvent(client: SupabaseClient, key: string): Promise<LiveEvent> {
  return eventSchema.parse(
    await call(client, 'get_live_event', { p_key: key }, 'The live mock could not be loaded.'),
  )
}

export async function registerLiveEvent(client: SupabaseClient, key: string): Promise<LiveEvent> {
  return eventSchema.parse(
    await call(client, 'register_live_event', { p_key: key }, 'Registration failed. Try again.'),
  )
}

/** Enters Part A (or resumes it); the questions are released only once Part A has started. */
export async function joinLivePartA(
  client: SupabaseClient,
  key: string,
): Promise<{ attemptId: string; status: 'open' | 'in_progress' | 'submitted' }> {
  return z
    .object({
      attemptId: z.string().uuid(),
      status: z.enum(['open', 'in_progress', 'submitted']),
    })
    .parse(
      await call(client, 'join_live_part_a', { p_key: key }, 'Part A could not be opened. Retry.'),
    )
}

export async function fetchLiveStanding(
  client: SupabaseClient,
  key: string,
): Promise<LiveStanding> {
  return standingSchema.parse(
    await call(client, 'get_live_event_standing', { p_key: key }, 'Ranks could not be loaded.'),
  )
}

export type NewLiveEvent = {
  key: string
  title: string
  blueprintKey: 'uceed-2026' | 'ceed-2026'
  partAStartsAt: string
  registrationClosesAt: string | null
  breakMinutes: number
  seatLimit: number
}

export async function createLiveEvent(client: SupabaseClient, event: NewLiveEvent) {
  const result = await client.rpc('create_live_event', {
    p_key: event.key,
    p_title: event.title,
    p_blueprint_key: event.blueprintKey,
    p_part_a_starts_at: event.partAStartsAt,
    p_registration_closes_at: event.registrationClosesAt,
    p_break_minutes: event.breakMinutes,
    p_seat_limit: event.seatLimit,
  })
  if (result.error) {
    throw new LiveEventError(
      result.error.code === '23505'
        ? 'That event key is already used.'
        : result.error.code === '23514' || result.error.code === '22023'
          ? 'Check the key, the start (in the future), the break (15–20 minutes) and the seats.'
          : 'The event could not be created.',
    )
  }
}

export async function publishLiveEvent(client: SupabaseClient, eventId: string) {
  const result = await client.rpc('publish_live_event', { p_event_id: eventId })
  if (result.error) {
    throw new LiveEventError(
      result.error.code === 'P0002'
        ? 'The bank has no ready questions for this pattern.'
        : 'The event could not be published.',
    )
  }
  return z.object({ questions: z.number(), tasks: z.number() }).parse(result.data as unknown)
}

export async function cancelLiveEvent(client: SupabaseClient, eventId: string) {
  await call(
    client,
    'cancel_live_event',
    { p_event_id: eventId },
    'Only an event that has not started can be cancelled.',
  )
}

/** The event key behind a live attempt's paper id (`live-<key>`). */
export const liveKeyOf = (paperId: string) =>
  paperId.startsWith('live-') ? paperId.slice('live-'.length) : null

/** The next schedule boundary after now, so the page can refresh exactly when the phase turns. */
export function nextBoundary(event: LiveEvent, now: number): number | null {
  const s = event.schedule
  const times = [
    s.registrationClosesAt,
    s.partAStartsAt,
    s.partAEndsAt,
    s.partBStartsAt,
    s.partBEndsAt,
    s.uploadEndsAt,
  ]
    .map((value) => Date.parse(value))
    .filter((value) => value > now)
  return times.length ? Math.min(...times) : null
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const two = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`
}

export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
