import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { RecoveryIncidentsPage } from './RecoveryIncidentsPage'
const mocks = vi.hoisted(() => ({ workspace: vi.fn(), open: vi.fn(), review: vi.fn() }))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'admin' } } }),
}))
vi.mock('../features/auth/recoveryIncidents', () => ({
  getRecoveryIncidents: mocks.workspace,
  openRecoveryIncident: mocks.open,
  reviewRecoveryIncident: mocks.review,
}))
const request = {
  recovery_kind: 'student',
  request_id: 'request',
  target_person_id: 'student',
  display_name: 'Fictional student',
  member_id: 'DXM-7K3M9Q2RW5T2',
  request_created_at: new Date().toISOString(),
  execution_started_at: null,
  incident_id: null,
  proposer_person_id: null,
  reviewer_person_id: null,
  incident_status: null,
  review_is_current: false,
}
describe('uncertain recovery investigation', () => {
  beforeEach(() => vi.resetAllMocks())
  it('requires an acknowledgment before opening and never offers reset controls', async () => {
    mocks.workspace.mockResolvedValue({ actorPersonId: 'admin', incidents: [request] })
    const user = userEvent.setup()
    renderApp(<RecoveryIncidentsPage />)
    const button = await screen.findByRole('button', { name: 'Open investigation' })
    expect(button).toBeDisabled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(button)
    expect(mocks.open).toHaveBeenCalledWith('student', 'request', true)
    expect(
      screen.queryByRole('button', { name: /unlock|reset password|issue.*pack/i }),
    ).not.toBeInTheDocument()
  })
  it('prevents proposer self-review', async () => {
    mocks.workspace.mockResolvedValue({
      actorPersonId: 'admin',
      incidents: [
        {
          ...request,
          incident_id: 'incident',
          proposer_person_id: 'admin',
          incident_status: 'pending',
          review_is_current: true,
        },
      ],
    })
    renderApp(<RecoveryIncidentsPage />)
    expect(await screen.findByText(/You cannot review your own proposal/)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Record independent review' }),
    ).not.toBeInTheDocument()
  })
  it('records independent review without claiming access was restored', async () => {
    mocks.workspace.mockResolvedValue({
      actorPersonId: 'admin',
      incidents: [
        {
          ...request,
          incident_id: 'incident',
          proposer_person_id: 'other',
          incident_status: 'pending',
          review_is_current: true,
        },
      ],
    })
    const user = userEvent.setup()
    renderApp(<RecoveryIncidentsPage />)
    await user.click(await screen.findByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Record independent review' }))
    expect(mocks.review).toHaveBeenCalledWith('incident', true)
    expect(
      await screen.findByText('Investigation recorded. The password reset remains blocked.'),
    ).toBeVisible()
  })
  it('does not show stale cached incidents when current authority fails', async () => {
    mocks.workspace.mockRejectedValue(new Error('denied'))
    renderApp(<RecoveryIncidentsPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Incident authority or queue unavailable',
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
