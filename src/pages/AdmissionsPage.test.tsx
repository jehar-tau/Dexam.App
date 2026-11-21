import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { AdmissionsPage } from './AdmissionsPage'
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: mocks.accountId } } }),
}))
const mocks = vi.hoisted(() => ({
  accountId: 'fictional-admin',
  choices: vi.fn(),
  history: vi.fn(),
  directory: vi.fn(),
  search: vi.fn(),
  admit: vi.fn(),
  edit: vi.fn(),
}))
vi.mock('../features/enrolment/admissions', () => ({
  getAdmissionChoices: mocks.choices,
  getAdmissionHistory: mocks.history,
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
    mocks.accountId = 'fictional-admin'
    mocks.history.mockResolvedValue({ changes: [], receipts: [], hasMore: false })
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

  it('recalculates the chosen duration when the start changes and preserves a custom expiry', async () => {
    const user = userEvent.setup()
    mocks.choices.mockResolvedValue({ enabled: true, timezone: 'Asia/Kolkata', offerings: [] })
    renderApp(<AdmissionsPage />)
    await screen.findByRole('button', { name: 'View history' })
    const start = screen.getByLabelText('Access start — Asia/Kolkata')
    const expiry = screen.getByLabelText(/Access expiry — Asia/)
    const preset = screen.getByLabelText('Duration preset')
    fireEvent.change(start, { target: { value: '2028-01-01T01:05' } })
    await user.selectOptions(preset, '12')
    expect(expiry).toHaveValue('2029-01-01T01:05')
    fireEvent.change(start, { target: { value: '2028-02-29T01:05' } })
    expect(expiry).toHaveValue('2029-02-28T01:05')
    fireEvent.change(expiry, { target: { value: '2029-05-15T11:25' } })
    expect(preset).toHaveValue('')
    fireEvent.change(start, { target: { value: '2028-04-01T11:25' } })
    expect(expiry).toHaveValue('2029-05-15T11:25')
    await user.selectOptions(preset, '30')
    expect(expiry).toHaveValue('2028-05-01T11:25')
  })

  it('submits corrected India-time dates and retries the same reviewed admission without changing its key', async () => {
    const user = userEvent.setup()
    mocks.choices.mockResolvedValue({
      enabled: true,
      timezone: 'Asia/Kolkata',
      offerings: [
        {
          id: 'course',
          title: 'Fictional course',
          batches: [{ id: 'group', name: 'Fictional batch' }],
        },
      ],
    })
    mocks.search.mockResolvedValue([])
    mocks.admit
      .mockRejectedValueOnce(new Error('Response was lost.'))
      .mockResolvedValueOnce({ replayed: true })
    renderApp(<AdmissionsPage />)
    await screen.findByRole('button', { name: 'View history' })
    const fill = (label: string | RegExp, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fill('Student display name', 'Fictional learner')
    fill('Dedicated student login email', 'learner@fixture.invalid')
    await user.click(screen.getByRole('button', { name: 'Check existing identity' }))
    await user.click(await screen.findByRole('radio', { name: /this is a new person/ }))
    await user.selectOptions(screen.getByLabelText('Programme'), 'course')
    await user.selectOptions(screen.getByLabelText('Delivery batch'), 'group')
    fill('Access start — Asia/Kolkata', '2028-01-01T01:05')
    await user.selectOptions(screen.getByLabelText('Duration preset'), '12')
    fill('Access start — Asia/Kolkata', '2028-02-29T01:05')
    fill(/Amount actually received/, '1200')
    fill('Payment received at — Asia/Kolkata', '2026-11-01T18:00')
    fill(/Receipt\/reference/, 'Fictional receipt')
    fill('Admission reason', 'Fictional review')
    await user.click(screen.getByRole('checkbox', { name: /I verified the canonical student/ }))
    const submit = screen.getByRole('button', { name: 'Record admission and manual receipt' })
    await user.click(submit)
    expect(await screen.findByRole('alert')).toHaveTextContent('Response was lost')
    const admission = mocks.admit.mock.calls[0]?.[0]
    expect(admission).toMatchObject({
      startsAt: '2028-02-28T19:35:00.000Z',
      expiresAt: '2029-02-27T19:35:00.000Z',
      paidAt: '2026-11-01T12:30:00.000Z',
      requestKey: expect.any(String),
    })
    await user.click(submit)
    await screen.findByText(/Admission recorded/)
    expect(mocks.admit.mock.calls[1]?.[0]).toEqual(admission)
    expect(screen.getByLabelText('Duration preset')).toHaveValue('')
    expect(screen.getByLabelText(/Access expiry — Asia/)).toHaveValue('')
  })

  it('clears a previous expiry on preset overflow and recovers when the start is corrected', async () => {
    const user = userEvent.setup()
    mocks.choices.mockResolvedValue({ enabled: true, timezone: 'Asia/Kolkata', offerings: [] })
    renderApp(<AdmissionsPage />)
    await screen.findByRole('button', { name: 'View history' })
    const start = screen.getByLabelText('Access start — Asia/Kolkata')
    const expiry = screen.getByLabelText(/Access expiry — Asia/)
    fireEvent.change(start, { target: { value: '2028-09-01T00:30' } })
    await user.selectOptions(screen.getByLabelText('Duration preset'), '48')
    fireEvent.change(start, { target: { value: '9996-01-01T00:30' } })
    expect(expiry).toHaveValue('')
    expect(screen.getByRole('alert')).toHaveTextContent(/supported date range/)
    fireEvent.change(start, { target: { value: '2028-10-01T00:30' } })
    expect(expiry).toHaveValue('2032-10-01T00:30')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps directory pages bounded and resets the page and batch when filters change', async () => {
    const user = userEvent.setup()
    const records = Array.from({ length: 100 }, (_, index) => ({
      ...row,
      enrollmentId: `enrollment-${index}`,
      name: `Learner number ${index + 1}`,
    }))
    mocks.directory.mockImplementation(
      (_search: string, _state: string, { offset }: { offset: number }) =>
        Promise.resolve(records.slice(offset, offset + 100)),
    )
    renderApp(<AdmissionsPage />)
    expect(await screen.findByRole('heading', { name: /^Learner number 50 ·/ })).toBeVisible()
    expect(screen.queryByRole('heading', { name: /^Learner number 51 ·/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next results' }))
    expect(await screen.findByRole('heading', { name: /^Learner number 51 ·/ })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next results' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Student directory' })).toHaveFocus()
    await user.selectOptions(screen.getByLabelText('Filter by course'), 'offering')
    expect(await screen.findByRole('heading', { name: /^Learner number 1 ·/ })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Previous results' })).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Filter by batch'), 'batch')
    await user.selectOptions(screen.getByLabelText('Access state'), 'ended')
    fireEvent.change(screen.getByLabelText('Access expires on or before (India time)'), {
      target: { value: '2028-02-29' },
    })
    await waitFor(() =>
      expect(mocks.directory).toHaveBeenLastCalledWith('', 'ended', {
        offeringId: 'offering',
        cohortId: 'batch',
        expiresBefore: '2028-02-29T23:59:59.999999+05:30',
        offset: 0,
      }),
    )
    await user.selectOptions(screen.getByLabelText('Filter by course'), '')
    expect(screen.getByLabelText('Filter by batch')).toBeDisabled()
    expect(mocks.directory).toHaveBeenLastCalledWith(
      '',
      'ended',
      expect.objectContaining({ offeringId: undefined, cohortId: undefined, offset: 0 }),
    )
  })

  it('filters archived courses and batches without offering them for admission', async () => {
    const user = userEvent.setup()
    const active = { id: 'offering', title: 'Current course', batches: [] }
    const archived = {
      id: 'archived',
      title: 'Former course',
      batches: [{ id: 'old-batch', name: 'Former batch' }],
    }
    mocks.choices.mockResolvedValue({
      enabled: true,
      timezone: 'Asia/Kolkata',
      offerings: [active],
      directoryOfferings: [active, archived],
    })
    renderApp(<AdmissionsPage />)
    await screen.findByRole('button', { name: 'View history' })
    await user.selectOptions(screen.getByLabelText('Filter by course'), 'archived')
    await user.selectOptions(screen.getByLabelText('Filter by batch'), 'old-batch')
    expect(mocks.directory).toHaveBeenLastCalledWith(
      '',
      '',
      expect.objectContaining({ offeringId: 'archived', cohortId: 'old-batch' }),
    )
    expect(
      within(screen.getByLabelText('Programme')).queryByRole('option', { name: 'Former course' }),
    ).not.toBeInTheDocument()
  })

  it('reads manual receipts and changes for ended enrolments with writes disabled', async () => {
    const user = userEvent.setup()
    mocks.directory.mockResolvedValue([{ ...row, state: 'ended' }])
    const at = '2026-11-01T18:30:00Z'
    mocks.history.mockResolvedValueOnce({
      changes: [
        {
          id: 'change-1',
          at,
          actorId: 'admin',
          actorName: 'Fixture Admin',
          action: 'details',
          reason: 'Corrected spelling',
          prior: { name: 'Old spelling' },
          next: { name: 'New spelling' },
        },
      ],
      receipts: [
        {
          id: 'receipt-1',
          evidenceKind: 'manual',
          method: 'online_transfer',
          amountPaise: 123456,
          currency: 'INR',
          paidAt: at,
          reference: 'Transfer-42',
          confirmedBy: 'admin',
          confirmedByName: 'Fixture Admin',
          confirmedAt: at,
        },
      ],
      hasMore: true,
    })
    renderApp(<AdmissionsPage />)
    expect(await screen.findByRole('button', { name: 'Review changes' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'View history' }))
    expect(await screen.findByText('Display name updated')).toBeVisible()
    expect(screen.getByText(/Old spelling.*New spelling/)).toBeVisible()
    expect(screen.getByText(/Confirmed by Fixture Admin/)).toBeVisible()
    expect(screen.getByText(/1,234.56 · Online transfer/)).toBeVisible()
    expect(screen.getByText('Reference: Transfer-42')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Next history' }))
    expect(await screen.findByText('No changes on this page.')).toBeVisible()
    expect(screen.queryByText('Reference: Transfer-42')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Enrolment history' })).toHaveFocus()
    expect(mocks.history).toHaveBeenLastCalledWith(row.enrollmentId, 1)
    await user.click(screen.getByRole('button', { name: 'Previous history' }))
    expect(mocks.history).toHaveBeenLastCalledWith(row.enrollmentId, 0)
    expect(mocks.edit).not.toHaveBeenCalled()
  })

  it('discards late history from the previous enrolment and retries only the selected record', async () => {
    const user = userEvent.setup()
    let finish!: (result: unknown) => void
    mocks.directory.mockResolvedValue([
      row,
      { ...row, enrollmentId: 'second', name: 'Second Learner' },
    ])
    const lateHistory = new Promise((resolve) => {
      finish = resolve
    })
    mocks.history
      .mockReturnValueOnce(lateHistory)
      .mockRejectedValueOnce(new Error('expired access'))
    renderApp(<AdmissionsPage />)
    const first = await screen.findByRole('article', { name: /Fictional Learner/ })
    const second = screen.getByRole('article', { name: /Second Learner/ })
    await user.click(within(first).getByRole('button', { name: 'View history' }))
    await user.click(within(second).getByRole('button', { name: 'View history' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('History could not be loaded')
    await act(async () => {
      finish({ changes: [], receipts: [{ reference: 'Late receipt' }], hasMore: false })
      await lateHistory
    })
    expect(screen.queryByText(/Late receipt/)).not.toBeInTheDocument()
    expect(
      within(first).queryByRole('region', { name: 'Enrolment history' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry history' }))
    expect(await screen.findByText('No admission receipts on this page.')).toBeVisible()
    expect(mocks.history).toHaveBeenLastCalledWith('second', 0)
  })

  it('clears the selected record and private drafts when accounts change', async () => {
    const user = userEvent.setup()
    mocks.choices.mockResolvedValue({ enabled: true, timezone: 'Asia/Kolkata', offerings: [] })
    const view = renderApp(<AdmissionsPage />)
    await user.click(await screen.findByRole('button', { name: 'View history' }))
    expect(await screen.findByText('No changes on this page.')).toBeVisible()
    await user.type(screen.getByLabelText('Student display name'), 'Private draft')
    mocks.accountId = 'other-admin'
    view.rerender(<AdmissionsPage />)
    await screen.findByRole('button', { name: 'View history' })
    expect(screen.queryByRole('region', { name: 'Enrolment history' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Student display name')).toHaveValue('')
    expect(mocks.history).toHaveBeenCalledTimes(1)
  })
})
