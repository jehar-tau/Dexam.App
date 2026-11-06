import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { StudentGoogleLoginsPage } from './StudentGoogleLoginsPage'
const mocks = vi.hoisted(() => ({ list: vi.fn(), approve: vi.fn(), revoke: vi.fn() }))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'fictional' } } }),
}))
vi.mock('../features/enrolment/studentGoogleLogins', () => ({
  getStudentGoogleLogins: mocks.list,
  approveStudentGoogleLogin: mocks.approve,
  revokeStudentGoogleLogin: mocks.revoke,
}))
const rows = [
  {
    personId: '00000000-0000-4000-8000-0000000000d1',
    memberId: 'DXM-2K3M9Q2RW5TY',
    displayName: 'Listed Student',
    email: 'listed@fixture.invalid',
    state: 'approved',
    linked: true,
    revision: 1,
    revokedAt: null,
    admissionPaid: true,
  },
  {
    personId: '00000000-0000-4000-8000-0000000000d2',
    memberId: 'DXM-3K3M9Q2RW5TY',
    displayName: 'New Student',
    email: null,
    state: 'none',
    linked: false,
    revision: null,
    revokedAt: null,
    admissionPaid: true,
  },
]
const card = (name: string) => screen.getByText(name).closest('li')!
describe('StudentGoogleLoginsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.list.mockResolvedValue(rows)
  })
  it('lets Sales add a paid student but not revoke', async () => {
    const user = userEvent.setup()
    mocks.approve.mockResolvedValue(undefined)
    renderApp(<StudentGoogleLoginsPage portal="staff" />)
    await screen.findByText('New Student')
    expect(within(card('Listed Student')).getByText('Signs in with Google')).toBeVisible()
    expect(
      within(card('Listed Student')).queryByRole('button', { name: /Revoke/ }),
    ).not.toBeInTheDocument()
    const row = card('New Student')
    const add = within(row).getByRole('button', { name: 'Add to Google list' })
    await user.type(
      within(row).getByLabelText('Google email for New Student'),
      'New@Fixture.invalid',
    )
    expect(add).toBeDisabled()
    await user.type(within(row).getByLabelText('Reason for New Student'), 'Paid full course')
    await user.click(add)
    expect(mocks.approve).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: rows[1]!.personId,
        email: 'New@Fixture.invalid',
        reason: 'Paid full course',
      }),
    )
    expect(
      await screen.findByText('New Student can now sign in with new@fixture.invalid.'),
    ).toBeVisible()
  })
  it('lets an admin revoke with the current revision', async () => {
    const user = userEvent.setup()
    mocks.revoke.mockResolvedValue(undefined)
    renderApp(<StudentGoogleLoginsPage portal="admin" />)
    await screen.findByText('Listed Student')
    const row = card('Listed Student')
    await user.type(within(row).getByLabelText('Reason for Listed Student'), 'Fees refunded')
    await user.click(within(row).getByRole('button', { name: 'Revoke Google sign-in' }))
    expect(mocks.revoke).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: rows[0]!.personId,
        expectedRevision: 1,
        reason: 'Fees refunded',
      }),
    )
    expect(
      await screen.findByText('Listed Student can no longer sign in with Google.'),
    ).toBeVisible()
  })
  it('searches and shows refusal without saving', async () => {
    const user = userEvent.setup()
    mocks.approve.mockRejectedValue(
      new Error('That Google email is already listed for another person.'),
    )
    renderApp(<StudentGoogleLoginsPage portal="staff" />)
    await screen.findByText('New Student')
    await user.type(screen.getByLabelText('Find a current student'), 'new')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(mocks.list).toHaveBeenLastCalledWith('new')
    const row = card('New Student')
    await user.type(
      within(row).getByLabelText('Google email for New Student'),
      'dup@fixture.invalid',
    )
    await user.type(within(row).getByLabelText('Reason for New Student'), 'Paid')
    await user.click(within(row).getByRole('button', { name: 'Add to Google list' }))
    expect(await within(row).findByRole('alert')).toHaveTextContent('already listed')
  })
})
