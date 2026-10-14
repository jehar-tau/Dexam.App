import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { EnrollmentCloseoutPage } from './EnrollmentCloseoutPage'
const mocks = vi.hoisted(() => ({ list: vi.fn(), close: vi.fn() }))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'operator' } } }),
}))
vi.mock('../features/enrolment/enrollmentCloseout', () => ({
  listEnrollmentCloseouts: mocks.list,
  closeEnrollment: mocks.close,
}))
describe('enrolment closeout page', () => {
  it('requires deliberate review and confirmation, then preserves the bounded archive notice', async () => {
    mocks.list.mockResolvedValue([
      {
        enrollment_id: 'enrollment',
        member_id: 'DXM-FICTIONAL',
        display_name: 'Fictional student',
        offering_title: 'Fictional course',
        cohort_name: null,
        status: 'active',
        ended_at: null,
      },
    ])
    mocks.close.mockResolvedValue('2026-10-14T10:00:00Z')
    const user = userEvent.setup()
    renderApp(<EnrollmentCloseoutPage />)
    await user.click(await screen.findByRole('button', { name: 'Review course closeout' }))
    expect(screen.getByRole('button', { name: 'Close this enrolment' })).toBeDisabled()
    await user.click(
      screen.getByLabelText(
        'I checked this student and course and confirm the stated access change.',
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Close this enrolment' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Member ID and other courses remain unchanged',
    )
    expect(mocks.close).toHaveBeenCalledWith('enrollment', 'completed', true, expect.any(String))
  })
})
