import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import {
  createCheckout,
  fetchMyOrders,
  fetchPlans,
  formatRupees,
  openCheckout,
  type Plan,
} from '../../features/testSeries/commerce'
import { previewSearch } from '../../features/testSeries/previewSearch'
import { useTestAccess } from '../../features/testSeries/testAccess'
import styles from './TestsPlansPage.module.css'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** F049: plans and orders. Nothing can be bought while plans are off sale. */
export function TestsPlansPage() {
  const preview = previewSearch(useLocation().search) !== ''
  const { session } = useAuth()
  const client = getSupabaseClient()
  const queryClient = useQueryClient()
  const access = useTestAccess(!preview)
  const plans = useQuery({
    queryKey: ['plans', session?.user.id],
    queryFn: () => fetchPlans(client!),
    enabled: !preview && Boolean(client && session),
  })
  const orders = useQuery({
    queryKey: ['orders', session?.user.id],
    queryFn: () => fetchMyOrders(client!),
    enabled: !preview && Boolean(client && session),
  })

  const buy = useMutation({
    mutationFn: async (plan: Plan) => {
      const order = await createCheckout(client!, plan.key)
      const outcome = await openCheckout(order)
      if (outcome === 'dismissed') return 'dismissed'
      // Access is granted by the verified webhook; wait briefly for it.
      for (let attempt = 0; attempt < 15; attempt += 1) {
        const mine = await fetchMyOrders(client!)
        if (mine.some((item) => item.orderId === order.orderId && item.status === 'paid'))
          return 'paid'
        await wait(2000)
      }
      return 'pending'
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['test-access'] })
      void queryClient.invalidateQueries({ queryKey: ['mocks'] })
    },
  })

  const level = access.data?.profile?.level
  const list = (plans.data ?? []).filter((plan) => !level || !plan.level || plan.level === level)
  const anyOnSale = list.some((plan) => plan.onSale)

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Plans</h1>
        <p className={styles.note}>
          Unlock every paper and unlimited mocks for your exams. Your free papers and free mock stay
          yours.
        </p>
      </div>
      {access.data?.kind === 'student' ? (
        <p className={styles.callout}>
          Your coaching enrolment already includes every paper and mock.
        </p>
      ) : null}
      {preview ? (
        <p className={styles.callout}>Plans appear here for signed-in candidates.</p>
      ) : !anyOnSale && plans.data ? (
        <p className={styles.callout}>
          Plans open soon. Prices are being finalised; nothing can be bought yet.
        </p>
      ) : null}
      {plans.isError ? <p className={styles.error}>{plans.error.message}</p> : null}

      <div className={styles.grid}>
        {list.map((plan) => (
          <section key={plan.key} className={styles.card} aria-label={plan.title}>
            <h2 className={styles.cardTitle}>{plan.title}</h2>
            <p className={styles.price}>
              {formatRupees(plan.pricePaise)}
              <span className={styles.per}> · {plan.validityDays} days</span>
            </p>
            <p className={styles.note}>{plan.description}</p>
            <button
              type="button"
              className={styles.primary}
              disabled={!plan.onSale || buy.isPending || access.data?.kind === 'student'}
              onClick={() => buy.mutate(plan)}
            >
              {plan.onSale
                ? buy.isPending && buy.variables?.key === plan.key
                  ? 'Opening payment…'
                  : 'Buy'
                : 'Opening soon'}
            </button>
          </section>
        ))}
      </div>
      <p className={styles.note} role="status">
        {buy.isError
          ? buy.error.message
          : buy.data === 'paid'
            ? 'Payment received. Your papers and mocks are unlocked.'
            : buy.data === 'pending'
              ? 'Payment received. Access appears as soon as the payment is confirmed; refresh in a minute.'
              : buy.data === 'dismissed'
                ? 'Payment was not completed.'
                : ''}
      </p>

      {orders.data?.length ? (
        <section className={styles.orders} aria-labelledby="orders-title">
          <h2 id="orders-title" className={styles.cardTitle}>
            Your orders
          </h2>
          <ul>
            {orders.data.map((order) => (
              <li key={order.orderId}>
                <span>{order.planTitle}</span>
                <span>{formatRupees(order.amountPaise)}</span>
                <span className={order.status === 'paid' ? styles.paid : styles.pending}>
                  {order.status === 'paid'
                    ? 'Paid'
                    : order.status === 'created'
                      ? 'Not completed'
                      : order.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
