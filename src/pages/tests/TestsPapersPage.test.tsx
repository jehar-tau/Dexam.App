import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'

import { StudentShell } from '../../app/student/StudentShell'
import { testsThemeStorageKey } from '../../features/testSeries/useTestsTheme'
import { renderApp } from '../../test/render'
import { TestsPapersPage } from './TestsPapersPage'
import { TestsPaperPage } from './TestsSectionPages'

vi.mock('../../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: null, signOut: vi.fn() }),
}))

function renderTests(path: string) {
  return renderApp(
    <Routes>
      <Route path="/tests" element={<StudentShell />}>
        <Route index element={<h1>Overview</h1>} />
        <Route path="papers" element={<TestsPapersPage />} />
        <Route path="papers/:paperId" element={<TestsPaperPage />} />
      </Route>
    </Routes>,
    [path],
  )
}

describe('Test-series shell and Papers page', () => {
  afterEach(() => vi.unstubAllEnvs())

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('shows the student portal sidebar with Papers active', () => {
    renderTests('/tests/papers?preview=1')
    const nav = screen.getByRole('navigation', { name: 'Student portal sections' })
    for (const label of ['Home', 'Coursework', 'Overview', 'Practice', 'Papers', 'Mocks']) {
      expect(within(nav).getByRole('link', { name: label })).toBeVisible()
    }
    for (const label of ['Analytics', 'Bookmarks', 'Sketches']) {
      expect(within(nav).queryByRole('link', { name: label })).toBeNull()
    }
    expect(within(nav).getByRole('link', { name: 'Papers' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // Preview mode is preserved on every link.
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/tests?preview=1',
    )
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/student?preview=1',
    )
  })

  it('lists B.Des exams by default and switches to M.Des', async () => {
    const user = userEvent.setup()
    renderTests('/tests/papers?preview=1')
    expect(screen.getByRole('heading', { name: 'UCEED' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'CEED' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'M.Des' }))
    expect(screen.getByRole('button', { name: 'M.Des' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'CEED' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'UCEED' })).toBeNull()
  })

  it('shows preview stats, free/new badges and best scores on tiles', () => {
    renderTests('/tests/papers?preview=1')
    expect(screen.getByText('58%')).toBeVisible()
    const uceed = screen.getByRole('region', { name: 'UCEED' })
    expect(
      within(uceed).getByRole('link', { name: '2026, new, free, not attempted' }),
    ).toHaveAttribute('href', '/tests/papers/uceed-2026?preview=1')
    expect(
      within(uceed).getByRole('link', { name: '2025, best 128 of 200, 2 attempts' }),
    ).toBeVisible()
  })

  it('shows empty stats and no fictional scores outside preview', () => {
    renderTests('/tests/papers')
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.queryByText('128')).toBeNull()
  })

  it('filters to a single exam', async () => {
    const user = userEvent.setup()
    renderTests('/tests/papers?preview=1')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Exam' }), 'nid-bdes')
    expect(screen.getByRole('region', { name: 'NID DAT' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'UCEED' })).toBeNull()
  })

  it('toggles and remembers the dark theme, light by default', async () => {
    const user = userEvent.setup()
    renderTests('/tests/papers?preview=1')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem(testsThemeStorageKey)).toBe('dark')
  })

  it('opens a paper page from its tile, and handles unknown papers', async () => {
    const user = userEvent.setup()
    renderTests('/tests/papers?preview=1')
    await user.click(screen.getByRole('link', { name: '2025, best 128 of 200, 2 attempts' }))
    expect(screen.getByRole('heading', { name: 'UCEED 2025' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Start timed paper' })).toHaveAttribute(
      'href',
      '/tests/exam/uceed-2025?preview=1',
    )

    renderTests('/tests/papers/not-a-paper?preview=1')
    expect(screen.getByRole('heading', { name: 'Paper not found' })).toBeVisible()
  })

  it('opens and closes the mobile menu', async () => {
    const user = userEvent.setup()
    renderTests('/tests/papers?preview=1')
    const menu = screen.getByRole('button', { name: 'Menu' })
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    await user.click(menu)
    expect(screen.getByRole('button', { name: 'Close' })).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('never shows fictional data when the build disables preview', () => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'false')
    renderTests('/tests/papers?preview=1')
    expect(screen.queryByText('58%')).toBeNull()
    expect(screen.queryByText('Fictional Student')).toBeNull()
  })
})
