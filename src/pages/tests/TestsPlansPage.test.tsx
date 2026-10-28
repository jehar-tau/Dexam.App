import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'

import { formatRupees } from '../../features/testSeries/commerce'
import { renderApp } from '../../test/render'
import { TestsPlansPage } from './TestsPlansPage'

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
  client: null as null | object,
}))
vi.mock('../../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: mocks.session, signOut: vi.fn() }),
}))
vi.mock('../../features/auth/supabaseClient', () => ({
  getSupabaseClient: () => mocks.client,
}))

const plan = {
  key: 'uceed-bundle',
  title: 'UCEED bundle',
  description: 'Every UCEED paper and unlimited UCEED mocks, for a year.',
  level: 'bdes',
  pricePaise: 69900,
  currency: 'INR',
  validityDays: 365,
  onSale: false,
}
const candidateAccess = {
  kind: 'candidate',
  displayName: 'C',
  profile: { level: 'bdes', exams: ['uceed'], examYear: 2027 },
  freeSlots: [],
  entitledPapers: [],
}
const orderId = '00000000-0000-4000-8000-0000000000e1'

describe('Plans', () => {
  afterEach(() => {
    delete window.Razorpay
  })
  beforeEach(() => {
    mocks.session = { user: { id: 'candidate-1', email: 'c@example.test' } }
  })

  it('formats rupees', () => {
    expect(formatRupees(149900)).toBe('₹1,499')
  })

  it('shows draft plans as opening soon while nothing is on sale', async () => {
    mocks.client = {
      rpc: vi.fn((name: string) =>
        Promise.resolve(
          name === 'get_test_access'
            ? { data: candidateAccess, error: null }
            : name === 'list_commerce_plans'
              ? {
                  data: [
                    plan,
                    { ...plan, key: 'ceed-bundle', title: 'CEED bundle', level: 'mdes' },
                  ],
                  error: null,
                }
              : { data: [], error: null },
        ),
      ),
    }
    renderApp(
      <Routes>
        <Route path="/tests/plans" element={<TestsPlansPage />} />
      </Routes>,
      ['/tests/plans'],
    )
    const card = await screen.findByRole('region', { name: 'UCEED bundle' })
    expect(screen.queryByRole('region', { name: 'CEED bundle' })).toBeNull()
    expect(within(card).getByText('₹699')).toBeVisible()
    expect(within(card).getByRole('button', { name: 'Opening soon' })).toBeDisabled()
    expect(screen.getByText(/nothing can be bought yet/)).toBeVisible()
  })

  it('pays through Razorpay Checkout and waits for the verified webhook', async () => {
    const user = userEvent.setup()
    let paid = false
    const invoke = vi.fn(() =>
      Promise.resolve({
        data: {
          orderId,
          providerOrderId: 'order_FictionalTest01',
          keyId: 'rzp_test_fictional',
          amountPaise: 69900,
          currency: 'INR',
          planTitle: 'UCEED bundle',
        },
        error: null,
      }),
    )
    mocks.client = {
      functions: { invoke },
      rpc: vi.fn((name: string) => {
        if (name === 'get_test_access')
          return Promise.resolve({ data: candidateAccess, error: null })
        if (name === 'list_commerce_plans')
          return Promise.resolve({ data: [{ ...plan, onSale: true }], error: null })
        return Promise.resolve({
          data: [
            {
              orderId,
              planKey: 'uceed-bundle',
              planTitle: 'UCEED bundle',
              amountPaise: 69900,
              status: paid ? 'paid' : 'created',
              createdAt: '2026-10-28T10:00:00+00:00',
              paidAt: paid ? '2026-10-28T10:01:00+00:00' : null,
            },
          ],
          error: null,
        })
      }),
    }
    const opened: Record<string, unknown>[] = []
    window.Razorpay = class {
      constructor(private options: Record<string, unknown>) {
        opened.push(options)
      }
      open() {
        paid = true
        ;(this.options.handler as () => void)()
      }
    }

    renderApp(
      <Routes>
        <Route path="/tests/plans" element={<TestsPlansPage />} />
      </Routes>,
      ['/tests/plans'],
    )
    await user.click(await screen.findByRole('button', { name: 'Buy' }))
    expect(invoke).toHaveBeenCalledWith('commerce-create-order', {
      body: { planKey: 'uceed-bundle' },
    })
    expect(await screen.findByText(/Your papers and mocks are unlocked/)).toBeVisible()
    expect(opened[0]).toMatchObject({
      key: 'rzp_test_fictional',
      order_id: 'order_FictionalTest01',
      amount: 69900,
    })
    expect(await screen.findByText('Paid')).toBeVisible()
  })
})
