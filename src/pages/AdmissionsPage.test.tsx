import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { AdmissionsPage } from './AdmissionsPage'
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'fictional-admin' } } }),
}))
const mocks = vi.hoisted(() => ({
  choices: vi.fn(),
  directory: vi.fn(),
  search: vi.fn(),
  admit: vi.fn(),
  edit: vi.fn(),
}))
vi.mock('../features/enrolment/admissions', () => ({
  getAdmissionChoices: mocks.choices,
  listAdmissions: mocks.directory,
  searchAdmissionIdentity: mocks.search,
  admitStudent: mocks.admit,
  editAdmission: mocks.edit,
}))
const row = {
  personId: 'person',
  memberId: 'DXM-FICTION',
  name: 'Fictional Learner',
  loginEmail: 'student@fixture.invalid',
  loginRevision: 1,
  enrollmentId: 'enrollment',
  offeringId: 'offering',
  programme: 'Fictional Programme',
  cohortId: 'batch',
  batch: 'Fictional Batch',
  revision: 1,
  startsAt: '2027-01-01T00:00:00Z',
  expiresAt: '2028-01-01T00:00:00Z',
  state: 'scheduled',
}
describe('admissions workspace', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.choices.mockResolvedValue({
      enabled: false,
      timezone: 'Asia/Kolkata',
      offerings: [
        {
          id: 'offering',
          title: 'Fictional Programme',
          batches: [{ id: 'batch', name: 'Fictional Batch' }],
        },
      ],
    })
    mocks.directory.mockResolvedValue([row])
  })
  it('shows shared records but never enables unfinished integration through preview', async () => {
    renderApp(<AdmissionsPage />, ['/admin/admissions?preview=1'])
    expect(await screen.findByText(/Fictional Learner/)).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Record admission and manual receipt' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Check existing identity' })).toBeDisabled()
    expect(screen.getByText(/New admissions and edits are disabled/)).toBeVisible()
  })
  it('requires explicit review before a revision-bound change and preserves scope', async () => {
    const user = userEvent.setup()
    mocks.choices.mockResolvedValue({ enabled: true, timezone: 'Asia/Kolkata', offerings: [] })
    mocks.edit.mockResolvedValue(2)
    renderApp(<AdmissionsPage />, ['/admin/admissions'])
    await user.click(await screen.findByRole('button', { name: 'Review changes' }))
    const save = screen.getByRole('button', { name: 'Record reviewed change' })
    expect(save).toBeDisabled()
    await user.clear(screen.getByLabelText('Display name'))
    await user.type(screen.getByLabelText('Display name'), 'Updated Fictional')
    await user.type(screen.getByLabelText('Reason for change'), 'Verified spelling')
    await user.click(screen.getByRole('checkbox', { name: /I reviewed this exact student/ }))
    await user.click(save)
    expect(mocks.edit).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollment: row,
        action: 'details',
        name: 'Updated Fictional',
        reason: 'Verified spelling',
      }),
    )
    expect(await screen.findByText(/Change recorded with attribution/)).toBeVisible()
  })
  it('keeps identity checking deliberate and resets confirmation on changes', async () => {
    const user = userEvent.setup()
    mocks.choices.mockResolvedValue({ enabled: true, timezone: 'Asia/Kolkata', offerings: [] })
    mocks.search.mockResolvedValue([])
    renderApp(<AdmissionsPage />, ['/admin/admissions'])
    await screen.findByText(/Fictional Learner/)
    await user.type(screen.getByLabelText('Student display name'), 'New Fictional')
    await user.type(screen.getByLabelText('Dedicated student login email'), 'new@fixture.invalid')
    await user.click(screen.getByRole('button', { name: 'Check existing identity' }))
    await user.click(await screen.findByRole('radio', { name: /this is a new person/ }))
    await user.click(screen.getByRole('checkbox', { name: /I verified the canonical student/ }))
    expect(
      screen.getByRole('button', { name: 'Record admission and manual receipt' }),
    ).toBeEnabled()
    await user.type(screen.getByLabelText('Dedicated student login email'), 'x')
    expect(
      screen.getByRole('button', { name: 'Record admission and manual receipt' }),
    ).toBeDisabled()
    expect(mocks.admit).not.toHaveBeenCalled()
  })
})
