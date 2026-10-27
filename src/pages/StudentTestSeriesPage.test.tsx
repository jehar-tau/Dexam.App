import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderApp } from '../test/render'
import { StudentTestSeriesPage } from './StudentTestSeriesPage'

describe('StudentTestSeriesPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    localStorage.clear()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('runs a fictional timed assessment with navigation and review states', async () => {
    const user = userEvent.setup()
    renderApp(<StudentTestSeriesPage />, ['/student/tests?preview=1'])

    expect(
      screen.getByRole('heading', { name: 'Practise the paper, not just the questions.' }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Read instructions and begin' }))
    expect(screen.getByRole('heading', { name: 'Test workspace' })).toBeVisible()
    await user.type(screen.getByLabelText('Numerical answer'), '12')
    await user.click(screen.getByRole('button', { name: 'Mark for review' }))
    await user.click(screen.getByRole('button', { name: 'Save and next' }))
    expect(screen.getByText(/Select every property/)).toBeVisible()
    expect(localStorage.getItem('dexam-fictional-test-series-preview-v1')).toContain('12')
  })

  it('accepts a Part B file selection without uploading it in preview', async () => {
    const user = userEvent.setup()
    renderApp(<StudentTestSeriesPage />, ['/student/tests?preview=1'])
    await user.click(screen.getByRole('button', { name: 'Read instructions and begin' }))
    await user.click(screen.getByRole('button', { name: 'Part B' }))
    const file = new File(['drawing'], 'study-corner.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Photograph or scan'), file)
    expect(screen.getByText('Selected: study-corner.png')).toBeVisible()
  })
})
