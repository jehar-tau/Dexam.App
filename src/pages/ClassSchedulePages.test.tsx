import { screen } from '@testing-library/react'
import { renderApp } from '../test/render'
import { ClassSchedulingPage, StudentAgendaPage } from './ClassSchedulePages'
const mocks = vi.hoisted(() => ({ context: vi.fn(), agenda: vi.fn(), save: vi.fn() }))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'fictional' } } }),
}))
vi.mock('../features/student/classSchedule', () => ({
  getSchedulingContext: mocks.context,
  getStudentAgenda: mocks.agenda,
  saveClass: mocks.save,
}))
describe('class workspaces', () => {
  it('offers no scheduling controls without explicit scope', async () => {
    mocks.context.mockResolvedValue([])
    renderApp(<ClassSchedulingPage />)
    expect(await screen.findByText('No scheduling scope')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Schedule class' })).not.toBeInTheDocument()
  })
  it('clearly labels cancellation without attendance or edit controls', async () => {
    mocks.agenda.mockResolvedValue([
      {
        id: 'class',
        title: 'Fictional drawing class',
        starts_at: '2026-10-16T09:00:00Z',
        ends_at: '2026-10-16T10:00:00Z',
        timezone: 'Asia/Kolkata',
        cancelled_at: '2026-10-14T09:00:00Z',
        location: null,
      },
    ])
    renderApp(<StudentAgendaPage />)
    expect(await screen.findByText('Fictional drawing class')).toBeVisible()
    expect(screen.getByText(/Cancelled ·/)).toBeVisible()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
