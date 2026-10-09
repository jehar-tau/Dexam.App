import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { EnrolmentOperatorPage } from './EnrolmentOperatorPage'
import { renderApp } from '../test/render'

const mocks = vi.hoisted(() => ({
  listActivationQueue: vi.fn(),
}))

vi.mock('../features/enrolment/listActivationQueue', () => ({
  listActivationQueue: mocks.listActivationQueue,
}))

const liveEnrollment = {
  enrollmentId: '94000000-0000-4000-8000-000000000002',
  displayName: 'Kabir Mehta',
  memberId: 'DXM-8K3M9Q2RW5TY',
  offeringTitle: 'Portfolio Workshop',
  cohortName: null,
  sourceType: 'authorized_staff',
  requestedAt: '2026-10-01T10:00:00.000Z',
  approvedAt: '2026-10-02T10:00:00.000Z',
}

describe('EnrolmentOperatorPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_OPERATOR_PREVIEW', 'true')
    mocks.listActivationQueue.mockReset()
    mocks.listActivationQueue.mockResolvedValue([liveEnrollment])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('requires a final review before issuing an activation pack', async () => {
    const user = userEvent.setup()
    renderApp(<EnrolmentOperatorPage />, ['/staff/enrolments?preview=1'])

    expect(screen.getByRole('heading', { name: 'Activation queue' })).toBeVisible()
    expect(await screen.findByText('Aarohi Deshmukh')).toBeVisible()

    await user.click(await screen.findByRole('button', { name: 'Review enrolment' }))

    expect(screen.getByRole('heading', { name: 'Issue activation pack?' })).toBeVisible()
    expect(screen.getByText('The student creates their own password.')).toBeVisible()
  })

  it('shows the one-time credentials after confirmed issuance', async () => {
    const user = userEvent.setup()
    renderApp(<EnrolmentOperatorPage />, ['/staff/enrolments?preview=1'])

    await user.click(await screen.findByRole('button', { name: 'Review enrolment' }))
    await user.click(screen.getByRole('button', { name: 'Issue activation pack' }))

    expect(
      await screen.findByRole('heading', { name: 'Hand this directly to the student.' }),
    ).toBeVisible()
    expect(screen.getByText('DXM-2K3M9Q2RW5TY')).toBeVisible()
    expect(screen.getByText('7K3M9Q2RW5')).toBeVisible()
  })

  it('loads the live permission-scoped queue outside preview mode', async () => {
    renderApp(<EnrolmentOperatorPage />, ['/staff/enrolments'])

    expect(await screen.findByText('Kabir Mehta')).toBeVisible()
    expect(screen.getByText('DXM-8K3M9Q2RW5TY')).toBeVisible()
    expect(screen.getByText('Independent enrolment')).toBeVisible()
    expect(mocks.listActivationQueue).toHaveBeenCalledWith(25, '')
  })

  it('submits a name or Member ID search to the queue service', async () => {
    const user = userEvent.setup()
    renderApp(<EnrolmentOperatorPage />, ['/staff/enrolments'])
    await screen.findByText('Kabir Mehta')

    await user.type(screen.getByRole('searchbox', { name: 'Search queue' }), '  aarohi  ')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(mocks.listActivationQueue).toHaveBeenLastCalledWith(25, 'aarohi')
  })

  it('shows a useful empty state and clears an unsuccessful search', async () => {
    const user = userEvent.setup()
    renderApp(<EnrolmentOperatorPage />, ['/staff/enrolments?preview=1'])

    await user.type(screen.getByRole('searchbox', { name: 'Search queue' }), 'Nobody')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('No matching enrolments')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(await screen.findByText('Aarohi Deshmukh')).toBeVisible()
  })

  it('offers a retry when the live queue cannot be loaded', async () => {
    const user = userEvent.setup()
    mocks.listActivationQueue.mockRejectedValueOnce(new Error('unavailable'))
    renderApp(<EnrolmentOperatorPage />, ['/staff/enrolments'])

    expect(await screen.findByText('The activation queue could not be loaded.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Kabir Mehta')).toBeVisible()
    expect(mocks.listActivationQueue).toHaveBeenCalledTimes(2)
  })
})
