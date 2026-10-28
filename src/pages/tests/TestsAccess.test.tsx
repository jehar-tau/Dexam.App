import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'

import { findPaper } from '../../features/testSeries/paperCatalog'
import { TestsAccessBoundary } from '../../features/testSeries/TestsAccessBoundary'
import {
  paperAccess,
  safeTestsReturnTo,
  type TestAccess,
} from '../../features/testSeries/testAccess'
import { renderApp } from '../../test/render'
import { TestsPapersPage } from './TestsPapersPage'
import { TestsSignInPage, TestsWelcomePage } from './TestsWelcomePages'

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
  client: null as null | object,
}))

vi.mock('../../features/auth/AuthContext', () => ({
  useAuth: () => ({
    configured: true,
    initializing: false,
    session: mocks.session,
    signOut: vi.fn(),
  }),
}))

vi.mock('../../features/auth/supabaseClient', () => ({
  getSupabaseClient: () => mocks.client,
}))

const candidate: TestAccess = {
  kind: 'candidate',
  displayName: 'Asha Rao',
  profile: { level: 'bdes', exams: ['uceed'], examYear: 2027 },
  freeSlots: [
    { slot: 'uceed', paperId: 'uceed-2024' },
    { slot: 'nid-bdes', paperId: null },
    { slot: 'nift-bdes', paperId: null },
  ],
  entitledPapers: ['uceed-2024'],
}

function client(rpc: (name: string) => { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn((name: string) => Promise.resolve(rpc(name))),
    auth: { signInWithOAuth: vi.fn(() => Promise.resolve({ data: {}, error: null })) },
  }
}

const routes = (
  <Routes>
    <Route path="/tests/sign-in" element={<TestsSignInPage />} />
    <Route path="/tests/welcome" element={<TestsWelcomePage />} />
    <Route
      path="/tests/papers"
      element={
        <TestsAccessBoundary>
          <TestsPapersPage />
        </TestsAccessBoundary>
      }
    />
  </Routes>
)

describe('access rules', () => {
  it('limits return destinations to the test series', () => {
    expect(safeTestsReturnTo('/tests/exam/uceed-2025')).toBe('/tests/exam/uceed-2025')
    expect(safeTestsReturnTo('https://evil.test')).toBe('/tests/papers')
    expect(safeTestsReturnTo('//evil.test/tests')).toBe('/tests/papers')
    expect(safeTestsReturnTo('/student')).toBe('/tests/papers')
  })

  it('works out free, claimed and locked papers for a candidate', () => {
    expect(paperAccess(findPaper('uceed-2024')!, candidate)).toBe('free-claimed')
    expect(paperAccess(findPaper('uceed-2025')!, candidate)).toBe('locked')
    expect(paperAccess(findPaper('nid-bdes-2020')!, candidate)).toBe('free-choice')
    expect(paperAccess(findPaper('ceed-2024')!, candidate)).toBe('locked')
    expect(paperAccess(findPaper('nift-bdes-2013')!, candidate)).toBe('locked')
    expect(paperAccess(findPaper('ceed-2024')!, { ...candidate, kind: 'student' })).toBe('open')
  })
})

describe('test-series sign-in and onboarding', () => {
  afterEach(() => vi.unstubAllEnvs())
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    mocks.session = null
    mocks.client = null
  })

  it('sends signed-out visitors to the test-series sign-in, which offers Google', async () => {
    const user = userEvent.setup()
    const mock = client(() => ({ data: null, error: null }))
    mocks.client = mock
    renderApp(routes, ['/tests/papers'])
    expect(
      screen.getByRole('heading', { name: 'Practise on real design-entrance papers' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Sign in with your Member ID' })).toHaveAttribute(
      'href',
      '/sign-in?returnTo=%2Ftests%2Fpapers',
    )
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/tests/welcome?returnTo=%2Ftests%2Fpapers` },
    })
  })

  it('sets up a new Google login, then asks for the programme and exams', async () => {
    const user = userEvent.setup()
    mocks.session = { user: { id: 'google-user', email: 'asha@example.test' } }
    let provisioned = false
    let saved = false
    const mock = client((name) => {
      if (name === 'provision_google_candidate') {
        provisioned = true
        return { data: { created: true }, error: null }
      }
      if (name === 'save_candidate_profile') {
        saved = true
        return { data: null, error: null }
      }
      if (name === 'get_test_access') {
        if (saved) return { data: candidate, error: null }
        return provisioned
          ? {
              data: { ...candidate, profile: null, freeSlots: [], entitledPapers: [] },
              error: null,
            }
          : { data: { kind: null }, error: null }
      }
      return { data: [], error: null }
    })
    mocks.client = mock
    renderApp(routes, ['/tests/papers'])

    expect(
      await screen.findByRole('heading', { name: 'What are you preparing for?' }),
    ).toBeVisible()
    expect(screen.getByText('Welcome, Asha Rao')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Go to my papers' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /B\.Des/ }))
    await user.click(screen.getByRole('checkbox', { name: /NIFT/ }))
    await user.click(screen.getByRole('button', { name: 'Go to my papers' }))
    expect(mock.rpc).toHaveBeenCalledWith('save_candidate_profile', {
      p_level: 'bdes',
      p_exams: ['uceed', 'nid-bdes'],
      p_exam_year: 2027,
    })

    expect(await screen.findByRole('region', { name: 'UCEED' })).toBeVisible()
    const uceed = within(screen.getByRole('region', { name: 'UCEED' }))
    expect(uceed.getByRole('link', { name: /^2024, your free paper/ })).toBeVisible()
    expect(uceed.getByRole('link', { name: /^2025, locked/ })).toBeVisible()
    const nid = within(screen.getByRole('region', { name: 'NID DAT' }))
    expect(nid.getAllByText('Free').length).toBeGreaterThan(1)
  })

  it('refuses a login that did not come from Google', async () => {
    mocks.session = { user: { id: 'email-user', email: 'x@example.test' } }
    mocks.client = client((name) =>
      name === 'provision_google_candidate'
        ? { data: null, error: { code: '42501' } }
        : { data: { kind: null }, error: null },
    )
    renderApp(routes, ['/tests/welcome'])
    expect(
      await screen.findByRole('heading', { name: 'This login cannot use the test series' }),
    ).toBeVisible()
  })

  it('lets a coaching student straight through', async () => {
    mocks.session = { user: { id: 'student', email: 'dxm-x@members.dexam.invalid' } }
    mocks.client = client((name) =>
      name === 'get_test_access'
        ? {
            data: {
              kind: 'student',
              displayName: 'S',
              profile: null,
              freeSlots: [],
              entitledPapers: [],
            },
            error: null,
          }
        : { data: { attempts: [], topics: [] }, error: null },
    )
    renderApp(routes, ['/tests/papers'])
    expect(await screen.findByText(/coaching enrolment includes every paper/)).toBeVisible()
    expect(screen.queryByText('Locked')).toBeNull()
  })
})
