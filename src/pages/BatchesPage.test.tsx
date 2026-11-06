import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { BatchesPage } from './BatchesPage'
const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  students: vi.fn(),
  save: vi.fn(),
  assign: vi.fn(),
}))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'fictional' } } }),
}))
vi.mock('../features/enrolment/batches', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../features/enrolment/batches')>()),
  getBatchWorkspace: mocks.workspace,
  getBatchStudents: mocks.students,
  saveBatch: mocks.save,
  assignStudentBatch: mocks.assign,
}))
const offering = '00000000-0000-4000-8000-0000000000a1'
const december = '00000000-0000-4000-8000-0000000000b1'
const crash = '00000000-0000-4000-8000-0000000000b2'
const workspace = (canManage: boolean) => ({
  canManage,
  serviceTypes: [
    { key: 'end_to_end', label: 'End-to-end learning', defaultDurationDays: 365 },
    { key: 'crash_course', label: 'Crash course', defaultDurationDays: 45 },
  ],
  offerings: [{ id: offering, title: 'Fictional course', canAssign: true, durationDays: null }],
  batches: [
    {
      id: december,
      offeringId: offering,
      code: 'B261201-AAAAAA',
      name: 'December studio',
      serviceType: 'end_to_end',
      status: 'active',
      startsAt: '2026-12-01T00:00:00+05:30',
      endsAt: '2027-12-01T00:00:00+05:30',
      revision: 1,
      studentCount: 1,
    },
    {
      id: crash,
      offeringId: offering,
      code: 'B261115-BBBBBB',
      name: 'November crash',
      serviceType: 'crash_course',
      status: 'active',
      startsAt: '2026-11-15T00:00:00+05:30',
      endsAt: '2026-12-30T00:00:00+05:30',
      revision: 1,
      studentCount: 0,
    },
  ],
})
const student = {
  enrollmentId: '00000000-0000-4000-8000-0000000000c1',
  memberId: 'DXM-2K3M9Q2RW5TY',
  displayName: 'Fictional Student',
  batchId: december,
  movable: true,
}
describe('BatchesPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.students.mockResolvedValue([student])
  })
  it('lets Sales create a batch with a service-type default end date', async () => {
    const user = userEvent.setup()
    mocks.workspace.mockResolvedValue(workspace(true))
    mocks.save.mockResolvedValue(undefined)
    renderApp(<BatchesPage portal="staff" />)
    expect(await screen.findByRole('heading', { name: 'Create and fill batches.' })).toBeVisible()
    expect(screen.getByText(/End-to-end learning · 1 Dec 2026 to 1 Dec 2027/)).toBeVisible()
    await user.type(screen.getByLabelText('Batch name'), 'January crash')
    await user.selectOptions(screen.getByLabelText('Service type'), 'crash_course')
    await user.clear(screen.getByLabelText('Start date'))
    await user.type(screen.getByLabelText('Start date'), '2027-01-10')
    expect(screen.getByLabelText('End date')).toHaveValue('2027-02-24')
    await user.click(screen.getByRole('button', { name: 'Create batch' }))
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: null,
        offeringId: offering,
        name: 'January crash',
        serviceType: 'crash_course',
        startsOn: '2027-01-10',
        endsOn: '2027-02-24',
        status: 'active',
      }),
    )
    expect(await screen.findByText('Batch created.')).toBeVisible()
  })
  it('gives teachers placement only and records a reasoned move', async () => {
    const user = userEvent.setup()
    // Even a teacher who also holds batch.manage cannot create from the Teacher portal.
    mocks.workspace.mockResolvedValue(workspace(true))
    mocks.assign.mockResolvedValue(undefined)
    renderApp(<BatchesPage portal="teacher" />)
    expect(await screen.findByRole('heading', { name: 'Place students in batches.' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Create batch' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit / })).not.toBeInTheDocument()
    const row = (await screen.findByText(/Fictional Student · DXM/)).closest('li')!
    const move = within(row).getByRole('button', { name: 'Move' })
    await user.selectOptions(within(row).getByLabelText(/New batch/), crash)
    expect(move).toBeDisabled()
    await user.type(within(row).getByLabelText(/Reason/), 'Prefers weekdays')
    await user.click(move)
    expect(mocks.assign).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: student.enrollmentId,
        expectedBatchId: december,
        batchId: crash,
        reason: 'Prefers weekdays',
      }),
    )
    expect(await screen.findByText('Fictional Student moved to November crash.')).toBeVisible()
  })
  it('explains fixed-curriculum enrolments and denied access', async () => {
    mocks.workspace.mockResolvedValue(workspace(false))
    mocks.students.mockResolvedValue([{ ...student, batchId: null, movable: false }])
    renderApp(<BatchesPage portal="staff" />)
    expect(await screen.findByText(/own fixed curriculum/)).toBeVisible()
    expect(screen.getByText('No batch yet')).toBeVisible()
    mocks.workspace.mockRejectedValue(new Error('denied'))
    renderApp(<BatchesPage portal="teacher" />)
    expect(await screen.findByText(/may not have batch access/)).toBeVisible()
  })
})
