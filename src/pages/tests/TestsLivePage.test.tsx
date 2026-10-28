import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'

import {
  formatCountdown,
  liveKeyOf,
  nextBoundary,
  type LiveEvent,
} from '../../features/testSeries/liveEvents'
import { renderApp } from '../../test/render'
import { LiveEventsStaffPage } from '../LiveEventsStaffPage'
import { TestsLivePage } from './TestsLivePage'
import { TestsMocksPage } from './TestsMocksPage'

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
  client: null as null | object,
}))
vi.mock('../../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: mocks.session, signOut: vi.fn() }),
}))
vi.mock('../../features/auth/supabaseClient', () => ({
  getSupabaseClient: () => mocks.client,
}))

const attemptId = '00000000-0000-4000-8000-0000000000a1'
const at = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()

function event(phase: LiveEvent['schedule']['phase'], me: LiveEvent['me'] = null): LiveEvent {
  const start = phase === 'registration' ? 120 : phase === 'part-a' ? -5 : -130
  return {
    id: '00000000-0000-4000-8000-0000000000e5',
    key: 'uceed-jan',
    title: 'Fictional UCEED live mock',
    blueprintKey: 'uceed-2026',
    level: 'bdes',
    status: 'published',
    seatLimit: 100,
    registered: 41,
    questionCount: 57,
    taskCount: 2,
    partAMinutes: 120,
    breakMinutes: 15,
    partBMinutes: 60,
    uploadMinutes: 10,
    schedule: {
      registrationClosesAt: at(start - 10),
      partAStartsAt: at(start),
      partAEndsAt: at(start + 120),
      partBStartsAt: at(start + 135),
      partBEndsAt: at(start + 195),
      uploadEndsAt: at(start + 205),
      phase,
    },
    me,
  }
}

function client(handlers: Record<string, (args?: Record<string, unknown>) => unknown>) {
  const rpc = vi.fn((name: string, args?: Record<string, unknown>) =>
    Promise.resolve(
      handlers[name]
        ? { data: handlers[name](args), error: null }
        : { data: null, error: { code: 'XX000' } },
    ),
  )
  return { rpc }
}

const liveRoutes = (
  <Routes>
    <Route path="/tests/live/:key" element={<TestsLivePage />} />
    <Route path="/tests/live/:key/run/:attemptId" element={<h1>Live window</h1>} />
  </Routes>
)

describe('Live mock helpers', () => {
  it('formats countdowns and finds the next phase change', () => {
    expect(formatCountdown(65_000)).toBe('01:05')
    expect(formatCountdown(3_725_000)).toBe('1:02:05')
    expect(formatCountdown(-5)).toBe('00:00')
    const fictional = event('part-a')
    expect(nextBoundary(fictional, Date.now())).toBe(Date.parse(fictional.schedule.partAEndsAt))
    expect(liveKeyOf('live-uceed-jan')).toBe('uceed-jan')
    expect(liveKeyOf('uceed-2024')).toBeNull()
  })
})

describe('Live mock page', () => {
  beforeEach(() => {
    mocks.session = { user: { id: 'student-1', email: 'x@members.dexam.invalid' } }
  })

  it('registers a student and shows the roll number', async () => {
    const user = userEvent.setup()
    mocks.client = client({
      get_live_event: () => event('registration'),
      register_live_event: () =>
        event('registration', { rollNo: 'UCEED--00042', attemptId: null, registeredAt: at(0) }),
    })
    renderApp(liveRoutes, ['/tests/live/uceed-jan'])
    expect(await screen.findByText('Registration open')).toBeVisible()
    expect(screen.getByText('59 of 100 seats left.')).toBeVisible()
    expect(screen.getByRole('timer', { name: 'Registration closes in' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Register' }))
    expect(await screen.findByText('UCEED--00042')).toBeVisible()
    expect(screen.getByText(/You are registered/)).toBeVisible()
  })

  it('enters Part A on the event clock', async () => {
    const user = userEvent.setup()
    const fake = client({
      get_live_event: () =>
        event('part-a', { rollNo: 'UCEED--00042', attemptId: null, registeredAt: at(-600) }),
      join_live_part_a: () => ({ attemptId, status: 'in_progress' }),
    })
    mocks.client = fake
    renderApp(liveRoutes, ['/tests/live/uceed-jan'])
    expect(await screen.findByText('Part A is live')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Enter Part A' }))
    expect(await screen.findByRole('heading', { name: 'Live window' })).toBeVisible()
    expect(fake.rpc).toHaveBeenCalledWith('join_live_part_a', { p_key: 'uceed-jan' })
  })

  it('shows the Dexam cohort rank after Part A, by roll number only', async () => {
    mocks.client = client({
      get_live_event: () =>
        event('break', { rollNo: 'UCEED--00042', attemptId, registeredAt: at(-600) }),
      get_live_event_standing: () => ({
        attemptId,
        submitted: true,
        ranked: true,
        score: 40,
        maxScore: 300,
        participants: 3,
        rank: 2,
        percentile: 50,
        top: [
          { rollNo: 'UCEED--00007', score: 55 },
          { rollNo: 'UCEED--00042', score: 40 },
          { rollNo: 'UCEED--00011', score: 40 },
        ],
      }),
    })
    renderApp(liveRoutes, ['/tests/live/uceed-jan'])
    const card = await screen.findByRole('region', { name: 'Dexam cohort rank' })
    expect(await within(card).findByText('2 / 3')).toBeVisible()
    expect(within(card).getByText(/not an official rank/)).toBeVisible()
    const rows = within(card).getAllByRole('row')
    expect(within(rows[2]!).getByText('2')).toBeVisible()
    expect(within(rows[3]!).getByText('2')).toBeVisible()
    expect(screen.getByText(/Part B opens at/)).toBeVisible()
  })

  it('tells late visitors that registration has closed', async () => {
    mocks.client = client({ get_live_event: () => event('part-a') })
    renderApp(liveRoutes, ['/tests/live/uceed-jan'])
    expect(await screen.findByText(/Registration has closed/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Enter Part A' })).toBeNull()
  })
})

describe('Live mocks on the Mocks page', () => {
  it('lists the level’s live events with the student’s roll number', async () => {
    mocks.session = { user: { id: 'student-1', email: 'x@members.dexam.invalid' } }
    mocks.client = client({
      get_test_access: () => ({
        kind: 'student',
        displayName: 'S',
        profile: null,
        freeSlots: [],
        entitledPapers: [],
      }),
      list_assessment_mocks: () => [],
      list_live_events: () => [
        event('registration', { rollNo: 'UCEED--00042', attemptId: null, registeredAt: at(0) }),
        { ...event('registration'), key: 'ceed-jan', title: 'Fictional CEED live', level: 'mdes' },
      ],
    })
    renderApp(
      <Routes>
        <Route path="/tests/mocks" element={<TestsMocksPage />} />
      </Routes>,
      ['/tests/mocks'],
    )
    const link = await screen.findByRole('link', { name: /Fictional UCEED live mock/ })
    expect(link).toHaveAttribute('href', '/tests/live/uceed-jan')
    expect(link).toHaveTextContent('Roll UCEED--00042')
    expect(screen.queryByRole('link', { name: /Fictional CEED live/ })).toBeNull()
  })
})

describe('Live events staff page', () => {
  it('schedules a draft and publishes it', async () => {
    const user = userEvent.setup()
    const fake = client({
      list_live_events: () => [{ ...event('registration'), status: 'draft', questionCount: 0 }],
      create_live_event: () => '00000000-0000-4000-8000-0000000000e6',
      publish_live_event: () => ({ questions: 57, tasks: 2 }),
    })
    mocks.client = fake
    renderApp(<LiveEventsStaffPage />)
    const form = screen.getByRole('form', { name: 'Schedule a live mock' })
    await user.type(within(form).getByLabelText('Event key'), 'uceed-feb')
    await user.type(within(form).getByLabelText('Title'), 'Fictional February live')
    await user.type(within(form).getByLabelText('Part A starts'), '2099-02-01T10:00')
    await user.click(within(form).getByRole('button', { name: 'Schedule draft' }))
    expect(fake.rpc).toHaveBeenCalledWith(
      'create_live_event',
      expect.objectContaining({
        p_key: 'uceed-feb',
        p_blueprint_key: 'uceed-2026',
        p_part_a_starts_at: new Date('2099-02-01T10:00').toISOString(),
        p_registration_closes_at: null,
        p_break_minutes: 15,
      }),
    )
    await user.click(await screen.findByRole('button', { name: 'Publish' }))
    expect(fake.rpc).toHaveBeenCalledWith('publish_live_event', {
      p_event_id: '00000000-0000-4000-8000-0000000000e5',
    })
  })
})
